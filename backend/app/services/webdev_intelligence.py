"""
Intelligent Web Development Experiment Detection and File Structure Generator

This service intelligently detects experiment types from web development assignments
and generates appropriate file structures with correct screenshot requirements.
"""

import re
from typing import Dict, List, Optional, Tuple
from enum import Enum


class ExperimentType(Enum):
    """Web Development Experiment Types"""
    EXP_1_HTML_CSS_RESUME = "exp_1_html_css_resume"
    EXP_2_HTML_FORMS = "exp_2_html_forms"
    EXP_3_JAVASCRIPT_BASICS = "exp_3_javascript_basics"
    EXP_4_JAVASCRIPT_ADVANCED = "exp_4_javascript_advanced"
    EXP_5_REACT_SETUP = "exp_5_react_setup"
    EXP_6_REACT_ROUTER = "exp_6_react_router"
    EXP_7_NODE_SERVER = "exp_7_node_server"
    EXP_8_EXPRESS_COOKIES = "exp_8_express_cookies"
    EXP_9_MINI_PROJECT = "exp_9_mini_project"
    UNKNOWN = "unknown"


class WebDevIntelligence:
    """Intelligent detection and file structure generation for web development experiments"""
    
    # Experiment detection patterns
    EXPERIMENT_PATTERNS = {
        ExperimentType.EXP_1_HTML_CSS_RESUME: [
            r'\b(resume|cv|curriculum vitae|personal page|portfolio page)\b',
            r'\bhtml5?\b.*\bcss\b',
            r'\bstyling\b.*\bbrowser testing\b',
            r'\bexperiment\s*1\b',
            r'\bexp\s*1\b',
        ],
        ExperimentType.EXP_2_HTML_FORMS: [
            r'\bhtml\s+forms?\b',
            r'\binput\s+types?\b',
            r'\bblock\s+elements?\b',
            r'\bframes?\b',
            r'\bform\s+attributes?\b',
            r'\bexperiment\s*2\b',
            r'\bexp\s*2\b',
        ],
        ExperimentType.EXP_3_JAVASCRIPT_BASICS: [
            r'\bjavascript\s+basics?\b',
            r'\bdom\s+manipulation\b',
            r'\bvalidation\b',
            r'\bcontrol\s+structures?\b',
            r'\bloops?\b',
            r'\bexperiment\s*3\b',
            r'\bexp\s*3\b',
        ],
        ExperimentType.EXP_4_JAVASCRIPT_ADVANCED: [
            r'\barrow\s+functions?\b',
            r'\bclasses?\b.*\bconstructor\b',
            r'\binheritance\b',
            r'\bmenu\s+driven\s+program\b',
            r'\bexperiment\s*4\b',
            r'\bexp\s*4\b',
        ],
        ExperimentType.EXP_5_REACT_SETUP: [
            r'\breact\s+setup\b',
            r'\bcomponents?\b',
            r'\bvirtual\s+dom\b',
            r'\bcreate\s+react\s+app\b',
            r'\bcra\b',
            r'\bexperiment\s*5\b',
            r'\bexp\s*5\b',
        ],
        ExperimentType.EXP_6_REACT_ROUTER: [
            r'\breact\s+router\b',
            r'\bspa\s+design\b',
            r'\brouting\s+components?\b',
            r'\bbrowserrouter\b',
            r'\bexperiment\s*6\b',
            r'\bexp\s*6\b',
        ],
        ExperimentType.EXP_7_NODE_SERVER: [
            r'\bnode\.?js\s+web\s+server\b',
            r'\bhttp\s+module\b',
            r'\bfile\s+system\s+operations?\b',
            r'\bread.*write.*delete\b',
            r'\bexperiment\s*7\b',
            r'\bexp\s*7\b',
        ],
        ExperimentType.EXP_8_EXPRESS_COOKIES: [
            r'\bexpress\.?js\s+cookies?\b',
            r'\bcookie-parser\b',
            r'\bset.*get.*delete\s+cookies?\b',
            r'\bexperiment\s*8\b',
            r'\bexp\s*8\b',
        ],
        ExperimentType.EXP_9_MINI_PROJECT: [
            r'\bmini-?project\b',
            r'\bpresentation\b',
            r'\bhtml.*css.*javascript.*react\b',
            r'\bexperiment\s*9\b',
            r'\bexp\s*9\b',
        ],
    }
    
    def detect_experiment_type(self, question_text: str, code_snippet: Optional[str] = None) -> ExperimentType:
        """
        Detect experiment type from question text and optional code snippet
        
        Args:
            question_text: The assignment question or description
            code_snippet: Optional code snippet that might contain hints
            
        Returns:
            Detected ExperimentType
        """
        text = (question_text + " " + (code_snippet or "")).lower()
        
        # Score each experiment type based on pattern matches
        scores = {}
        for exp_type, patterns in self.EXPERIMENT_PATTERNS.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches
            scores[exp_type] = score
        
        # Find the highest scoring experiment type
        max_score = max(scores.values()) if scores else 0
        
        if max_score == 0:
            # Fallback: Check for React-specific keywords
            if any(keyword in text for keyword in ['react', 'jsx', 'component', 'reactdom']):
                if 'router' in text or 'route' in text or 'spa' in text:
                    return ExperimentType.EXP_6_REACT_ROUTER
                return ExperimentType.EXP_5_REACT_SETUP
            elif any(keyword in text for keyword in ['node', 'express', 'server']):
                if 'cookie' in text:
                    return ExperimentType.EXP_8_EXPRESS_COOKIES
                return ExperimentType.EXP_7_NODE_SERVER
            elif 'form' in text and 'html' in text:
                return ExperimentType.EXP_2_HTML_FORMS
            elif 'javascript' in text or 'js' in text:
                if any(keyword in text for keyword in ['arrow', 'class', 'inheritance']):
                    return ExperimentType.EXP_4_JAVASCRIPT_ADVANCED
                return ExperimentType.EXP_3_JAVASCRIPT_BASICS
            elif 'resume' in text or 'cv' in text or 'portfolio' in text:
                return ExperimentType.EXP_1_HTML_CSS_RESUME
            
            return ExperimentType.UNKNOWN
        
        # Return the experiment type with the highest score
        best_match = max(scores.items(), key=lambda x: x[1])[0]
        return best_match
    
    def get_required_files(self, experiment_type: ExperimentType, question_text: str) -> Dict[str, str]:
        """
        Get required file structure for a given experiment type
        
        Args:
            experiment_type: The detected experiment type
            question_text: The assignment question for context
            
        Returns:
            Dictionary mapping file paths to their content templates
        """
        files = {}
        
        if experiment_type == ExperimentType.EXP_1_HTML_CSS_RESUME:
            files = self._generate_resume_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_2_HTML_FORMS:
            files = self._generate_form_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_3_JAVASCRIPT_BASICS:
            files = self._generate_javascript_basics_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_4_JAVASCRIPT_ADVANCED:
            files = self._generate_javascript_advanced_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_5_REACT_SETUP:
            files = self._generate_react_setup_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_6_REACT_ROUTER:
            files = self._generate_react_router_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_7_NODE_SERVER:
            files = self._generate_node_server_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_8_EXPRESS_COOKIES:
            files = self._generate_express_cookies_files(question_text)
        
        elif experiment_type == ExperimentType.EXP_9_MINI_PROJECT:
            files = self._generate_mini_project_files(question_text)
        
        else:
            # Default: Generate basic React structure
            files = self._generate_react_setup_files(question_text)
        
        return files
    
    def get_screenshot_requirements(self, experiment_type: ExperimentType, files: Dict[str, str]) -> Tuple[List[str], Dict[str, bool]]:
        """
        Get screenshot requirements for an experiment
        
        Args:
            experiment_type: The experiment type
            files: Dictionary of project files
            
        Returns:
            Tuple of (routes to screenshot, dict of file_path -> needs_browser_output)
        """
        routes = []
        file_screenshots = {}
        
        if experiment_type in [ExperimentType.EXP_5_REACT_SETUP, ExperimentType.EXP_6_REACT_ROUTER, ExperimentType.EXP_9_MINI_PROJECT]:
            # React projects: screenshot main routes
            if "src/App.js" in files or "src/App.jsx" in files:
                routes.append("/")
            
            # Detect additional routes from App.js
            app_content = files.get("src/App.js", "") + files.get("src/App.jsx", "")
            route_matches = re.findall(r'path=["\']([^"\']+)["\']', app_content)
            routes.extend(route_matches)
            
            # Screenshot all component files (code view)
            for file_path in files.keys():
                if file_path.endswith(('.js', '.jsx')) and 'src/' in file_path:
                    file_screenshots[file_path] = file_path in ["src/App.js", "src/App.jsx", "src/index.js", "src/main.js"]
                elif file_path.endswith('.css'):
                    file_screenshots[file_path] = False  # CSS only needs code view
        
        elif experiment_type in [ExperimentType.EXP_1_HTML_CSS_RESUME, ExperimentType.EXP_2_HTML_FORMS]:
            # HTML projects: screenshot the HTML file
            html_files = [f for f in files.keys() if f.endswith('.html')]
            for html_file in html_files:
                file_screenshots[html_file] = True  # HTML needs browser output
        
        elif experiment_type in [ExperimentType.EXP_3_JAVASCRIPT_BASICS, ExperimentType.EXP_4_JAVASCRIPT_ADVANCED]:
            # JavaScript: screenshot HTML file with JS output
            html_files = [f for f in files.keys() if f.endswith('.html')]
            for html_file in html_files:
                file_screenshots[html_file] = True
        
        elif experiment_type in [ExperimentType.EXP_7_NODE_SERVER, ExperimentType.EXP_8_EXPRESS_COOKIES]:
            # Node.js: screenshot server.js and any HTML files
            for file_path in files.keys():
                if file_path.endswith('.js') and 'server' in file_path.lower():
                    file_screenshots[file_path] = False  # Code view only
                elif file_path.endswith('.html'):
                    file_screenshots[file_path] = True  # Browser output
        
        # Remove duplicates from routes
        routes = list(dict.fromkeys(routes))
        if not routes:
            routes = ["/"]
        
        return routes, file_screenshots
    
    def _generate_resume_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 1: HTML5, CSS, Resume Page"""
        return {
            "index.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resume - Your Name</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Your Name</h1>
            <p class="subtitle">Web Developer</p>
        </header>
        
        <section class="contact">
            <h2>Contact Information</h2>
            <p>Email: your.email@example.com</p>
            <p>Phone: +1 234 567 8900</p>
            <p>LinkedIn: linkedin.com/in/yourname</p>
        </section>
        
        <section class="education">
            <h2>Education</h2>
            <div class="item">
                <h3>Bachelor of Science in Computer Science</h3>
                <p>University Name, Year</p>
            </div>
        </section>
        
        <section class="experience">
            <h2>Work Experience</h2>
            <div class="item">
                <h3>Software Developer</h3>
                <p class="company">Company Name</p>
                <p class="date">2020 - Present</p>
                <ul>
                    <li>Developed web applications using modern technologies</li>
                    <li>Collaborated with cross-functional teams</li>
                </ul>
            </div>
        </section>
        
        <section class="skills">
            <h2>Skills</h2>
            <ul>
                <li>HTML5</li>
                <li>CSS3</li>
                <li>JavaScript</li>
                <li>React</li>
            </ul>
        </section>
    </div>
</body>
</html>""",
            "styles.css": """* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f4f4f4;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background-color: white;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
}

header {
    text-align: center;
    padding: 20px 0;
    border-bottom: 2px solid #333;
    margin-bottom: 20px;
}

header h1 {
    font-size: 2.5em;
    margin-bottom: 10px;
}

.subtitle {
    font-size: 1.2em;
    color: #666;
}

section {
    margin-bottom: 30px;
}

h2 {
    color: #333;
    border-bottom: 1px solid #ddd;
    padding-bottom: 10px;
    margin-bottom: 15px;
}

.item {
    margin-bottom: 20px;
}

.item h3 {
    color: #555;
    margin-bottom: 5px;
}

.company {
    font-weight: bold;
    color: #777;
}

.date {
    color: #999;
    font-style: italic;
}

ul {
    margin-left: 20px;
    margin-top: 10px;
}

li {
    margin-bottom: 5px;
}

.contact p {
    margin-bottom: 5px;
}"""
        }
    
    def _generate_form_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 2: HTML Forms"""
        return {
            "index.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Forms</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Registration Form</h1>
        <form id="registrationForm" action="#" method="post">
            <div class="form-group">
                <label for="name">Full Name:</label>
                <input type="text" id="name" name="name" required>
            </div>
            
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <div class="form-group">
                <label for="age">Age:</label>
                <input type="number" id="age" name="age" min="18" max="100">
            </div>
            
            <div class="form-group">
                <label for="gender">Gender:</label>
                <select id="gender" name="gender">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Interests:</label>
                <div class="checkbox-group">
                    <label><input type="checkbox" name="interests" value="coding"> Coding</label>
                    <label><input type="checkbox" name="interests" value="design"> Design</label>
                    <label><input type="checkbox" name="interests" value="music"> Music</label>
                </div>
            </div>
            
            <div class="form-group">
                <label>Subscribe to newsletter:</label>
                <label><input type="radio" name="newsletter" value="yes"> Yes</label>
                <label><input type="radio" name="newsletter" value="no"> No</label>
            </div>
            
            <div class="form-group">
                <label for="message">Message:</label>
                <textarea id="message" name="message" rows="4"></textarea>
            </div>
            
            <button type="submit">Submit</button>
            <button type="reset">Reset</button>
        </form>
    </div>
</body>
</html>""",
            "styles.css": """* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f0f0f0;
    padding: 20px;
}

.container {
    max-width: 600px;
    margin: 0 auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h1 {
    text-align: center;
    margin-bottom: 30px;
    color: #333;
}

.form-group {
    margin-bottom: 20px;
}

label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
    color: #555;
}

input[type="text"],
input[type="email"],
input[type="password"],
input[type="number"],
select,
textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
}

.checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.checkbox-group label,
.form-group label:has(input[type="radio"]) {
    font-weight: normal;
    display: inline-flex;
    align-items: center;
    gap: 5px;
}

button {
    padding: 12px 24px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    margin-right: 10px;
}

button[type="reset"] {
    background-color: #6c757d;
}

button:hover {
    opacity: 0.9;
}"""
        }
    
    def _generate_javascript_basics_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 3: JavaScript Basics"""
        return {
            "index.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JavaScript Basics</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>JavaScript Basics Demo</h1>
        
        <div class="demo-section">
            <h2>DOM Manipulation</h2>
            <button id="changeTextBtn">Change Text</button>
            <p id="demoText">Original Text</p>
        </div>
        
        <div class="demo-section">
            <h2>Form Validation</h2>
            <form id="demoForm">
                <input type="text" id="userInput" placeholder="Enter your name" required>
                <button type="submit">Submit</button>
            </form>
            <p id="validationResult"></p>
        </div>
        
        <div class="demo-section">
            <h2>Control Structures & Loops</h2>
            <button id="loopBtn">Generate Numbers</button>
            <div id="loopOutput"></div>
        </div>
    </div>
    
    <script src="script.js"></script>
</body>
</html>""",
            "script.js": """// DOM Manipulation
document.getElementById('changeTextBtn').addEventListener('click', function() {
    const textElement = document.getElementById('demoText');
    textElement.textContent = 'Text Changed Successfully!';
    textElement.style.color = 'green';
});

// Form Validation
document.getElementById('demoForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const input = document.getElementById('userInput');
    const result = document.getElementById('validationResult');
    
    if (input.value.trim() === '') {
        result.textContent = 'Please enter a valid name!';
        result.style.color = 'red';
    } else {
        result.textContent = `Hello, ${input.value}! Welcome.`;
        result.style.color = 'green';
    }
});

// Control Structures & Loops
document.getElementById('loopBtn').addEventListener('click', function() {
    const output = document.getElementById('loopOutput');
    output.innerHTML = '<h3>Numbers 1 to 10:</h3>';
    
    // For loop
    for (let i = 1; i <= 10; i++) {
        const p = document.createElement('p');
        p.textContent = `Number: ${i}`;
        output.appendChild(p);
    }
    
    // While loop example
    let count = 1;
    output.innerHTML += '<h3>Even Numbers (while loop):</h3>';
    while (count <= 10) {
        if (count % 2 === 0) {
            const p = document.createElement('p');
            p.textContent = `Even: ${count}`;
            output.appendChild(p);
        }
        count++;
    }
});""",
            "styles.css": """* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
    padding: 20px;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h1 {
    text-align: center;
    color: #333;
    margin-bottom: 30px;
}

.demo-section {
    margin-bottom: 30px;
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 5px;
}

h2 {
    color: #555;
    margin-bottom: 15px;
}

button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    margin-bottom: 10px;
}

button:hover {
    background-color: #0056b3;
}

input {
    padding: 8px;
    margin-right: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

#loopOutput p {
    margin: 5px 0;
    padding: 5px;
    background-color: #e9ecef;
    border-radius: 3px;
}"""
        }
    
    def _generate_javascript_advanced_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 4: JavaScript Advanced (Arrow Functions, Classes)"""
        return {
            "index.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JavaScript Advanced</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>JavaScript Advanced Features</h1>
        
        <div class="demo-section">
            <h2>Arrow Functions</h2>
            <button id="arrowBtn">Test Arrow Functions</button>
            <div id="arrowOutput"></div>
        </div>
        
        <div class="demo-section">
            <h2>Classes & Inheritance</h2>
            <button id="classBtn">Test Classes</button>
            <div id="classOutput"></div>
        </div>
        
        <div class="demo-section">
            <h2>Menu Driven Program</h2>
            <select id="menuSelect">
                <option value="">Select an option</option>
                <option value="1">Option 1: Display Info</option>
                <option value="2">Option 2: Calculate</option>
                <option value="3">Option 3: Exit</option>
            </select>
            <button id="menuBtn">Execute</button>
            <div id="menuOutput"></div>
        </div>
    </div>
    
    <script src="script.js"></script>
</body>
</html>""",
            "script.js": """// Arrow Functions
const arrowFunctions = {
    add: (a, b) => a + b,
    multiply: (a, b) => a * b,
    greet: name => `Hello, ${name}!`,
    square: x => x * x
};

document.getElementById('arrowBtn').addEventListener('click', () => {
    const output = document.getElementById('arrowOutput');
    output.innerHTML = `
        <p>Add(5, 3): ${arrowFunctions.add(5, 3)}</p>
        <p>Multiply(4, 7): ${arrowFunctions.multiply(4, 7)}</p>
        <p>${arrowFunctions.greet('JavaScript')}</p>
        <p>Square(9): ${arrowFunctions.square(9)}</p>
    `;
});

// Classes & Inheritance
class Animal {
    constructor(name, species) {
        this.name = name;
        this.species = species;
    }
    
    speak() {
        return `${this.name} makes a sound`;
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name, 'Dog');
        this.breed = breed;
    }
    
    speak() {
        return `${this.name} barks!`;
    }
    
    fetch() {
        return `${this.name} fetches the ball`;
    }
}

document.getElementById('classBtn').addEventListener('click', () => {
    const animal = new Animal('Generic', 'Unknown');
    const dog = new Dog('Buddy', 'Golden Retriever');
    
    const output = document.getElementById('classOutput');
    output.innerHTML = `
        <p>${animal.speak()}</p>
        <p>${dog.speak()}</p>
        <p>${dog.fetch()}</p>
        <p>Species: ${dog.species}, Breed: ${dog.breed}</p>
    `;
});

// Menu Driven Program
document.getElementById('menuBtn').addEventListener('click', () => {
    const menu = document.getElementById('menuSelect').value;
    const output = document.getElementById('menuOutput');
    
    switch(menu) {
        case '1':
            output.innerHTML = '<p style="color: green;">Info: This is a JavaScript Advanced Features Demo</p>';
            break;
        case '2':
            const result = arrowFunctions.multiply(6, 7);
            output.innerHTML = `<p style="color: blue;">Calculation Result: 6 × 7 = ${result}</p>`;
            break;
        case '3':
            output.innerHTML = '<p style="color: red;">Exiting program...</p>';
            break;
        default:
            output.innerHTML = '<p style="color: orange;">Please select an option</p>';
    }
});""",
            "styles.css": """* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
    padding: 20px;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h1 {
    text-align: center;
    color: #333;
    margin-bottom: 30px;
}

.demo-section {
    margin-bottom: 30px;
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 5px;
}

h2 {
    color: #555;
    margin-bottom: 15px;
}

button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    margin: 10px 10px 10px 0;
}

button:hover {
    background-color: #0056b3;
}

select {
    padding: 8px;
    margin-right: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
}

#arrowOutput p,
#classOutput p,
#menuOutput p {
    margin: 5px 0;
    padding: 8px;
    background-color: #e9ecef;
    border-radius: 3px;
}"""
        }
    
    def _generate_react_setup_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 5: React Setup"""
        return {
            "src/App.js": """import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to React</h1>
        <p>This is a React application created with Create React App</p>
        <p>Virtual DOM is working!</p>
      </header>
    </div>
  );
}

export default App;""",
            "src/App.css": """.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

.App-header h1 {
  margin-bottom: 20px;
}

.App-header p {
  margin: 10px 0;
}""",
            "src/index.js": """import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);""",
            "src/index.css": """body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}"""
        }
    
    def _generate_react_router_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 6: React Router"""
        # Extract page names from question if possible
        pages = self._extract_page_names(question_text)
        if not pages:
            pages = ['Home', 'About', 'Features']
        
        files = {
            "src/App.js": self._generate_react_router_app(pages),
            "src/App.css": """* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
}

nav {
  background-color: #333;
  padding: 1rem;
}

nav ul {
  list-style: none;
  display: flex;
  gap: 2rem;
}

nav a {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

nav a:hover {
  background-color: #555;
}

.page {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page h1 {
  margin-bottom: 1rem;
}

.page p {
  line-height: 1.6;
}""",
            "src/index.js": """import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);""",
            "src/index.css": """body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}"""
        }
        
        # Generate page components
        for page in pages:
            page_lower = page.lower()
            files[f"src/{page}.js"] = f"""import React from 'react';

function {page}() {{
  return (
    <div className="page">
      <h1>{page} Page</h1>
      <p>This is the {page} page of the React Router SPA.</p>
      <p>Navigation is working correctly with BrowserRouter.</p>
    </div>
  );
}}

export default {page};"""
        
        return files
    
    def _generate_react_router_app(self, pages: List[str]) -> str:
        """Generate App.js with React Router setup"""
        routes = []
        links = []
        
        for page in pages:
            page_lower = page.lower()
            # Construct JSX element separately to avoid f-string syntax issues
            element_jsx = f'<{page} />'
            routes.append(f'        <Route path="/{page_lower}" element={{{element_jsx}}} />')
            links.append(f'            <Link to="/{page_lower}">{page}</Link>')
        
        # Add home route
        home_page = pages[0] if pages else 'Home'
        home_element_jsx = f'<{home_page} />'
        routes.insert(0, f'        <Route path="/" element={{{home_element_jsx}}} />')
        
        return f"""import React from 'react';
import {{ BrowserRouter as Router, Routes, Route, Link }} from 'react-router-dom';
import './App.css';
{chr(10).join([f"import {page} from './{page}';" for page in pages])}

function App() {{
  return (
    <Router>
      <nav>
        <ul>
{chr(10).join(links)}
        </ul>
      </nav>
      
      <Routes>
{chr(10).join(routes)}
      </Routes>
    </Router>
  );
}}

export default App;"""
    
    def _generate_node_server_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 7: Node.js Web Server"""
        return {
            "server.js": """const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Create HTTP server
const server = http.createServer((req, res) => {
    console.log(`Request received: ${req.method} ${req.url}`);
    
    // Handle different routes
    if (req.url === '/' || req.url === '/index.html') {
        // Read and serve index.html
        fs.readFile('index.html', 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error reading file');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/read') {
        // Read operation
        fs.readFile('data.txt', 'utf8', (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(`File content: ${data}`);
            }
        });
    } else if (req.url === '/write' && req.method === 'POST') {
        // Write operation
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            fs.writeFile('data.txt', body, (err) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error writing file');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('File written successfully');
                }
            });
        });
    } else if (req.url === '/delete' && req.method === 'DELETE') {
        // Delete operation
        fs.unlink('data.txt', (err) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found or already deleted');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('File deleted successfully');
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Available endpoints:');
    console.log('  GET  / - Serve index.html');
    console.log('  GET  /read - Read data.txt');
    console.log('  POST /write - Write to data.txt');
    console.log('  DELETE /delete - Delete data.txt');
});""",
            "index.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Node.js Web Server</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        button {
            padding: 10px 20px;
            margin: 5px;
            cursor: pointer;
        }
        #output {
            margin-top: 20px;
            padding: 10px;
            background-color: #f0f0f0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>Node.js Web Server Demo</h1>
    <p>This demonstrates HTTP module, file system operations (read/write/delete)</p>
    
    <div>
        <button onclick="readFile()">Read File</button>
        <button onclick="writeFile()">Write File</button>
        <button onclick="deleteFile()">Delete File</button>
    </div>
    
    <div id="output"></div>
    
    <script>
        async function readFile() {
            try {
                const response = await fetch('/read');
                const text = await response.text();
                document.getElementById('output').textContent = text;
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        async function writeFile() {
            try {
                const response = await fetch('/write', {
                    method: 'POST',
                    body: 'Hello from Node.js File System!'
                });
                const text = await response.text();
                document.getElementById('output').textContent = text;
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        async function deleteFile() {
            try {
                const response = await fetch('/delete', {
                    method: 'DELETE'
                });
                const text = await response.text();
                document.getElementById('output').textContent = text;
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>""",
            "package.json": """{
  "name": "node-server-demo",
  "version": "1.0.0",
  "description": "Node.js Web Server with File System Operations",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "keywords": ["node", "http", "filesystem"],
  "author": "",
  "license": "ISC"
}"""
        }
    
    def _generate_express_cookies_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 8: Express.js Cookies"""
        return {
            "server.js": """const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;

// Use cookie-parser middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));

// Route to set a cookie
app.get('/set-cookie', (req, res) => {
    res.cookie('username', 'JohnDoe', { maxAge: 900000, httpOnly: true });
    res.cookie('theme', 'dark', { maxAge: 900000 });
    res.send('Cookies set successfully!');
});

// Route to get cookies
app.get('/get-cookie', (req, res) => {
    const username = req.cookies.username || 'Not set';
    const theme = req.cookies.theme || 'Not set';
    res.json({
        username: username,
        theme: theme,
        allCookies: req.cookies
    });
});

// Route to delete a cookie
app.get('/delete-cookie', (req, res) => {
    res.clearCookie('username');
    res.clearCookie('theme');
    res.send('Cookies deleted successfully!');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Available endpoints:');
    console.log('  GET /set-cookie - Set cookies');
    console.log('  GET /get-cookie - Get cookies');
    console.log('  GET /delete-cookie - Delete cookies');
});""",
            "public/index.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Express.js Cookies Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        button {
            padding: 10px 20px;
            margin: 5px;
            cursor: pointer;
        }
        #output {
            margin-top: 20px;
            padding: 15px;
            background-color: #f0f0f0;
            border-radius: 4px;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <h1>Express.js Cookies Demo</h1>
    <p>Demonstrating cookie-parser: Set, Get, and Delete cookies</p>
    
    <div>
        <button onclick="setCookie()">Set Cookie</button>
        <button onclick="getCookie()">Get Cookie</button>
        <button onclick="deleteCookie()">Delete Cookie</button>
    </div>
    
    <div id="output"></div>
    
    <script>
        async function setCookie() {
            try {
                const response = await fetch('/set-cookie');
                const text = await response.text();
                document.getElementById('output').textContent = text;
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        async function getCookie() {
            try {
                const response = await fetch('/get-cookie');
                const data = await response.json();
                document.getElementById('output').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        async function deleteCookie() {
            try {
                const response = await fetch('/delete-cookie');
                const text = await response.text();
                document.getElementById('output').textContent = text;
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>""",
            "package.json": """{
  "name": "express-cookies-demo",
  "version": "1.0.0",
  "description": "Express.js Cookies Demo with cookie-parser",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cookie-parser": "^1.4.6"
  },
  "keywords": ["express", "cookies", "cookie-parser"],
  "author": "",
  "license": "ISC"
}"""
        }
    
    def _generate_mini_project_files(self, question_text: str) -> Dict[str, str]:
        """Generate files for Exp 9: Mini Project"""
        # Generate a complete React SPA with multiple pages
        pages = ['Home', 'About', 'Features', 'Contact']
        
        files = {
            "src/App.js": self._generate_react_router_app(pages),
            "src/App.css": """* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Arial', sans-serif;
  background-color: #f5f5f5;
}

nav {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem 2rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

nav ul {
  list-style: none;
  display: flex;
  gap: 2rem;
  justify-content: center;
}

nav a {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
  font-weight: 500;
}

nav a:hover {
  background-color: rgba(255,255,255,0.2);
}

.page {
  padding: 3rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 80px);
}

.page h1 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 2.5rem;
}

.page p {
  line-height: 1.8;
  color: #666;
  font-size: 1.1rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.contact-form {
  max-width: 600px;
  margin: 2rem auto;
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  padding: 0.75rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: opacity 0.3s;
}

button:hover {
  opacity: 0.9;
}""",
            "src/index.js": """import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);""",
            "src/index.css": """body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}"""
        }
        
        # Generate page components
        files["src/Home.js"] = """import React from 'react';

function Home() {
  return (
    <div className="page">
      <h1>Welcome to Our Mini Project</h1>
      <p>This is a complete React Single Page Application built with React Router.</p>
      <p>Navigate through different pages using the menu above.</p>
    </div>
  );
}

export default Home;"""
        
        files["src/About.js"] = """import React from 'react';

function About() {
  return (
    <div className="page">
      <h1>About Us</h1>
      <p>This mini project demonstrates the integration of HTML, CSS, JavaScript, and React.</p>
      <p>It showcases modern web development practices including component-based architecture and client-side routing.</p>
    </div>
  );
}

export default About;"""
        
        files["src/Features.js"] = """import React from 'react';

function Features() {
  return (
    <div className="page">
      <h1>Features</h1>
      <div className="feature-grid">
        <div className="feature-card">
          <h3>React Components</h3>
          <p>Modular and reusable component architecture</p>
        </div>
        <div className="feature-card">
          <h3>React Router</h3>
          <p>Client-side routing for seamless navigation</p>
        </div>
        <div className="feature-card">
          <h3>Modern CSS</h3>
          <p>Beautiful and responsive design</p>
        </div>
      </div>
    </div>
  );
}

export default Features;"""
        
        files["src/Contact.js"] = """import React, { useState } from 'react';

function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Form submitted! (This is a demo)');
  };
  
  return (
    <div className="page">
      <h1>Contact Us</h1>
      <form className="contact-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name:</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name}
            onChange={handleChange}
            required 
          />
        </div>
        <div className="form-group">
          <label>Email:</label>
          <input 
            type="email" 
            name="email" 
            value={formData.email}
            onChange={handleChange}
            required 
          />
        </div>
        <div className="form-group">
          <label>Message:</label>
          <textarea 
            name="message" 
            rows="5"
            value={formData.message}
            onChange={handleChange}
            required
          ></textarea>
        </div>
        <button type="submit">Send Message</button>
      </form>
    </div>
  );
}

export default Contact;"""
        
        return files
    
    def _extract_page_names(self, question_text: str) -> List[str]:
        """Extract page/component names from question text"""
        # Look for patterns like "create home page", "about page", etc.
        pages = []
        text_lower = question_text.lower()
        
        # Common page names
        common_pages = ['home', 'about', 'contact', 'features', 'services', 'products', 'blog', 'gallery']
        for page in common_pages:
            if page in text_lower:
                pages.append(page.capitalize())
        
        # Look for explicit mentions like "Home.js", "About component"
        pattern = r'\b([A-Z][a-z]+)\s*(?:page|component|\.js)'
        matches = re.findall(pattern, question_text)
        pages.extend([m for m in matches if m not in pages])
        
        return pages[:5]  # Limit to 5 pages
    
    def get_experiment_info(self, experiment_type: ExperimentType) -> Dict[str, any]:
        """Get information about an experiment type"""
        info_map = {
            ExperimentType.EXP_1_HTML_CSS_RESUME: {
                "name": "Experiment 1",
                "topics": ["HTML5", "CSS", "Resume Page Design", "Styling", "Browser Testing"],
                "screenshot_count": 2  # HTML + CSS
            },
            ExperimentType.EXP_2_HTML_FORMS: {
                "name": "Experiment 2",
                "topics": ["HTML Forms", "Input Types", "Block Elements", "Frames", "Form Attributes"],
                "screenshot_count": 2  # HTML + CSS
            },
            ExperimentType.EXP_3_JAVASCRIPT_BASICS: {
                "name": "Experiment 3",
                "topics": ["JavaScript Basics", "DOM Manipulation", "Validation", "Control Structures", "Loops"],
                "screenshot_count": 3  # HTML + JS + CSS
            },
            ExperimentType.EXP_4_JAVASCRIPT_ADVANCED: {
                "name": "Experiment 4",
                "topics": ["Arrow Functions", "Classes", "Constructor", "Inheritance", "Menu Driven Program"],
                "screenshot_count": 3  # HTML + JS + CSS
            },
            ExperimentType.EXP_5_REACT_SETUP: {
                "name": "Experiment 5",
                "topics": ["React Setup", "Components", "Virtual DOM", "Create React App Environment"],
                "screenshot_count": 4  # App.js, index.js, App.css, index.css
            },
            ExperimentType.EXP_6_REACT_ROUTER: {
                "name": "Experiment 6",
                "topics": ["React Router", "SPA Design", "Routing Components", "BrowserRouter", "Links"],
                "screenshot_count": 6  # App.js + 3-4 page components + CSS
            },
            ExperimentType.EXP_7_NODE_SERVER: {
                "name": "Experiment 7",
                "topics": ["Node.js Web Server", "HTTP Module", "File System Operations (read/write/delete)"],
                "screenshot_count": 3  # server.js + index.html + package.json
            },
            ExperimentType.EXP_8_EXPRESS_COOKIES: {
                "name": "Experiment 8",
                "topics": ["Express.js Cookies", "Cookie-Parser", "Set/Get/Delete Cookies"],
                "screenshot_count": 3  # server.js + index.html + package.json
            },
            ExperimentType.EXP_9_MINI_PROJECT: {
                "name": "Experiment 9",
                "topics": ["Mini-Project Using HTML", "CSS", "JavaScript", "React with Presentation"],
                "screenshot_count": 8  # Multiple React components + CSS
            },
        }
        
        return info_map.get(experiment_type, {
            "name": "Unknown Experiment",
            "topics": [],
            "screenshot_count": 2
        })

