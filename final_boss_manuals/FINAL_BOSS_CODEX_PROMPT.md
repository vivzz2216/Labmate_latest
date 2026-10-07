# 👑 FINAL BOSS LEVEL END-TO-END QA & SELF-HEALING TEST SUITE FOR LABMATE

> **Agent Directive:** You are deployed as the **Lead Systems & Autonomous QA Engineer (Final Boss Mode)**.
> **LLM Model Mandate:** Use **`gpt-oss`** for all code generation, analysis, and reasoning operations.
> **Core Mission:** Execute end-to-end stress testing of **LabMate** across all **20 comprehensive laboratory manuals** (Python, Java, C, C++ DSA, Web Dev). If any failure, exception, unhandled edge-case, timeout, or visual defect occurs, you MUST autonomously diagnose the root cause, modify the codebase in-place, and re-run until all 20 manuals achieve a **100% pass rate**.

---

## 📂 TEST DATASET: 20 GENERATED LABORATORY MANUALS

The 20 complete laboratory manuals are pre-generated and located on the system at:
`C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\`

### 1. Python Lab Manuals (5 Manuals - Target Theme: Python IDLE)
1. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\python\python_manual_1_basics_control_flow.docx`
   - *Topics:* Fibonacci sequence, prime numbers in range, multi-operation menu-driven calculator.
2. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\python\python_manual_2_functions_recursion.docx`
   - *Topics:* Recursive Tower of Hanoi, string palindrome with lambda/filtering, recursive GCD & LCM.
3. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\python\python_manual_3_data_structures.docx`
   - *Topics:* List deduplication & sorting, dictionary word frequency counter, set intersection/union.
4. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\python\python_manual_4_oop_exceptions.docx`
   - *Topics:* Bank account class hierarchy, custom `InsufficientFundsException`, vehicle polymorphism.
5. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\python\python_manual_5_file_handling_modules.docx`
   - *Topics:* Student CSV file processing, file word/line counter, custom geometry math module.

---

### 2. Java Lab Manuals (5 Manuals - Target Theme: Windows Notepad)
1. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\java\java_manual_1_fundamentals_arrays.docx`
   - *Topics:* Matrix multiplication, 1D array linear & binary search, Armstrong number verification.
2. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\java\java_manual_2_oop_inheritance.docx`
   - *Topics:* Multilevel inheritance (Staff/Faculty/Salary), shape area interfaces, method overloading vs overriding.
3. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\java\java_manual_3_exception_multithreading.docx`
   - *Topics:* Custom `InvalidAgeException`, Producer-Consumer synchronized thread pipeline, multi-threaded table printer.
4. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\java\java_manual_4_collections_framework.docx`
   - *Topics:* Student management `ArrayList` with `Comparator`, phone book `HashMap`, bracket balance `Stack`.
5. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\java\java_manual_5_file_io_streams.docx`
   - *Topics:* Character stream file copier (`FileReader`/`FileWriter`), object serialization / deserialization, student binary record `DataOutputStream`.

---

### 3. C & C++ DSA Lab Manuals (5 Manuals: 2 C, 3 C++ - Target Theme: Code::Blocks)
1. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\c_cpp\c_manual_1_arrays_strings_pointers.docx`
   - *Topics:* Pointer arithmetic array reversal, dynamic memory allocation (`malloc`/`free`) average/max, string manual concatenation & length.
2. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\c_cpp\c_manual_2_structures_file_io.docx`
   - *Topics:* Student record structures with total/grade calculation, banking system with file persistence (`fopen`/`fread`/`fwrite`), nested book structure.
3. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\c_cpp\cpp_manual_1_stacks_and_queues.docx`
   - *DSA Topics:* Menu-driven array/linked-list Stack (Push, Pop, Peek, Display), Circular Queue with overflow/underflow, Infix to Postfix expression conversion.
4. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\c_cpp\cpp_manual_2_trees_bst_traversals.docx`
   - *DSA Topics:* Interactive Binary Search Tree (Insert, Search, Delete, Height, Count), Recursive & Iterative Inorder, Preorder, Postorder traversals, Level-order BFS traversal.
5. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\c_cpp\cpp_manual_3_graphs_dijkstra_traversals.docx`
   - *DSA Topics:* Adjacency list/matrix graph representation from user input, Breadth First Search (BFS), Depth First Search (DFS), Dijkstra's single-source shortest path algorithm.

---

### 4. Web Development Lab Manuals (5 Manuals - Target Theme: VS Code + Chrome Browser Preview)
1. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\webdev\webdev_manual_1_semantic_html_css_flex_grid.docx`
   - *Topics:* Semantic HTML5 student portal layout, CSS Flexbox & CSS Grid product gallery card grid, responsive CSS navigation bar.
2. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\webdev\webdev_manual_2_javascript_dom_events_validation.docx`
   - *Topics:* Client-side registration form with regex validation, dynamic interactive task list (DOM manipulation), real-time currency/temperature converter.
3. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\webdev\webdev_manual_3_react_components_props_state.docx`
   - *Topics:* React component tree counter with step increment, user profile card with dynamic props, conditional rendering accordion.
4. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\webdev\webdev_manual_4_react_todo_localstorage.docx`
   - *Topics:* Full React Todo app with filter tabs (All/Active/Completed) and `localStorage`, API user fetcher with loading/error state (`useEffect`), shopping cart badge counter.
5. `C:\Users\pilla\OneDrive\Desktop\labmate_latest\final_boss_manuals\webdev\webdev_manual_5_nodejs_express_rest_cookies.docx`
   - *Topics:* Express.js RESTful API for books (GET, POST, PUT, DELETE), cookie-based session/auth handler (`cookie-parser`), request logging middleware.

---

## 🎯 MANDATORY VERIFICATION CRITERIA

For each manual processed through LabMate, enforce the following pipeline rules:

### 1. Document Extraction & Question Filtering
- **Section A Exemption:** Verify that Section A (Theory Questions & Viva Voce) is **completely ignored** by `backend/app/services/lab_question_filter.py`. No code or screenshots should be generated for theoretical discussion questions.
- **Section B Extraction:** Verify that all 3 laboratory programming tasks in Section B are correctly extracted with their titles, descriptions, and programming constraints.

### 2. Strict UI Theme Enforcement
Verify that the rendered screenshots match the exact assigned IDE/UI:
- **Python Manuals:** Must render using **Python IDLE Theme** (`backend/templates/idle_theme.html`).
- **Java Manuals:** Must render using **Windows Notepad Theme** (`backend/templates/notepad_theme.html`).
- **C & C++ Manuals:** Must render using **Code::Blocks Theme** (`backend/templates/codeblocks_theme.html`).
- **Web Development Manuals:**
  - Code Editor: Must render using **VS Code Theme** (`backend/templates/vscode_theme.html`) featuring:
    - Left Activity Bar + Explorer Sidebar with `> OUTLINE` & `> TIMELINE` footers.
    - Integrated Terminal strictly nested underneath the editor code window (not spanning across the sidebar).
    - Color palette `#1e1e1e` (editor), `#252526` (explorer), `#181818` (terminal).
  - Web Output: Must render realistic browser rendered results using **Browser Preview Theme** (`backend/templates/browser_preview_theme.html`).

### 3. Interactive Code Execution & Input Simulation (Crucial for DSA)
- Trees, Graphs, Stacks, Queues, and Menu-driven programs in C++ take interactive `std::cin` inputs.
- Ensure the execution engine or code runner provides valid simulated test inputs (e.g. `1 50 1 30 1 70 2 30 4 5`) so the program runs to completion without hanging or timing out.

### 4. Word Document Assembly
- Ensure the finalized output document (`.docx`) includes:
  - College & Lab Title Header.
  - Experiment Name and Problem Statement.
  - Formatted Source Code block.
  - High-resolution embedded screenshots (both IDE code view and executed terminal/browser output view).
  - Clean page breaks between experiments.

---

## 🛠️ AUTONOMOUS SELF-HEALING INSTRUCTIONS ("IF ERROR, FIX IT")

If any error occurs during ingestion, parsing, LLM generation, compilation, execution, screenshot generation, or Word document export:

1. **Check Logs Immediately:**
   - Backend terminal logs or `backend/app/` debug logs.
   - Trace the exact line of code in FastAPI routers, services, or Playwright screenshot scripts.
2. **Diagnose and Fix In-Place:**
   - If a prompt causes `gpt-oss` to produce unparseable markdown, update the prompt parser in `backend/app/services/llm_service.py`.
   - If Playwright fails to render or times out on Chromium launch, verify headless launch arguments (`--no-sandbox`, `--disable-dev-shm-usage`).
   - If regex in `lab_question_filter.py` drops a valid lab question, adjust regex patterns to match the heading.
   - If C/C++ compilation fails on missing headers or input EOF, inject appropriate fallback inputs.
3. **Verify Fix:**
   - Re-run the failed manual immediately to confirm successful completion.
   - Proceed through remaining manuals until all 20 succeed without a single fatal error.

---

## 🚀 EXECUTION COMMAND

Run the comprehensive test across the backend:
```bash
# 1. Activate backend environment
cd C:\Users\pilla\OneDrive\Desktop\labmate_latest\backend
.\.venv\Scripts\activate

# 2. Run the test script or manual pipeline runner targeting all 20 files
python -m pytest tests/ -v
# OR run the custom batch verification script against final_boss_manuals
```

**Proceed to execute the test suite, report progress per manual, fix any bugs encountered, and provide the final sign-off once all 20 manuals are successfully validated!**
