import json
import jsonschema
import re
from typing import List, Dict, Any, Optional
import openai
from ..config import settings
from ..services.parser_service import parser_service
from ..services.project_detector import project_detector
from ..services.webdev_intelligence import WebDevIntelligence, ExperimentType


class AnalysisService:
    """Service for AI-powered document analysis using OpenAI Chat API"""
    
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.client = None
        
        if self.api_key:
            import openai
            openai.api_key = self.api_key
            self.client = openai
        else:
            print("Warning: OPENAI_API_KEY not set. AI analysis features will be disabled.")
        
        # Model selection for different tasks
        self.analysis_model = "gpt-4o"  # Best for document analysis (fallback to gpt-4o-mini)
        self.generation_model = "gpt-4o-mini"  # For answer/code generation
        self.caption_model = "gpt-4o-mini"  # For caption summarization
        
        # Initialize webdev intelligence service
        self.webdev_intelligence = WebDevIntelligence()
        
        # JSON schema for task candidates
        self.candidates_schema = {
            "type": "object",
            "properties": {
                "candidates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "task_id": {"type": "string"},
                            "question_context": {"type": "string"},
                            "task_type": {"type": "string", "enum": ["screenshot_request", "answer_request", "code_execution", "react_project"]},
                            "suggested_code": {"type": ["string", "object", "null"]},
                            "extracted_code": {"type": ["string", "null"]},
                            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                            "suggested_insertion": {"type": "string", "enum": ["below_question", "bottom_of_page"]},
                            "brief_description": {"type": "string"},
                            "follow_up": {"type": ["string", "null"]},
                            "project_files": {"type": ["object", "null"]},
                            "routes": {"type": ["array", "null"]}
                        },
                        "required": ["task_id", "question_context", "task_type", "confidence", "suggested_insertion", "brief_description"]
                    }
                }
            },
            "required": ["candidates"]
        }
    
    async def analyze_document(self, file_path: str, file_type: str, language: str = None) -> List[Dict[str, Any]]:
        """
        Analyze uploaded document and return AI-generated task candidates
        """
        if not self.client:
            # Return empty list if OpenAI API key is not available
            return []
            
        try:
            # Add file existence validation
            import os
            if not os.path.exists(file_path):
                raise Exception(f"File not found at path: {file_path}")
            
            # Parse the document to extract text and structure
            parsed_content = await parser_service.parse_file(file_path, file_type)
            
            # Convert parsed content to text for analysis
            document_text = self._extract_text_for_analysis(parsed_content)

            # Detect project type from parsed content
            code_blocks = [
                item.get("code_snippet", "") for item in parsed_content if isinstance(item, dict)
            ]
            detection = project_detector.detect(document_text, code_blocks)
            
            # Truncate if too long (keep first 8000 characters to leave room for response)
            if len(document_text) > 8000:
                document_text = document_text[:8000] + "\n\n[Document truncated...]"
            
            # Generate task candidates using OpenAI
            candidates = await self._generate_task_candidates(
                document_text,
                detection=detection
            )
            
            return candidates
            
        except Exception as e:
            raise Exception(f"Document analysis failed: {str(e)}")
    
    def _extract_text_for_analysis(self, parsed_content: List[Dict[str, Any]]) -> str:
        """Extract and format text from parsed content for AI analysis"""
        text_parts = []
        
        for i, task in enumerate(parsed_content):
            text_parts.append(f"Question {i+1}: {task.get('question_text', '')}")
            if task.get('code_snippet'):
                text_parts.append(f"Code: {task['code_snippet']}")
            text_parts.append("")  # Empty line between questions
        
        return "\n".join(text_parts)
    
    def _detect_react_project(self, document_text: str) -> dict:
        """Detect if document contains React SPA project structure"""
        patterns = {
            "has_router": r"react-router|BrowserRouter|Routes|Route",
            "has_components": r"components/.*?\.js|Navbar|Home|About|Contact",
            "has_package_json": r"package\.json|npm install",
            "has_app_js": r"App\.js|function App"
        }
        
        detected = {key: bool(re.search(pattern, document_text, re.IGNORECASE)) 
                    for key, pattern in patterns.items()}
        
        is_react_project = sum(detected.values()) >= 2
        return {"is_project": is_react_project, "features": detected}
    
    def _extract_project_files(self, code_text: str) -> dict:
        """Extract file paths and contents from AI response"""
        files = {}
        
        # Handle None or empty input
        if not code_text or not isinstance(code_text, str):
            return files
        
        # Pattern to match file headers and their content
        # Matches: src/App.js or App.js followed by code block
        pattern = r'(?:^|\n)(?:src/)?([A-Za-z]+\.(?:js|jsx|css))[:\s]*\n(.*?)(?=\n(?:src/)?[A-Za-z]+\.(?:js|jsx|css)|$)'
        matches = re.findall(pattern, code_text, re.DOTALL | re.MULTILINE)
        
        for filepath, content in matches:
            # Clean up content
            content = content.strip()
            # Remove code fence markers if present
            content = re.sub(r'^```(?:javascript|jsx|css)?\n', '', content)
            content = re.sub(r'\n```$', '', content)
            files[f"src/{filepath}"] = content.strip()
        
        # If no files found, treat entire code as App.jsx
        return files if files else {"src/App.jsx": code_text}
    
    def _extract_routes(self, code_text: str) -> list:
        """Extract React Router routes from code"""
        routes = ["/"]  # Always include home
        
        # Handle None or empty input
        if not code_text or not isinstance(code_text, str):
            return routes
            
        route_pattern = r'<Route\s+path=["\']([^"\']+)["\']'
        found_routes = re.findall(route_pattern, code_text)
        routes.extend([r for r in found_routes if r != "/"])
        return list(set(routes))  # Remove duplicates
    
    async def _generate_task_candidates(self, document_text: str, detection: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Generate task candidates using OpenAI Chat API"""
        
        if not self.client:
            return []
            
        system_prompt = """You are an expert computer science teaching assistant analyzing programming assignments.

Follow these hard rules for project typing and templates:
- Only classify web stacks: html_css_js, react, node_express. If content suggests python/java/c, mark as unknown and skip code generation for those.
- React/JSX present → task_type = react_project. Use React 18 functional components with src/App.jsx and src/main.jsx (ReactDOM.createRoot). Include package.json and working routes.
- Node/Express patterns (express/app.listen/require/import express) → node_express with index.js + package.json "start": "node index.js".
- Otherwise default to html_css_js with index.html, style.css, script.js (no Node server).
- NEVER ask the user for filenames, environment, template, or theme. Assume auto naming and theming handled by the system.

Your task is to analyze the provided assignment document and identify opportunities for:
1. answer_request
2. react_project
3. screenshot_request (for non-React web code)
4. code_execution (non-web; but avoid generating python/java/c here—prefer web stacks)

CRITICAL RULE: If you see ANY of these keywords in code: React, ReactDOM, JSX, import from 'react', useState, useEffect, function component returning JSX (<div>, <h1>, etc.), YOU MUST classify it as "react_project" type. NEVER use "code_execution" or "screenshot_request" for React code.

EXPERIMENT DETECTION (web focus):
- Exp 1: HTML5, CSS, Resume Page
- Exp 2: HTML Forms
- Exp 3: JavaScript Basics (DOM, Validation, Loops)
- Exp 4: JavaScript Advanced (Arrow Functions, Classes, Inheritance)
- Exp 5: React Setup, Components, Virtual DOM
- Exp 6: React Router, SPA Design
- Exp 7: Node.js Web Server, HTTP Module, File System
- Exp 8: Express.js Cookies
- Exp 9: Mini-Project (HTML, CSS, JavaScript, React)

For each identified task, provide:
- task_id
- question_context
- task_type
- suggested_code (respect template and stack above)
- confidence (0-1)
- brief_description
- follow_up (optional)
- project_files/routes when react_project

For React Projects (MANDATORY):
- task_type = react_project
- Produce COMPLETE working React 18 code (src/App.jsx, src/main.jsx, optional components, CSS)
- Use react-router-dom v6 when routes are implied; otherwise single route ["/"]
- No placeholders or Python—only valid React/JS

For HTML/CSS/JS:
- Provide index.html, style.css, script.js as needed; no Node server.

For Node/Express:
- Provide index.js and package.json scripts start; keep to simple express app.listen pattern.

Only output valid JSON matching the schema. Do not include any text before or after the JSON."""

        detection_text = ""
        if detection:
            detection_text = (
                f"\nDetected project type: {detection.get('type', 'unknown')} "
                f"(confidence: {detection.get('confidence', 0)})"
                f"\nIndicators: {', '.join(detection.get('indicators', [])) or 'n/a'}"
            )

        user_prompt = f"""Analyze this programming assignment and identify tasks:

{document_text}

{detection_text}

Return a JSON object with a "candidates" array containing task suggestions. Each candidate should help the student complete their assignment by providing screenshots of code execution, AI-generated answers, or code demonstrations. Respect the detected project type and tailor tasks accordingly."""

        # Try GPT-4o first, fallback to GPT-4o-mini for document analysis
        model_to_use = self.analysis_model
        
        try:
            response = self.client.ChatCompletion.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=0.3,
                timeout=60  # Add timeout
            )
            
            content = response.choices[0].message.content.strip() if response.choices[0].message.content else ""
            
            # Check if content is empty
            if not content:
                raise Exception(f"Empty response from OpenAI. Response object: {response}")
            
            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]  # Remove ```json
            if content.startswith("```"):
                content = content[3:]  # Remove ```
            if content.endswith("```"):
                content = content[:-3]  # Remove trailing ```
            content = content.strip()
            
            # Parse and validate JSON response
            try:
                parsed_response = json.loads(content)
                
                # Normalize the response - add missing required fields with defaults
                if "candidates" in parsed_response:
                    for candidate in parsed_response["candidates"]:
                        # Attach detection info if the model didn't return explicit project_type
                        if detection:
                            candidate.setdefault("project_type", detection.get("type"))
                            candidate.setdefault("project_confidence", detection.get("confidence"))
                            candidate.setdefault("project_indicators", detection.get("indicators"))
                        # Handle description vs brief_description
                        if "description" in candidate and "brief_description" not in candidate:
                            candidate["brief_description"] = candidate["description"]
                        if "brief_description" not in candidate:
                            candidate["brief_description"] = f"Task: {candidate.get('task_type', 'unknown')}"
                        
                        # Add default suggested_insertion if missing
                        if "suggested_insertion" not in candidate:
                            candidate["suggested_insertion"] = "below_question"
                        
                        # Map field names if OpenAI uses different names
                        if "context" in candidate and "question_context" not in candidate:
                            candidate["question_context"] = candidate["context"]
                        if "description" in candidate and "brief_description" not in candidate:
                            candidate["brief_description"] = candidate["description"]
                        
                        # Ensure all required fields exist
                        if "confidence" not in candidate:
                            candidate["confidence"] = 0.8
                        if "extracted_code" not in candidate:
                            candidate["extracted_code"] = None
                        if "suggested_code" not in candidate:
                            candidate["suggested_code"] = None
                        if "follow_up" not in candidate:
                            candidate["follow_up"] = None
                        
                        # Handle react_project type: extract files and routes
                        if candidate.get("task_type") == "react_project":
                            # Use webdev intelligence to detect experiment type and enhance file structure
                            question_context = candidate.get("question_context", "")
                            code_snippet = candidate.get("extracted_code")
                            
                            # Detect experiment type
                            exp_type = self.webdev_intelligence.detect_experiment_type(question_context, code_snippet)
                            
                            # Get intelligent file structure based on experiment type
                            intelligent_files = self.webdev_intelligence.get_required_files(exp_type, question_context)
                            
                            # Get screenshot requirements
                            routes, file_screenshots = self.webdev_intelligence.get_screenshot_requirements(
                                exp_type, intelligent_files
                            )
                            
                            suggested_code = candidate.get("suggested_code")
                            
                            # Merge AI-generated files with intelligent files (intelligent files take precedence)
                            if isinstance(suggested_code, dict):
                                # Check if it's a nested structure with project_files/routes keys
                                if "project_files" in suggested_code or "routes" in suggested_code:
                                    # Extract from nested structure
                                    ai_files = suggested_code.get("project_files", {})
                                    ai_routes = suggested_code.get("routes", [])
                                    
                                    # Merge: intelligent files override AI files, but keep AI files if intelligent is empty
                                    if intelligent_files:
                                        merged_files = {**ai_files, **intelligent_files}
                                        candidate["project_files"] = merged_files
                                        candidate["routes"] = routes if routes else ai_routes
                                    else:
                                        candidate["project_files"] = ai_files
                                        candidate["routes"] = ai_routes
                                    
                                    # Set suggested_code to the project_files for compatibility
                                    candidate["suggested_code"] = candidate["project_files"]
                                else:
                                    # It's a direct project files dict
                                    ai_files = suggested_code
                                    
                                    # Merge with intelligent files
                                    if intelligent_files:
                                        merged_files = {**ai_files, **intelligent_files}
                                        candidate["project_files"] = merged_files
                                        candidate["routes"] = routes
                                    else:
                                        candidate["project_files"] = ai_files
                                        # Extract routes from the combined code
                                        combined_code = "\n".join([
                                            str(value) for value in ai_files.values() 
                                            if isinstance(value, str)
                                        ])
                                        candidate["routes"] = self._extract_routes(combined_code)
                            elif isinstance(suggested_code, str):
                                # Extract files from string suggested_code
                                ai_files = self._extract_project_files(suggested_code)
                                
                                # Merge with intelligent files
                                if intelligent_files:
                                    merged_files = {**ai_files, **intelligent_files}
                                    candidate["project_files"] = merged_files
                                    candidate["routes"] = routes
                                else:
                                    candidate["project_files"] = ai_files
                                    candidate["routes"] = self._extract_routes(suggested_code)
                            else:
                                # No AI-generated files, use intelligent files
                                if intelligent_files:
                                    candidate["project_files"] = intelligent_files
                                    candidate["routes"] = routes
                                else:
                                    candidate["project_files"] = None
                                    candidate["routes"] = ["/"]
                            
                            # Add experiment metadata
                            candidate["experiment_type"] = exp_type.value
                            candidate["experiment_info"] = self.webdev_intelligence.get_experiment_info(exp_type)
                            
                            # Set defaults if still not present
                            if not candidate.get("project_files"):
                                candidate["project_files"] = intelligent_files if intelligent_files else None
                            if not candidate.get("routes"):
                                candidate["routes"] = routes if routes else settings.REACT_DEFAULT_ROUTES
                        else:
                            # For non-project types, set to None
                            if "project_files" not in candidate:
                                candidate["project_files"] = None
                            if "routes" not in candidate:
                                candidate["routes"] = None
                
                # Now validate
                jsonschema.validate(parsed_response, self.candidates_schema)
                return parsed_response["candidates"]
            except (json.JSONDecodeError, jsonschema.ValidationError) as e:
                raise Exception(f"Invalid JSON response from OpenAI. Error: {str(e)}. Content received: {content[:500]}")
                
        except Exception as e:
            # Fallback to GPT-4o-mini if GPT-4o fails
            if model_to_use == "gpt-4o" and ("does not exist" in str(e) or "not found" in str(e)):
                try:
                    response = self.client.ChatCompletion.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        max_tokens=settings.OPENAI_MAX_TOKENS,
                        temperature=0.3
                    )
                    content = response.choices[0].message.content.strip()
                    try:
                        parsed_response = json.loads(content)
                        jsonschema.validate(parsed_response, self.candidates_schema)
                        return parsed_response["candidates"]
                    except (json.JSONDecodeError, jsonschema.ValidationError) as e:
                        raise Exception(f"Invalid JSON response from OpenAI: {str(e)}")
                except Exception as fallback_error:
                    raise Exception(f"OpenAI API error (tried gpt-4o and gpt-4o-mini): {str(fallback_error)}")
            
            if "rate limit" in str(e).lower():
                raise Exception("OpenAI rate limit exceeded. Please try again later.")
            raise Exception(f"OpenAI API error: {str(e)}")
    
    async def generate_code_and_answer(self, task_type: str, question_context: str, 
                                     extracted_code: Optional[str] = None,
                                     follow_up_answer: Optional[str] = None) -> Dict[str, str]:
        """Generate code and/or answer for a specific task"""
        
        if task_type == "answer_request":
            return await self._generate_answer(question_context, follow_up_answer)
        elif task_type in ["screenshot_request", "code_execution"]:
            return await self._generate_code(question_context, extracted_code, follow_up_answer)
        else:
            raise ValueError(f"Unsupported task type: {task_type}")
    
    async def _generate_answer(self, question_context: str, follow_up_answer: Optional[str] = None) -> Dict[str, str]:
        """Generate AI answer for a question"""
        
        system_prompt = """You are an expert computer science tutor. Provide clear, educational explanations for programming questions.

Focus on:
- Clear explanations of concepts
- Step-by-step reasoning
- Code examples when helpful
- Best practices and common pitfalls

Keep answers concise but comprehensive (2-4 paragraphs)."""

        user_prompt = f"""Answer this programming question:

{question_context}"""

        if follow_up_answer:
            user_prompt += f"\n\nAdditional context from user: {follow_up_answer}"

        try:
            response = self.client.ChatCompletion.create(
                model=self.generation_model,  # Use GPT-4o-mini for answer generation
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.7
            )
            
            return {"answer": response.choices[0].message.content.strip()}
            
        except Exception as e:
            raise Exception(f"Failed to generate answer: {str(e)}")
    
    async def _generate_code(self, question_context: str, extracted_code: Optional[str] = None,
                           follow_up_answer: Optional[str] = None) -> Dict[str, str]:
        """Generate runnable Python code for a task"""
        
        system_prompt = """You are an expert Python programmer. Generate clean, runnable Python code that solves the given problem.

Requirements:
- Use only standard library modules (no external packages)
- Include clear variable names and comments
- Add print statements to show output/results
- Handle edge cases appropriately
- Keep code concise but readable

Return only the Python code, no explanations."""

        user_prompt = f"""Generate Python code for this task:

{question_context}"""

        if extracted_code:
            user_prompt += f"\n\nExisting code from document:\n{extracted_code}"
        
        if follow_up_answer:
            user_prompt += f"\n\nUser clarification: {follow_up_answer}"

        try:
            response = self.client.ChatCompletion.create(
                model=self.generation_model,  # Use GPT-4o-mini for code generation
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.3
            )
            
            return {"code": response.choices[0].message.content.strip()}
            
        except Exception as e:
            raise Exception(f"Failed to generate code: {str(e)}")
    
    async def generate_caption(self, task_type: str, stdout: str, exit_code: int, 
                             code_snippet: str) -> str:
        """Generate a caption for a screenshot or execution result"""
        
        system_prompt = """Generate a brief, professional caption (1-2 sentences) that describes what the code does and its output.

Focus on:
- What the code accomplishes
- Key results or outputs shown
- Success/failure status if relevant

Keep it concise and educational."""

        user_prompt = f"""Task type: {task_type}
Code executed:
{code_snippet}

Output:
{stdout}

Exit code: {exit_code}

Generate a caption for this execution result."""

        try:
            response = self.client.ChatCompletion.create(
                model=self.caption_model,  # Use GPT-4o-mini for caption generation (fast & cheap)
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=150,
                temperature=0.5
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            # Fallback caption if AI generation fails
            return f"Code execution {'successful' if exit_code == 0 else 'failed'} with exit code {exit_code}"


# Create singleton instance
analysis_service = AnalysisService()
