# 🤖 LabMate AI - Complete AI Workflow Guide

## 📋 Overview

LabMate AI now uses a **fully AI-powered workflow** that intelligently analyzes your lab assignments, executes code, generates screenshots, and creates complete reports automatically.

---

## 🔄 The Complete Workflow

### **Step 1: Upload File** 📤
- Go to http://localhost:3000/dashboard
- Upload your lab assignment (DOCX or PDF)
- The file is parsed and sent to OpenAI for analysis

### **Step 2: AI Review** 🧠
The AI analyzes your document and identifies:

1. **Screenshot Requests**: Code blocks that need to be executed with terminal output screenshots
2. **Answer Requests**: Theory questions that need AI-generated explanations
3. **Code Execution Tasks**: Code that should be run and documented

For each task, the AI provides:
- `question_context`: The relevant question/section from your document
- `task_type`: What kind of task it is (screenshot_request, answer_request, code_execution)
- `suggested_code`: Python code to execute (if applicable)
- `confidence`: How confident the AI is (0-1)
- `suggested_insertion`: Where to place the result (below_question or bottom_of_page)
- `brief_description`: A caption for the screenshot or answer
- `follow_up`: Optional questions the AI needs answered

**Your Control Panel:**
- ✅ Select which tasks you want to execute
- ✏️ Edit the suggested code before execution
- 📍 Choose insertion location (below question or bottom of page)
- 🎨 Pick screenshot theme (IDLE or VS Code style)
- 💬 Answer any follow-up questions from the AI

### **Step 3: Execute & Report** 🚀

Once you confirm your selections, the backend:

#### For Code Execution Tasks:
1. **Validates Code**: Checks against a security blocklist (no file system access, no network, etc.)
2. **Docker Execution**: Runs code in an isolated Python container with resource limits
3. **Capture Output**: Records stdout, stderr, and exit code
4. **Generate Screenshots**: 
   - Creates an editor-style code view (syntax highlighted)
   - Creates a terminal output view
   - Applies your chosen theme (IDLE or VS Code)
5. **AI Caption**: Generates a 1-2 line description of the result

#### For Answer Requests:
1. **AI Generation**: OpenAI writes a detailed answer to the theory question
2. **Context Aware**: Uses the assignment context to provide relevant explanations
3. **Formatted**: Properly formatted for insertion into Word documents

#### Document Composition:
1. **Smart Insertion**: Places screenshots and answers based on your preferences:
   - `below_question`: Directly after the related question
   - `bottom_of_page`: At the end of the document
2. **Professional Formatting**: Maintains document structure and styling
3. **Caption Integration**: Adds AI-generated captions to screenshots
4. **Final Report**: Generates a downloadable DOCX file

### **Step 4: Download** ⬇️
- Preview all screenshots and AI answers
- Reorder or remove items if needed
- Click "Compose Report" to generate the final document
- Download your completed lab report!

---

## 🎯 Example Use Cases

### Use Case 1: Python Lab Assignment
**Document contains:**
```
Question 1: Write a Python program to print the first 10 Fibonacci numbers.

Question 2: Explain recursion in Python with an example.

Question 3: Implement a linear search algorithm.
```

**AI Analysis Will Suggest:**
1. **Task 1** (code_execution):
   - Generate Fibonacci code
   - Run in Docker
   - Screenshot: code + terminal output
   - Insert: below Question 1

2. **Task 2** (answer_request):
   - AI writes explanation of recursion
   - Includes a recursive factorial example
   - Insert: below Question 2

3. **Task 3** (code_execution):
   - Generate linear search code
   - Run with sample data
   - Screenshot: code + search results
   - Insert: below Question 3

**Result**: A complete Word document with code, outputs, screenshots, and explanations!

---

## 🔧 Technical Details

### AI Analysis (Backend: `/api/analyze`)
```python
POST /api/analyze
Body: { "file_id": 1 }

Response: {
  "candidates": [
    {
      "task_id": "task_1",
      "question_context": "Write a Python program to print...",
      "task_type": "code_execution",
      "suggested_code": "def fibonacci(n):\n    ...",
      "extracted_code": null,
      "confidence": 0.95,
      "suggested_insertion": "below_question",
      "brief_description": "Fibonacci sequence generator",
      "follow_up": "Should we include error handling?"
    }
  ]
}
```

### Task Submission (Backend: `/api/tasks/submit`)
```python
POST /api/tasks/submit
Body: {
  "file_id": 1,
  "tasks": [
    {
      "task_id": "task_1",
      "task_type": "code_execution",
      "code": "# your edited code",
      "follow_up_answer": "Yes, include error handling",
      "insertion_preference": "below_question"
    }
  ],
  "theme": "vscode",
  "insertion_preference": "below_question"
}

Response: {
  "job_id": 123,
  "status": "processing",
  "message": "AI tasks are being executed..."
}
```

### Job Status (Backend: `/api/tasks/{job_id}`)
```python
GET /api/tasks/123

Response: {
  "job_id": 123,
  "status": "completed",
  "tasks": [
    {
      "task_id": "task_1",
      "status": "completed",
      "screenshot_url": "/screenshots/task_1_editor.png",
      "stdout": "0\n1\n1\n2\n3\n5\n8\n13\n21\n34",
      "exit_code": 0,
      "caption": "Successfully generated first 10 Fibonacci numbers",
      "assistant_answer": null
    }
  ]
}
```

### Report Composition (Backend: `/api/compose`)
```python
POST /api/compose
Body: {
  "file_id": 1,
  "job_id": 123,
  "selected_tasks": ["task_1", "task_2"]
}

Response: {
  "report_url": "/reports/assignment_final_123.docx",
  "message": "Report generated successfully"
}
```

---

## 🛡️ Security Features

### Code Validation Blocklist:
- ❌ File system write operations (`open(mode='w')`, `pathlib.write_text`)
- ❌ Network operations (`socket`, `requests`, `urllib`)
- ❌ System operations (`os.system`, `subprocess`, `exec`, `eval`)
- ❌ Process management (`fork`, `spawn`)
- ✅ Safe libraries: `math`, `random`, `datetime`, `json`, `re`, etc.

### Docker Sandbox:
- Isolated container per execution
- No internet access (network disabled)
- Memory limit: 512MB
- CPU limit: 50% of one core
- Timeout: 30 seconds
- Ephemeral (deleted after execution)

### Audit Trail:
Every task is logged in the database with:
- Original AI suggestion
- User edits
- Execution logs (stdout/stderr)
- Exit codes
- Timestamps
- Screenshot paths

---

## 💡 Tips for Best Results

### 1. **Document Structure**
Format your assignment clearly:
```
Question 1: [Clear question text]

Question 2: [Clear question text]
```

### 2. **Include Context**
If your document has code already, the AI will detect and refine it:
```
Question 1: Fix this code:
```python
def add(a, b)
    return a + b
```
```

### 3. **Theory Questions**
Make questions specific:
- ✅ "Explain recursion in Python with an example"
- ❌ "Recursion"

### 4. **Code Requirements**
Be clear about what you want:
- ✅ "Write a program to sort a list using bubble sort"
- ❌ "Sorting"

---

## 🔄 Workflow Comparison

### Old Manual Workflow (Removed):
1. Upload file
2. Manually review all detected code blocks
3. Manually select which ones to run
4. Execute code
5. Generate report

### New AI Workflow (Current):
1. Upload file
2. **AI automatically analyzes** and suggests tasks
3. **Review AI suggestions**, edit code, answer follow-ups
4. AI executes, generates screenshots, writes answers
5. Download complete report

**Advantages:**
- 🎯 More intelligent task detection
- 📝 AI-generated theory answers
- 🎨 Better context understanding
- ⚡ Fewer manual steps
- 🔍 Can handle questions without code
- 💬 Interactive (AI can ask for clarification)

---

## 📊 Database Schema

### AIJob Table:
```sql
CREATE TABLE ai_jobs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES uploads(id),
    status VARCHAR(20),  -- pending, processing, completed, failed
    theme VARCHAR(20),   -- idle, vscode
    insertion_preference VARCHAR(20),  -- below_question, bottom_of_page
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### AITask Table:
```sql
CREATE TABLE ai_tasks (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES ai_jobs(id),
    task_id VARCHAR(50),
    task_type VARCHAR(30),  -- code_execution, answer_request, screenshot_request
    question_context TEXT,
    suggested_code TEXT,
    user_code TEXT,
    assistant_answer TEXT,
    screenshot_path VARCHAR(500),
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    caption TEXT,
    status VARCHAR(20),  -- pending, processing, completed, failed
    confidence FLOAT,
    insertion_location VARCHAR(30),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

---

## 🚀 Getting Started

1. **Update API Key**: Follow [UPDATE_API_KEY.md](./UPDATE_API_KEY.md)
2. **Start Services**: `docker compose up --build`
3. **Open Browser**: http://localhost:3000
4. **Upload Assignment**: Choose your DOCX/PDF file
5. **Review AI Suggestions**: Edit code, select tasks
6. **Download Report**: Get your completed assignment!

---

## ❓ FAQs

**Q: Can I still run code manually?**  
A: No, the manual workflow has been removed. The AI workflow is smarter and more capable.

**Q: What if the AI misses something?**  
A: You can edit the suggested code or answer the AI's follow-up questions to provide more context.

**Q: Can I use my own code?**  
A: Yes! If your document contains code blocks, the AI will detect and use them. You can also edit any suggested code.

**Q: Is my code safe?**  
A: Yes! All code runs in isolated Docker containers with strict security policies. No network access, no file system writes, limited resources.

**Q: How much does it cost?**  
A: With `gpt-3.5-turbo`, expect ~$0.05-0.15 per assignment. With `gpt-4`, it's ~$0.20-0.50.

**Q: Can I preview before downloading?**  
A: Yes! After execution, you'll see all screenshots and answers. You can reorder, remove, or regenerate before composing the final report.

---

## 🎨 Screenshot Themes

### IDLE Theme (Classic Python):
- Light background (#FFFFFF)
- Blue keywords (#0000FF)
- Green strings (#00A33F)
- Red comments (#DD0000)
- Simple font (Monaco, Consolas)

### VS Code Theme (Modern):
- Dark background (#1E1E1E)
- Orange keywords (#C586C0)
- Green strings (#CE9178)
- Gray comments (#6A9955)
- Modern font (Fira Code, JetBrains Mono)

---

## 📞 Support

If you encounter any issues:
1. Check the [Troubleshooting Guide](./UPDATE_API_KEY.md#troubleshooting)
2. Review backend logs: `docker compose logs backend`
3. Ensure your OpenAI API key has credits
4. Try using `gpt-3.5-turbo` instead of `gpt-4`

---

**Built with ❤️ using FastAPI, Next.js, OpenAI, and Docker**

