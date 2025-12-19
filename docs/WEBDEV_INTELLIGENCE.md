# Web Development Intelligence System

## Overview

The LabMate system now includes intelligent experiment detection and automatic file structure generation for web development assignments. This system automatically recognizes experiment types (Exp 1-9) and generates appropriate file structures with correct screenshot requirements.

## Features

### 1. Experiment Type Detection

The system automatically detects experiment types from assignment text using pattern matching and keyword analysis:

- **Exp 1**: HTML5, CSS, Resume Page Design
- **Exp 2**: HTML Forms, Input Types, Block Elements
- **Exp 3**: JavaScript Basics, DOM Manipulation, Validation, Loops
- **Exp 4**: Arrow Functions, Classes, Constructor, Inheritance
- **Exp 5**: React Setup, Components, Virtual DOM
- **Exp 6**: React Router, SPA Design, Routing Components
- **Exp 7**: Node.js Web Server, HTTP Module, File System Operations
- **Exp 8**: Express.js Cookies, Cookie-Parser
- **Exp 9**: Mini-Project (Complete React SPA)

### 2. Intelligent File Structure Generation

Based on the detected experiment type, the system automatically generates:

#### Exp 1 (HTML/CSS Resume):
- `index.html` - Complete resume page structure
- `styles.css` - Professional styling

#### Exp 2 (HTML Forms):
- `index.html` - Complete form with all input types
- `styles.css` - Form styling

#### Exp 3 (JavaScript Basics):
- `index.html` - Demo page structure
- `script.js` - DOM manipulation, validation, loops examples
- `styles.css` - Styling

#### Exp 4 (JavaScript Advanced):
- `index.html` - Demo page
- `script.js` - Arrow functions, classes, inheritance examples
- `styles.css` - Styling

#### Exp 5 (React Setup):
- `src/App.js` - Main React component
- `src/App.css` - Component styling
- `src/index.js` - Entry point with ReactDOM
- `src/index.css` - Global styles

#### Exp 6 (React Router):
- `src/App.js` - Router setup with BrowserRouter
- `src/App.css` - Navigation and page styling
- `src/index.js` - Entry point
- `src/Home.js` - Home page component
- `src/About.js` - About page component
- `src/Features.js` - Features page component
- Additional pages based on assignment requirements

#### Exp 7 (Node.js Server):
- `server.js` - HTTP server with file system operations
- `index.html` - Client interface
- `package.json` - Dependencies

#### Exp 8 (Express Cookies):
- `server.js` - Express server with cookie-parser
- `public/index.html` - Client interface
- `package.json` - Dependencies

#### Exp 9 (Mini Project):
- Complete React SPA with multiple pages
- `src/App.js` - Router configuration
- `src/Home.js`, `src/About.js`, `src/Features.js`, `src/Contact.js`
- `src/App.css` - Complete styling
- All necessary supporting files

### 3. Automatic Screenshot Requirements

The system automatically determines:
- Which files need screenshots
- Which files need browser output vs. code-only views
- Required routes for React Router projects
- Total screenshot count per experiment

### 4. Example: React Router Project

For a React Router assignment (Exp 6), the system will:

1. **Detect** it's a React Router experiment
2. **Generate** files:
   - `src/App.js` - With BrowserRouter, Routes, Route, Link
   - `src/Home.js` - Home page component
   - `src/About.js` - About page component
   - `src/Features.js` - Features page component
   - `src/App.css` - Navigation and styling
   - `src/index.js` - Entry point
3. **Determine** routes: `["/", "/home", "/about", "/features"]`
4. **Calculate** screenshots needed:
   - Code view: All `.js` and `.jsx` files
   - Browser output: `App.js`, `index.js`, and each route
   - CSS: Code view only

## Implementation Details

### Files Created

1. **`backend/app/services/webdev_intelligence.py`**
   - `WebDevIntelligence` class
   - Experiment detection logic
   - File structure generators
   - Screenshot requirement calculator

2. **Updated `backend/app/services/analysis_service.py`**
   - Integrated intelligence service
   - Enhanced React project handling
   - Automatic experiment detection
   - File structure merging

### How It Works

1. **Document Analysis**: When a webdev assignment is uploaded, the analysis service processes it
2. **Experiment Detection**: The intelligence service analyzes the question text and code snippets
3. **File Generation**: Appropriate file structures are generated based on experiment type
4. **Merging**: AI-generated files are merged with intelligent templates (intelligent files take precedence)
5. **Screenshot Planning**: Screenshot requirements are calculated automatically

### Integration Points

The intelligence system integrates at the analysis stage:

```python
# In analysis_service.py
exp_type = self.webdev_intelligence.detect_experiment_type(question_context, code_snippet)
intelligent_files = self.webdev_intelligence.get_required_files(exp_type, question_text)
routes, file_screenshots = self.webdev_intelligence.get_screenshot_requirements(exp_type, intelligent_files)
```

## Benefits

1. **Consistency**: All experiments follow standard file structures
2. **Completeness**: All necessary files are generated automatically
3. **Accuracy**: Screenshot requirements are calculated precisely
4. **Flexibility**: System adapts to different experiment types
5. **Intelligence**: Understands context and generates appropriate code

## Future Enhancements

- Support for additional experiment types
- Custom file templates per institution
- Enhanced pattern matching for better detection
- Support for TypeScript React projects
- Integration with Google Colab for data science experiments

## Usage

The system works automatically - no configuration needed. When a web development assignment is uploaded:

1. The system detects the experiment type
2. Generates appropriate file structure
3. Determines screenshot requirements
4. Creates all necessary files
5. Executes and captures screenshots

All of this happens automatically based on the assignment content!

