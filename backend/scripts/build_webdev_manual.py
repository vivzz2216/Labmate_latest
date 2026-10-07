"""
build_webdev_manual.py  (v2 — Real Output Edition)
====================================================
Fixes:
 1. VS Code template now has FIXED height editor + always-visible 220px terminal
 2. Each HTML/CSS/JS exercise gets a BROWSER PREVIEW screenshot showing rendered page
 3. React exercises get browser preview showing running app UI
 4. Node.js exercises show full terminal with realistic HTTP/cookie output
 5. Code uses real student-style comments, realistic variable names, realistic npm logs
"""

import asyncio
import os
import sys
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from markupsafe import Markup

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.screenshot_service import ScreenshotService

service = ScreenshotService()
OUTPUT_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "..", "test_screenshots", "webdev_manual"
))
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Rendered browser HTML for each exercise (what the browser actually shows)
# ─────────────────────────────────────────────────────────────────────────────

BROWSER_RENDERS = {

    "ex1_form": """
<style>
  body{font-family:'Segoe UI',sans-serif;background:#f0f4f8;display:flex;justify-content:center;align-items:center;min-height:440px;margin:0}
  .card{background:#fff;padding:2rem 2.5rem;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);width:360px}
  h2{color:#1e293b;font-size:1.3rem;margin-bottom:1.2rem}
  .field{margin-bottom:1rem}
  label{display:block;font-size:.82rem;color:#475569;margin-bottom:4px;font-weight:500}
  input{width:100%;padding:.5rem .75rem;border:1.5px solid #cbd5e1;border-radius:6px;font-size:.9rem;outline:none;font-family:inherit}
  input.valid{border-color:#22c55e;background:#f0fdf4}
  input.invalid{border-color:#ef4444;background:#fef2f2}
  .err{font-size:.75rem;color:#ef4444;margin-top:2px;min-height:14px}
  button{width:100%;padding:.6rem;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:.95rem;cursor:pointer;margin-top:.4rem;font-family:inherit}
  .success{color:#16a34a;font-weight:600;text-align:center;margin-top:.7rem;font-size:.9rem}
</style>
<div class="card">
  <h2>Create Account</h2>
  <div class="field">
    <label>Full Name</label>
    <input class="valid" value="Alex Kumar" />
    <div class="err"></div>
  </div>
  <div class="field">
    <label>Email</label>
    <input class="valid" value="alex@example.com" />
    <div class="err"></div>
  </div>
  <div class="field">
    <label>Password</label>
    <input type="password" class="valid" value="securepass" />
    <div class="err"></div>
  </div>
  <button>Register</button>
  <p class="success">✅ Account created successfully! Redirecting...</p>
</div>
""",

    "ex1_validation_error": """
<style>
  body{font-family:'Segoe UI',sans-serif;background:#f0f4f8;display:flex;justify-content:center;align-items:center;min-height:440px;margin:0}
  .card{background:#fff;padding:2rem 2.5rem;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);width:360px}
  h2{color:#1e293b;font-size:1.3rem;margin-bottom:1.2rem}
  .field{margin-bottom:1rem}
  label{display:block;font-size:.82rem;color:#475569;margin-bottom:4px;font-weight:500}
  input{width:100%;padding:.5rem .75rem;border:1.5px solid #ef4444;border-radius:6px;font-size:.9rem;outline:none;background:#fef2f2;font-family:inherit}
  .err{font-size:.75rem;color:#ef4444;margin-top:2px}
  button{width:100%;padding:.6rem;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:.95rem;cursor:pointer;margin-top:.4rem}
</style>
<div class="card">
  <h2>Create Account</h2>
  <div class="field">
    <label>Full Name</label>
    <input value="A" />
    <div class="err">⚠ Name must be at least 2 characters.</div>
  </div>
  <div class="field">
    <label>Email</label>
    <input value="notanemail" />
    <div class="err">⚠ Please enter a valid email address.</div>
  </div>
  <div class="field">
    <label>Password</label>
    <input type="password" value="123" />
    <div class="err">⚠ Password must be at least 8 characters.</div>
  </div>
  <button>Register</button>
</div>
""",

    "ex2_navbar": """
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#fff}
  .navbar{background:#1e293b;padding:0 2rem;display:flex;align-items:center;justify-content:space-between;height:56px}
  .brand{color:#fff;font-weight:700;font-size:1.2rem;letter-spacing:.5px}
  .nav-links{list-style:none;display:flex;gap:2rem}
  .nav-links li a{color:#cbd5e1;text-decoration:none;font-size:.9rem;padding:4px 0;transition:color .2s}
  .nav-links li a:hover{color:#fff}
  .dropdown{position:relative}
  .dropdown-menu{display:block;position:absolute;top:100%;left:0;background:#0f172a;border-radius:6px;padding:.4rem 0;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,.3);margin-top:8px}
  .dropdown-menu li a{display:block;padding:.45rem 1rem;color:#94a3b8;font-size:.85rem}
  .dropdown-menu li a:hover{background:#1e293b;color:#fff}
  .hero{padding:3rem 2rem;background:linear-gradient(135deg,#1e293b 0%,#3b82f6 100%);color:#fff;text-align:center;min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .hero h1{font-size:2rem;margin-bottom:.8rem}
  .hero p{color:#cbd5e1;font-size:1rem}
</style>
<nav class="navbar">
  <div class="brand">LabMate</div>
  <ul class="nav-links">
    <li><a href="#">Home</a></li>
    <li class="dropdown">
      <a href="#">Courses ▾</a>
      <ul class="dropdown-menu">
        <li><a href="#">HTML &amp; CSS</a></li>
        <li><a href="#">JavaScript</a></li>
        <li><a href="#">React</a></li>
      </ul>
    </li>
    <li><a href="#">About</a></li>
    <li><a href="#">Contact</a></li>
  </ul>
</nav>
<div class="hero">
  <h1>Welcome to LabMate</h1>
  <p>Your interactive coding laboratory platform.</p>
</div>
""",

    "ex3_counter": """
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#f8fafc;display:flex;justify-content:center;align-items:center;min-height:440px}
  .counter-card{background:#fff;padding:2.5rem;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.10);text-align:center;width:300px}
  h1{font-size:1.4rem;color:#1e293b;margin-bottom:1.5rem}
  .display{font-size:4rem;font-weight:700;color:#3b82f6;margin:1rem 0;line-height:1}
  .btn-group{display:flex;gap:.6rem;justify-content:center;margin:1rem 0}
  .btn{padding:.6rem 1.4rem;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer}
  .btn-dec{background:#ef4444;color:#fff}
  .btn-reset{background:#e2e8f0;color:#475569}
  .btn-inc{background:#3b82f6;color:#fff}
  .history{margin-top:1.2rem;text-align:left}
  .history h3{font-size:.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.5rem}
  .history ul{list-style:none;font-size:.82rem}
  .history li{padding:.25rem 0;border-bottom:1px solid #f1f5f9;color:#475569}
  .tag{background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 6px;font-size:.75rem;font-weight:600}
</style>
<div class="counter-card">
  <h1>React Counter</h1>
  <div class="display">2</div>
  <div class="btn-group">
    <button class="btn btn-dec">−</button>
    <button class="btn btn-reset">Reset</button>
    <button class="btn btn-inc">+</button>
  </div>
  <div class="history">
    <h3>Action History</h3>
    <ul>
      <li><span class="tag">Increment</span> → 2 <small style="color:#94a3b8">3:05:12 AM</small></li>
      <li><span class="tag">Increment</span> → 1 <small style="color:#94a3b8">3:05:10 AM</small></li>
      <li><span class="tag">Reset</span> → 0 <small style="color:#94a3b8">3:05:08 AM</small></li>
    </ul>
  </div>
</div>
""",

    "ex4_todo": """
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#f8fafc;display:flex;justify-content:center;align-items:center;min-height:440px}
  .todo-app{background:#fff;padding:2rem;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.10);width:380px}
  h1{font-size:1.3rem;color:#1e293b;margin-bottom:1.2rem}
  .add-form{display:flex;gap:.5rem;margin-bottom:1rem}
  .add-form input{flex:1;padding:.5rem .75rem;border:1.5px solid #cbd5e1;border-radius:8px;font-size:.9rem;outline:none;font-family:inherit}
  .add-form button{padding:.5rem 1rem;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
  .filters{display:flex;gap:.4rem;margin-bottom:1rem}
  .filters button{padding:.3rem .9rem;border:1.5px solid #e2e8f0;border-radius:20px;font-size:.8rem;cursor:pointer;background:#fff;color:#64748b}
  .filters button.active{background:#3b82f6;color:#fff;border-color:#3b82f6}
  .todo-list{list-style:none}
  .todo-item{display:flex;align-items:center;gap:.7rem;padding:.5rem 0;border-bottom:1px solid #f1f5f9}
  .todo-item.done .todo-text{text-decoration:line-through;color:#94a3b8}
  .todo-text{flex:1;font-size:.9rem;color:#374151}
  .del-btn{color:#ef4444;border:none;background:none;cursor:pointer;font-size:.9rem}
  .footer{font-size:.8rem;color:#94a3b8;margin-top:.8rem;text-align:center}
</style>
<div class="todo-app">
  <h1>📋 Todo List</h1>
  <div class="add-form">
    <input placeholder="Add a task..." />
    <button>Add</button>
  </div>
  <div class="filters">
    <button class="active">All</button>
    <button>Active</button>
    <button>Done</button>
  </div>
  <ul class="todo-list">
    <li class="todo-item done">
      <input type="checkbox" checked />
      <span class="todo-text">Buy groceries</span>
      <button class="del-btn">✕</button>
    </li>
    <li class="todo-item">
      <input type="checkbox" />
      <span class="todo-text">Study React Hooks</span>
      <button class="del-btn">✕</button>
    </li>
    <li class="todo-item">
      <input type="checkbox" />
      <span class="todo-text">Submit lab assignment</span>
      <button class="del-btn">✕</button>
    </li>
  </ul>
  <p class="footer">2 tasks remaining</p>
</div>
""",
}


# ─────────────────────────────────────────────────────────────────────────────
# EXERCISES (with realistic terminal output that looks like real dev sessions)
# ─────────────────────────────────────────────────────────────────────────────

EXERCISES = [

    # ── SECTION 1: HTML / CSS / JavaScript ──────────────────────────────────

    {
        "title": "Exercise 1: Registration Form with Client-Side Validation",
        "section": "html_css_js",
        "aim": "Create an HTML registration form that validates Name, Email, and Password fields using JavaScript before submission, showing inline error messages.",
        "theory": (
            "HTML forms collect user data via input elements. CSS styles inputs and provides visual feedback "
            "(red border for errors, green for valid fields). JavaScript validates fields using regex and "
            "length checks. The submit event is intercepted with preventDefault() to stop form submission "
            "if validation fails. Real-time validation is applied using input events."
        ),
        "files": [
            {
                "filename": "index.html",
                "label": "index.html — HTML Form Structure",
                "code": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Form</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="form-wrapper">
    <h2>Create Account</h2>
    <form id="regForm">
      <div class="field">
        <label for="name">Full Name</label>
        <input type="text" id="name" placeholder="Enter full name">
        <span class="error" id="nameErr"></span>
      </div>
      <div class="field">
        <label for="email">Email Address</label>
        <input type="email" id="email" placeholder="you@example.com">
        <span class="error" id="emailErr"></span>
      </div>
      <div class="field">
        <label for="pass">Password</label>
        <input type="password" id="pass" placeholder="Min 8 characters">
        <span class="error" id="passErr"></span>
      </div>
      <button type="submit">Register</button>
      <p class="success" id="success"></p>
    </form>
  </div>
  <script src="validate.js"></script>
</body>
</html>""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> npx live-server --port=5500\n'
                    '<span class="tc-dim">Starting up http-server, serving ./ </span>\n'
                    '<span class="tc-dim">Available on:</span>\n'
                    '<span class="tc-cyan">  http://127.0.0.1:5500</span>\n'
                    '<span class="tc-dim">  http://192.168.1.5:5500</span>\n'
                    '<span class="tc-dim">Hit CTRL-C to stop the server</span>\n'
                    '<span class="tc-green">[Live Server] Browser connected</span>\n'
                    '<span class="tc-green">[Live Server] index.html → 200 OK</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": BROWSER_RENDERS["ex1_form"],
                "browser_caption": "Browser Output: Registration form with valid fields — success state",
            },
            {
                "filename": "validate.js",
                "label": "validate.js — JavaScript Validation Logic",
                "code": """// validate.js — Client-side form validation
// Author: Student Lab Assignment

const form    = document.getElementById('regForm');
const nameEl  = document.getElementById('name');
const emailEl = document.getElementById('email');
const passEl  = document.getElementById('pass');

// Helper: mark field as invalid
function setError(input, errId, message) {
  document.getElementById(errId).textContent = message;
  input.classList.remove('valid');
  input.classList.add('invalid');
}

// Helper: mark field as valid
function setValid(input, errId) {
  document.getElementById(errId).textContent = '';
  input.classList.remove('invalid');
  input.classList.add('valid');
}

// Main validation function — returns true if all fields pass
function validateForm() {
  let isValid = true;

  // Rule 1: Name must be at least 2 characters
  if (nameEl.value.trim().length < 2) {
    setError(nameEl, 'nameErr', 'Name must be at least 2 characters.');
    isValid = false;
  } else {
    setValid(nameEl, 'nameErr');
  }

  // Rule 2: Email must match standard format
  const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!emailPattern.test(emailEl.value.trim())) {
    setError(emailEl, 'emailErr', 'Please enter a valid email address.');
    isValid = false;
  } else {
    setValid(emailEl, 'emailErr');
  }

  // Rule 3: Password must be at least 8 characters
  if (passEl.value.length < 8) {
    setError(passEl, 'passErr', 'Password must be at least 8 characters.');
    isValid = false;
  } else {
    setValid(passEl, 'passErr');
  }

  return isValid;
}

// On form submit
form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (validateForm()) {
    document.getElementById('success').textContent =
      '✅ Account created successfully! Redirecting...';
    console.log('[Form] Submitted OK:', emailEl.value);
  }
});

// Real-time validation as user types
[nameEl, emailEl, passEl].forEach(el =>
  el.addEventListener('input', validateForm)
);

console.log('[Form] Validation script loaded and ready.');""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> npx live-server --port=5500\n'
                    '<span class="tc-green">[Live Server] validate.js → 200 OK</span>\n\n'
                    '<span class="tc-dim">— Browser Console Output —</span>\n'
                    '<span class="tc-white">[Form] Validation script loaded and ready.</span>\n'
                    '<span class="tc-dim">[Input] name  → "A" → INVALID: min 2 chars</span>\n'
                    '<span class="tc-dim">[Input] name  → "Alex Kumar" → VALID ✓</span>\n'
                    '<span class="tc-dim">[Input] email → "notanemail" → INVALID: format</span>\n'
                    '<span class="tc-dim">[Input] email → "alex@example.com" → VALID ✓</span>\n'
                    '<span class="tc-dim">[Input] pass  → "123" → INVALID: min 8 chars</span>\n'
                    '<span class="tc-dim">[Input] pass  → "securepass" → VALID ✓</span>\n'
                    '<span class="tc-green">[Form] Submitted OK: alex@example.com</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": BROWSER_RENDERS["ex1_validation_error"],
                "browser_caption": "Browser Output: validation errors shown in red when fields are invalid",
            },
        ]
    },

    {
        "title": "Exercise 2: Responsive Navigation Bar with Dropdown",
        "section": "html_css_js",
        "aim": "Build a responsive navigation bar with a hamburger menu toggle and an animated dropdown submenu using HTML, CSS, and JavaScript.",
        "theory": (
            "A responsive navbar adapts layout for mobile and desktop viewports using CSS Flexbox and "
            "media queries. The hamburger button (visible only on small screens) toggles a CSS class "
            "to show/hide the nav links. JavaScript class manipulation replaces page reloads, "
            "making interactions instant and smooth."
        ),
        "files": [
            {
                "filename": "navbar.html",
                "label": "navbar.html — Responsive Navigation Structure",
                "code": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Responsive Navigation Bar</title>
  <link rel="stylesheet" href="navbar.css">
</head>
<body>
  <nav class="navbar">
    <div class="brand">LabMate</div>
    <button class="hamburger" id="menuBtn" aria-label="Toggle menu">&#9776;</button>
    <ul class="nav-links" id="navLinks">
      <li><a href="#">Home</a></li>
      <li class="has-dropdown">
        <a href="#">Courses &#9660;</a>
        <ul class="dropdown-menu">
          <li><a href="#">HTML &amp; CSS</a></li>
          <li><a href="#">JavaScript</a></li>
          <li><a href="#">React.js</a></li>
          <li><a href="#">Node.js</a></li>
        </ul>
      </li>
      <li><a href="#">About</a></li>
      <li><a href="#">Contact</a></li>
    </ul>
  </nav>
  <main class="hero">
    <h1>Welcome to LabMate</h1>
    <p>Your interactive coding laboratory platform.</p>
    <a href="#" class="cta-btn">Get Started</a>
  </main>
  <script src="navbar.js"></script>
</body>
</html>""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> npx live-server .\n'
                    '<span class="tc-dim">Serving /web-dev-lab at</span> <span class="tc-cyan">http://127.0.0.1:5500</span>\n'
                    '<span class="tc-green">[live-server] Browser opened</span>\n'
                    '<span class="tc-green">[live-server] navbar.html → 200 OK (1.2 KB)</span>\n'
                    '<span class="tc-green">[live-server] navbar.css  → 200 OK (2.1 KB)</span>\n'
                    '<span class="tc-green">[live-server] navbar.js   → 200 OK (0.9 KB)</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": BROWSER_RENDERS["ex2_navbar"],
                "browser_caption": "Browser Output: navbar with 'Courses' dropdown expanded",
            },
            {
                "filename": "navbar.js",
                "label": "navbar.js — Toggle & Dropdown JavaScript",
                "code": """// navbar.js — Responsive nav toggle and dropdown
// Handles: hamburger menu, dropdown on click, close on outside click

const menuBtn   = document.getElementById('menuBtn');
const navLinks  = document.getElementById('navLinks');
const dropdowns = document.querySelectorAll('.has-dropdown');

// Toggle mobile menu open/close
menuBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  const isOpen = navLinks.classList.toggle('open');
  menuBtn.innerHTML = isOpen ? '&#10005;' : '&#9776;';
  console.log('[NavBar] Mobile menu:', isOpen ? 'OPEN' : 'CLOSED');
});

// Toggle individual dropdown submenus
dropdowns.forEach(function(drop) {
  drop.addEventListener('click', function(e) {
    e.stopPropagation();
    const wasActive = drop.classList.contains('active');
    // Close all dropdowns first
    dropdowns.forEach(d => d.classList.remove('active'));
    if (!wasActive) {
      drop.classList.add('active');
      console.log('[NavBar] Dropdown opened:', drop.querySelector('a').textContent.trim());
    }
  });
});

// Close everything when user clicks outside navbar
document.addEventListener('click', function() {
  navLinks.classList.remove('open');
  dropdowns.forEach(d => d.classList.remove('active'));
  menuBtn.innerHTML = '&#9776;';
});

// Log viewport info on load
console.log('[NavBar] Initialized | Viewport:', window.innerWidth + 'x' + window.innerHeight);
console.log('[NavBar] Screen mode:', window.innerWidth > 768 ? 'Desktop' : 'Mobile');""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> npx eslint navbar.js\n'
                    '<span class="tc-white">[NavBar] Initialized | Viewport: 1366x768</span>\n'
                    '<span class="tc-white">[NavBar] Screen mode: Desktop</span>\n\n'
                    '<span class="tc-dim">— User Interaction Log —</span>\n'
                    '<span class="tc-cyan">[NavBar] Dropdown opened: Courses ▾</span>\n'
                    '<span class="tc-dim">[NavBar] Dropdown closed (outside click)</span>\n'
                    '<span class="tc-cyan">[NavBar] Mobile menu: OPEN (hamburger)</span>\n'
                    '<span class="tc-dim">[NavBar] Mobile menu: CLOSED</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\web-dev-lab&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": None,  # Already done with HTML file above
                "browser_caption": None,
            },
        ]
    },

    # ── SECTION 2: React ─────────────────────────────────────────────────────

    {
        "title": "Exercise 3: Counter App with useState Hook",
        "section": "react",
        "aim": "Build a React counter application with increment, decrement and reset operations using the useState hook. Log action history.",
        "theory": (
            "React is a declarative UI library based on reusable components. The useState hook "
            "stores local component state — when called, it returns a [state, setter] pair. Calling "
            "the setter triggers a re-render with the new value. React's Virtual DOM diffs only the "
            "changed parts, making updates efficient. JSX allows HTML-like syntax inside JavaScript."
        ),
        "files": [
            {
                "filename": "App.jsx",
                "label": "App.jsx — Counter Component with useState",
                "code": """// App.jsx — Counter component using useState hook
import { useState } from 'react';
import './App.css';

// Counter component — manages count state and action history
function Counter() {
  const [count,   setCount]   = useState(0);      // current count value
  const [history, setHistory] = useState([]);      // list of past actions

  // Update count by delta (+1 or -1) and record in history
  function updateCount(delta, actionName) {
    const newCount = count + delta;
    setCount(newCount);
    setHistory(prev => [
      { action: actionName, value: newCount, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 4)                          // keep last 5 entries
    ]);
  }

  // Reset count to 0
  function resetCount() {
    setCount(0);
    setHistory(prev => [
      { action: 'Reset', value: 0, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 4)
    ]);
  }

  // Determine display color class
  const displayClass = count < 0 ? 'negative' : count > 0 ? 'positive' : 'zero';

  return (
    <div className="counter-card">
      <h1>React Counter</h1>
      <div className={`display ${displayClass}`}>{count}</div>
      <div className="btn-group">
        <button className="btn btn-dec" onClick={() => updateCount(-1, 'Decrement')}>−</button>
        <button className="btn btn-reset" onClick={resetCount}>Reset</button>
        <button className="btn btn-inc" onClick={() => updateCount(+1, 'Increment')}>+</button>
      </div>
      {history.length > 0 && (
        <div className="history">
          <h3>Action History</h3>
          <ul>
            {history.map((entry, i) => (
              <li key={i}>
                <span className="tag">{entry.action}</span>
                &nbsp;&rarr; {entry.value}&nbsp;
                <small>{entry.time}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Root App component
export default function App() {
  return (
    <main className="app">
      <Counter />
    </main>
  );
}""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\react-todo-app&gt;</span> npm run dev\n\n'
                    '<span class="tc-dim">&gt; react-todo-app@0.1.0 dev</span>\n'
                    '<span class="tc-dim">&gt; vite</span>\n\n'
                    '<span class="tc-green">  VITE v4.5.0</span>  ready in <span class="tc-white">312 ms</span>\n\n'
                    '  <span class="tc-dim">&#10145;</span>  <span class="tc-white">Local:  </span> <span class="tc-cyan">http://localhost:5173/</span>\n'
                    '  <span class="tc-dim">&#10145;</span>  <span class="tc-dim">Network: use --host to expose</span>\n\n'
                    '<span class="tc-dim">[React DevTools] App mounted successfully</span>\n'
                    '<span class="tc-dim">[useState] count initialized: 0</span>\n'
                    '<span class="tc-dim">[useState] count updated: 1 (Increment)</span>\n'
                    '<span class="tc-dim">[useState] count updated: 2 (Increment)</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\react-todo-app&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": BROWSER_RENDERS["ex3_counter"],
                "browser_caption": "Browser Output: Counter at 2 with action history showing",
            },
        ]
    },

    {
        "title": "Exercise 4: Todo List with useEffect & localStorage",
        "section": "react",
        "aim": "Create a Todo List React app that persists tasks across browser refreshes using localStorage, synchronized via the useEffect hook.",
        "theory": (
            "useEffect is React's hook for handling side effects — actions that happen after a render, "
            "like API calls, subscriptions, or browser storage access. The dependency array [todos] "
            "means the effect runs only when the todos array changes, not on every render. "
            "The lazy initializer in useState(() => JSON.parse(localStorage.getItem(...))) "
            "runs only once on mount, reading the persisted data efficiently."
        ),
        "files": [
            {
                "filename": "TodoApp.jsx",
                "label": "TodoApp.jsx — Todo List with useEffect + localStorage",
                "code": """// TodoApp.jsx — Persistent Todo List using useEffect
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'labmate_todos';

// Individual todo item component
function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <li className={`todo-item ${todo.done ? 'done' : ''}`}>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
      />
      <span className="todo-text">{todo.text}</span>
      <button className="del-btn" onClick={() => onDelete(todo.id)}>✕</button>
    </li>
  );
}

// Main TodoApp component
export default function TodoApp() {
  // Lazy initializer: reads from localStorage only on first mount
  const [todos, setTodos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input,  setInput]  = useState('');
  const [filter, setFilter] = useState('all');  // all | active | done

  // Side effect: persist todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    console.log('[Effect] Synced', todos.length, 'todos to localStorage');
  }, [todos]);  // dependency array: re-runs only when todos changes

  // Add new todo
  const addTodo = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newTodo = { id: Date.now(), text: input.trim(), done: false };
    setTodos(prev => [...prev, newTodo]);
    setInput('');
    console.log('[Todo] Added:', newTodo.text);
  };

  // Toggle completion status
  const toggleTodo = (id) =>
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  // Delete a todo by id
  const deleteTodo = (id) =>
    setTodos(prev => prev.filter(t => t.id !== id));

  // Filter todos based on active tab
  const visible = todos.filter(t =>
    filter === 'active' ? !t.done :
    filter === 'done'   ?  t.done : true
  );

  const remaining = todos.filter(t => !t.done).length;

  return (
    <div className="todo-app">
      <h1>&#128203; Todo List</h1>
      <form className="add-form" onSubmit={addTodo}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a new task..."
        />
        <button type="submit">Add</button>
      </form>
      <div className="filters">
        {['all', 'active', 'done'].map(f => (
          <button
            key={f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <ul className="todo-list">
        {visible.length === 0
          ? <li className="empty">No tasks here!</li>
          : visible.map(t => (
              <TodoItem key={t.id} todo={t} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))
        }
      </ul>
      <p className="footer">{remaining} task{remaining !== 1 ? 's' : ''} remaining</p>
    </div>
  );
}""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\react-todo-app&gt;</span> npm run dev\n\n'
                    '<span class="tc-dim">&gt; react-todo-app@0.1.0 dev</span>\n'
                    '<span class="tc-dim">&gt; vite</span>\n\n'
                    '<span class="tc-green">  VITE v4.5.0</span>  ready in <span class="tc-white">289 ms</span>\n'
                    '  <span class="tc-dim">&#10145;</span>  <span class="tc-white">Local:  </span> <span class="tc-cyan">http://localhost:5173/</span>\n\n'
                    '<span class="tc-white">[Effect] Synced 0 todos to localStorage</span>  <span class="tc-dim">(initial mount)</span>\n'
                    '<span class="tc-white">[Todo] Added: Buy groceries</span>\n'
                    '<span class="tc-white">[Effect] Synced 1 todos to localStorage</span>\n'
                    '<span class="tc-white">[Todo] Added: Study React Hooks</span>\n'
                    '<span class="tc-white">[Effect] Synced 2 todos to localStorage</span>\n'
                    '<span class="tc-yellow">&#9998; localStorage key: labmate_todos</span>\n'
                    '<span class="tc-dim">  Data persists across page refreshes ✓</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\react-todo-app&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": BROWSER_RENDERS["ex4_todo"],
                "browser_caption": "Browser Output: Todo list — 'Buy groceries' checked done, 2 tasks remaining",
            },
        ]
    },

    # ── SECTION 3: Node.js ────────────────────────────────────────────────────

    {
        "title": "Exercise 5: REST API Server with Express.js",
        "section": "node",
        "aim": "Create a Node.js REST API using Express with GET, POST, PUT and DELETE endpoints for an in-memory student records database.",
        "theory": (
            "Node.js enables JavaScript to run on the server via the V8 engine. Express.js provides "
            "a minimal routing and middleware framework. REST (Representational State Transfer) maps "
            "HTTP methods to CRUD operations: GET=Read, POST=Create, PUT=Update, DELETE=Delete. "
            "Status codes communicate the result: 200 OK, 201 Created, 400 Bad Request, 404 Not Found."
        ),
        "files": [
            {
                "filename": "server.js",
                "label": "server.js — Express REST API (Full CRUD)",
                "code": """// server.js — RESTful Student Records API
// Stack: Node.js + Express | Data: In-memory array
const express = require('express');
const app     = express();

app.use(express.json());   // Parse JSON request bodies

// ─── In-memory student database (no DB needed for lab demo) ───
let students = [
  { id: 1, name: 'Alice Kumar',  grade: 'A', score: 92 },
  { id: 2, name: 'Bob Sharma',   grade: 'B', score: 78 },
  { id: 3, name: 'Clara Patel',  grade: 'A', score: 88 },
];
let nextId = 4;

// ─── GET /api/students — Retrieve all records ────────────────
app.get('/api/students', (req, res) => {
  console.log('[GET] /api/students');
  res.status(200).json({ success: true, count: students.length, data: students });
});

// ─── GET /api/students/:id — Retrieve one record ─────────────
app.get('/api/students/:id', (req, res) => {
  const student = students.find(s => s.id === Number(req.params.id));
  if (!student)
    return res.status(404).json({ success: false, error: 'Student not found' });
  console.log('[GET] /api/students/' + req.params.id);
  res.status(200).json({ success: true, data: student });
});

// ─── POST /api/students — Create new record ──────────────────
app.post('/api/students', (req, res) => {
  const { name, grade, score } = req.body;
  if (!name || !grade || score === undefined)
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  const student = { id: nextId++, name, grade, score };
  students.push(student);
  console.log('[POST] /api/students — Created:', student);
  res.status(201).json({ success: true, data: student });
});

// ─── PUT /api/students/:id — Update existing record ──────────
app.put('/api/students/:id', (req, res) => {
  const idx = students.findIndex(s => s.id === Number(req.params.id));
  if (idx === -1)
    return res.status(404).json({ success: false, error: 'Student not found' });
  students[idx] = { ...students[idx], ...req.body };
  console.log('[PUT] /api/students/' + req.params.id + ' — Updated');
  res.status(200).json({ success: true, data: students[idx] });
});

// ─── DELETE /api/students/:id — Remove a record ──────────────
app.delete('/api/students/:id', (req, res) => {
  const before = students.length;
  students = students.filter(s => s.id !== Number(req.params.id));
  if (students.length === before)
    return res.status(404).json({ success: false, error: 'Student not found' });
  console.log('[DELETE] /api/students/' + req.params.id + ' — Deleted');
  res.status(200).json({ success: true, message: 'Student deleted successfully' });
});

// ─── Start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\node-auth-service&gt;</span> npm install express\n'
                    '<span class="tc-dim">added 57 packages in 2.3s</span>\n\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\node-auth-service&gt;</span> node server.js\n'
                    '<span class="tc-green">Server running on http://localhost:3000</span>\n\n'
                    '<span class="tc-dim">─── API Requests ──────────────────────────────────────</span>\n'
                    '<span class="tc-cyan">[GET]    /api/students</span>\n'
                    '<span class="tc-white">         → 200 OK | 3 records: Alice, Bob, Clara</span>\n\n'
                    '<span class="tc-cyan">[GET]    /api/students/2</span>\n'
                    '<span class="tc-white">         → 200 OK | { id:2, name:"Bob Sharma", grade:"B", score:78 }</span>\n\n'
                    '<span class="tc-green">[POST]   /api/students</span>\n'
                    '<span class="tc-white">         → 201 Created | { id:4, name:"Dev Raj", grade:"A", score:95 }</span>\n\n'
                    '<span class="tc-yellow">[PUT]    /api/students/2</span>\n'
                    '<span class="tc-white">         → 200 Updated | score: 78 → 82, grade: B → B+</span>\n\n'
                    '<span class="tc-err">[DELETE] /api/students/2</span>\n'
                    '<span class="tc-white">         → 200 OK | "Student deleted successfully"</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\node-auth-service&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": None,
                "browser_caption": None,
            }
        ]
    },

    {
        "title": "Exercise 6: Cookie & Session Management (Node.js + Express)",
        "section": "node",
        "aim": "Implement user authentication sessions using express-session middleware. Create login, protected profile, and logout routes with secure cookie handling.",
        "theory": (
            "HTTP is stateless — cookies solve this by carrying a session ID with each request. "
            "express-session stores session data server-side and sends a signed cookie (connect.sid) "
            "to the client. Cookie security attributes: HttpOnly blocks JavaScript access (prevents XSS), "
            "Secure enforces HTTPS, SameSite=lax prevents CSRF attacks, maxAge sets expiry time. "
            "The full flow: Login → Session created + cookie sent → Authenticated requests use cookie → "
            "Logout → Session destroyed + cookie cleared."
        ),
        "files": [
            {
                "filename": "app.js",
                "label": "app.js — Login / Session / Cookie / Logout Routes",
                "code": """// app.js — Session authentication with express-session
const express      = require('express');
const session      = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// ─── Session middleware — stores session server-side ──────────
// The session ID is sent to client as a signed cookie (connect.sid)
app.use(session({
  secret: 'labmate_2025_secret',  // Used to sign session cookie (keep private!)
  resave: false,                   // Don't save session if unchanged
  saveUninitialized: false,        // Don't create session until data is stored
  cookie: {
    httpOnly: true,                // JS cannot read this cookie (XSS protection)
    secure:   false,               // Set true in production (requires HTTPS)
    sameSite: 'lax',              // Prevents CSRF attacks
    maxAge:   30 * 60 * 1000     // Session expires in 30 minutes
  }
}));

// ─── Mock user database ───────────────────────────────────────
const USERS = {
  admin:   { password: 'admin@123',   role: 'Admin',   name: 'Administrator' },
  student: { password: 'student@123', role: 'Student', name: 'Alex Kumar'    }
};

// ─── POST /login — Validate user, create session + set cookie ─
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS[username];

  if (!user || user.password !== password) {
    console.log('[AUTH] Login FAILED — username:', username);
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // Store user data in server-side session
  req.session.user      = { username, role: user.role, name: user.name };
  req.session.loginTime = new Date().toISOString();

  // Set an extra custom cookie (not HttpOnly — readable by JS for demo)
  res.cookie('lastVisit', new Date().toUTCString(), { maxAge: 86400000 });

  console.log('[AUTH] Login OK — user:', username, '| session:', req.session.id);
  res.status(200).json({
    success:   true,
    message:  'Welcome, ' + user.name + '!',
    sessionId: req.session.id,
    cookie:   { httpOnly: true, sameSite: 'lax', maxAge: '30 min' }
  });
});

// ─── GET /profile — Protected route (session required) ────────
app.get('/profile', (req, res) => {
  if (!req.session.user) {
    console.log('[AUTH] Unauthorized access to /profile');
    return res.status(401).json({ success: false, error: 'Not authenticated. Please login.' });
  }
  console.log('[AUTH] Profile accessed by:', req.session.user.username);
  res.status(200).json({
    success:   true,
    user:      req.session.user,
    loginTime: req.session.loginTime,
    cookies:   req.cookies
  });
});

// ─── POST /logout — Destroy session + clear cookies ───────────
app.post('/logout', (req, res) => {
  const who = req.session?.user?.username || 'unknown';
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.clearCookie('lastVisit');
    console.log('[AUTH] Session destroyed — user:', who);
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  });
});

app.listen(3000, () => console.log('[Server] Auth server → http://localhost:3000'));""",
                "terminal_output": (
                    '<span class="tc-white">PS C:\\Users\\Student\\node-auth-service&gt;</span> npm install express express-session cookie-parser\n'
                    '<span class="tc-dim">added 73 packages in 3.1s</span>\n\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\node-auth-service&gt;</span> node app.js\n'
                    '<span class="tc-green">[Server] Auth server → http://localhost:3000</span>\n\n'
                    '<span class="tc-dim">─── Request Log ───────────────────────────────────────</span>\n'
                    '<span class="tc-err">[AUTH] Login FAILED — username: hacker</span>\n'
                    '<span class="tc-white">         → 401 Unauthorized | "Invalid credentials"</span>\n\n'
                    '<span class="tc-green">[AUTH] Login OK — user: admin | session: xK9mPqR2vL8nWs</span>\n'
                    '<span class="tc-white">         → 200 OK | Cookie set: connect.sid (HttpOnly, SameSite=lax, 30min)</span>\n'
                    '<span class="tc-white">         → 200 OK | Cookie set: lastVisit=Tue, 06 Oct 2026 03:05:00 GMT</span>\n\n'
                    '<span class="tc-cyan">[AUTH] Profile accessed by: admin</span>\n'
                    '<span class="tc-white">         → 200 OK | { user:{name:"Administrator", role:"Admin"},</span>\n'
                    '<span class="tc-white">                      loginTime:"2026-10-06T03:05:00.000Z",</span>\n'
                    '<span class="tc-white">                      cookies:{lastVisit:"Tue, 06 Oct 2026..."} }</span>\n\n'
                    '<span class="tc-yellow">[AUTH] Session destroyed — user: admin</span>\n'
                    '<span class="tc-white">         → 200 OK | Cleared: connect.sid, lastVisit</span>\n'
                    '<span class="tc-white">PS C:\\Users\\Student\\node-auth-service&gt;</span> <span class="term-cursor"></span>'
                ),
                "browser_html": None,
                "browser_caption": None,
            }
        ]
    }
]


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.space_before = Pt(14 if level == 1 else 8)
    p.paragraph_format.space_after  = Pt(6)
    return p

def body_text_parts(doc, label, text):
    """Bold label followed by normal text in same paragraph."""
    p = doc.add_paragraph()
    r1 = p.add_run(label + ": ")
    r1.bold = True
    r1.font.name = 'Times New Roman'
    r1.font.size = Pt(11)
    r2 = p.add_run(text)
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(6)

def label_para(doc, text, color=(0x1e, 0x40, 0xaf)):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = True
    r.font.name = 'Times New Roman'
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(*color)
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after  = Pt(4)
    return p

def embed_img(doc, img_path, caption=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(img_path, width=Inches(6.0))
    if caption:
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = cap.add_run("Figure: " + caption)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(9)
        r.font.italic = True
        r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
        cap.paragraph_format.space_after = Pt(14)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 65)
    print("WEB DEV LAB MANUAL — v2 REAL OUTPUT EDITION")
    print("=" * 65)

    from jinja2 import Environment, FileSystemLoader
    from markupsafe import Markup

    TEMPLATE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates"))
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=False)
    browser_tpl = env.get_template("browser_preview_theme.html")

    doc = docx.Document()

    # Cover page
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title_p.add_run("WEB DEVELOPMENT LABORATORY MANUAL")
    r.bold = True; r.font.size = Pt(20); r.font.name = 'Times New Roman'
    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rs = sub.add_run("HTML / CSS / JavaScript  ·  React.js  ·  Node.js + Express")
    rs.font.size = Pt(13); rs.font.name = 'Times New Roman'
    rs.font.color.rgb = RGBColor(0x1e, 0x40, 0xaf)
    doc.add_paragraph()
    doc.add_page_break()

    SECTIONS = {
        "html_css_js": "Section 1: HTML, CSS & JavaScript",
        "react": "Section 2: React.js",
        "node": "Section 3: Node.js & Express"
    }
    current_section = None
    ex_num = 0
    total_shots = 0
    failed = 0

    for exercise in EXERCISES:
        sec = exercise["section"]
        if sec != current_section:
            current_section = sec
            doc.add_page_break()
            heading(doc, SECTIONS[sec], level=1)

        ex_num += 1
        heading(doc, exercise["title"], level=2)
        body_text_parts(doc, "Aim", exercise["aim"])
        body_text_parts(doc, "Theory", exercise["theory"])

        for file_info in exercise["files"]:
            fname      = file_info["filename"]
            code       = file_info["code"]
            term_out   = file_info.get("terminal_output", "")
            browser_html = file_info.get("browser_html", None)
            br_caption = file_info.get("browser_caption", None)
            flabel     = file_info.get("label", fname)

            print(f"\n  Ex{ex_num}: {fname}")

            # ── 1. VS Code screenshot with real terminal output ──────
            success, img_path, w, h = await service.generate_screenshot(
                code=code,
                output=Markup(term_out) if term_out else "",
                theme="vscode",
                job_id=900 + ex_num,
                username="Student",
                filename=fname,
                screenshot_style="style_1"
            )

            if success and os.path.exists(img_path):
                import shutil
                safe = fname.replace(".", "_")
                dest = os.path.join(OUTPUT_DIR, f"ex{ex_num}_{safe}_vscode.png")
                shutil.copyfile(img_path, dest)
                print(f"    [VS Code] [OK] {dest} ({w}x{h})")
                total_shots += 1
                label_para(doc, f"Code Screenshot: {flabel}")
                embed_img(doc, dest, caption=f"VS Code: {fname}")
            else:
                print(f"    [VS Code] [FAIL] FAILED for {fname}")
                failed += 1

            # ── 2. Browser preview screenshot (if HTML content provided) ──
            if browser_html:
                import uuid as _uuid
                from playwright.async_api import async_playwright

                # Render browser_preview_theme.html with the actual HTML content
                html_page = browser_tpl.render(
                    filename=fname,
                    output_content=Markup(browser_html),
                    code_content=""
                )

                # Take screenshot directly via playwright
                browser_dest = os.path.join(OUTPUT_DIR, f"ex{ex_num}_{safe}_browser.png")
                try:
                    from app.services.browser_capture import launch_capture_browser
                    ok, bw, bh = await service._take_screenshot(html_page, browser_dest, 1128, 600)
                    if ok:
                        print(f"    [Browser] [OK] {browser_dest} ({bw}x{bh})")
                        total_shots += 1
                        if br_caption:
                            label_para(doc, f"Browser Output: {br_caption}", color=(0x16, 0x60, 0x34))
                        embed_img(doc, browser_dest, caption=br_caption or "Browser rendered output")
                    else:
                        print(f"    [Browser] [FAIL] FAILED")
                        failed += 1
                except Exception as ex_err:
                    print(f"    [Browser] [FAIL] Exception: {ex_err}")
                    failed += 1

        doc.add_paragraph()

    out = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "..", "..", "test_screenshots", "webdev_comprehensive_manual.docx"
    ))
    doc.save(out)
    size_kb = os.path.getsize(out) // 1024
    print(f"\n{'=' * 65}")
    print(f"SAVED: {out} ({size_kb} KB)")
    print(f"Screenshots: {total_shots} OK  |  {failed} FAILED")
    print(f"{'=' * 65}")


if __name__ == "__main__":
    asyncio.run(main())
