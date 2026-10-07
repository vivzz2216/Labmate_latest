# ⚡ LabMate Chrome Extension — Google Drive Integration

The **LabMate Chrome Extension** allows students and educators to send laboratory manuals, assignment PDFs, and Word documents (`.docx`, `.doc`) directly from **Google Drive** (`drive.google.com`) into their **LabMate Workspace** in just one click.

---

## 🚀 Features

1. **Native Drive Toolbar Injection**: Automatically detects when you preview a PDF or Word manual in Google Drive and adds an aesthetic **⚡ Send to LabMate** button in the preview toolbar.
2. **Zero-Configuration Auth Sync**: Automatically synchronizes your login session from the LabMate web app (`http://localhost:3000` or production). No need to copy or paste API tokens.
3. **One-Click Upload & Auto-Processing**: Directly downloads the file via Google Drive authenticated stream, uploads it to `/api/upload`, and starts the assignment extraction workflow.
4. **Instant Notification with Workspace Link**: Shows an interactive toast notification with a direct link to the **LabMate Workspace** (`/workspace`) where all compiled screenshots, solution code, and Word reports live.
5. **Configurable Endpoints**: Easily switch between local development (`http://localhost:8000`) and cloud production backend through the extension popup.

---

## 📦 How to Install (Load Unpacked)

1. Open **Google Chrome** (or any Chromium browser such as Edge, Brave, or Arc).
2. Navigate to:
   ```text
   chrome://extensions
   ```
3. In the top right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top left.
5. Select the `chrome_extension` folder located inside this project:
   ```text
   <path_to_labmate_latest>/chrome_extension
   ```
6. The **LabMate — AI Lab Manual Assistant** extension will now be active in your browser extensions bar! Pin it for easy access.

---

## 🔑 How to Use

### Step 1: Log in to LabMate
1. Open the LabMate Web App at [http://localhost:3000](http://localhost:3000) (or your deployed URL).
2. Sign in with your student or instructor account.
3. The extension content script silently captures your session token and marks your status as **🟢 Connected** in the extension popup.

### Step 2: Open Google Drive
1. Go to [Google Drive](https://drive.google.com).
2. Double-click or preview any lab manual (e.g., `CN_Lab_Manual.pdf`, `OS_Lab_Exercises.docx`).
3. Notice the purple **⚡ Send to LabMate** button injected into the top action bar.

### Step 3: Send to Workspace
1. Click **⚡ Send to LabMate**.
2. The button will indicate progress (`Fetching from Drive...` ➔ `Sending to LabMate...`).
3. Once complete, a success toast appears:
   ```text
   ✅ "CN_Lab_Manual.pdf" sent to LabMate! Your report and execution screenshots are compiling. [Open Workspace →]
   ```
4. Click **Open Workspace →** to view the full student workspace with:
   - 🖼️ **Screenshots Gallery** (High-res genuine execution terminal screenshots with click-to-zoom modal)
   - 💻 **Solution Code & Execution Output** (Syntax-highlighted code and verified output)
   - 📄 **Word Report Document** (Download generated `.docx` report with pagination and college headers)

---

## 🛠️ File Structure

```text
chrome_extension/
├── manifest.json       # Manifest V3 specification and permissions
├── background.js       # Background service worker
├── content.js          # Google Drive DOM observer & toolbar injector
├── content.css         # Styling for injected button, modal, and toasts
├── sync_auth.js        # Silent auth sync from web app localStorage
├── popup.html          # Extension popup UI
├── popup.js            # Popup controller & backend connectivity test
├── popup.css           # Modern dark-mode popup stylesheet
├── icons/              # Extension icons (16px, 48px, 128px)
└── README.md           # This guide
```
