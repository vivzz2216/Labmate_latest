# LabMate Windows Desktop Client

Commercial-ready Windows desktop client for **LabMate** built with **Electron + electron-builder**. Connects directly to your Railway HTTPS deployment (or `http://localhost:3000` for local testing) with hardened window/navigation isolation and automated Authenticode signing support.

---

## Security Architecture

- **Renderer Sandbox**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`.
- **Origin & URL Guard (`src/security.js`)**: Remote servers require `https://`; `http://` is permitted only for loopback addresses (`localhost` / `127.0.0.1`).
- **Popup & Navigation Isolation**: Razorpay payment popups (`api.razorpay.com`, `checkout.razorpay.com`) open in ephemeral sandboxed child windows with zero Node/preload access; untrusted links open safely in the OS browser or are blocked.
- **Scoped Preload Bridge**: `preload.js` IPC handlers verify `event.senderFrame.url === connect.html`, preventing remote web pages from modifying desktop server settings.
- **Permission Lockdown**: Rejects privileged permissions (`geolocation`, `camera`, `mic`, `usb`, `midi`) by default.

---

## Local Development & Building

```powershell
cd desktop
npm.cmd install
npm.cmd test
```

Launch against local Next.js/FastAPI:
```powershell
$env:LABMATE_DESKTOP_URL="http://localhost:3000"
npm.cmd start
```

Build Windows **`.exe` (NSIS)** + **`.msi`** installers + **`SHA256SUMS.txt`**:
```powershell
npm.cmd run dist:win
```
Artifacts appear in `desktop/dist/`.

---

## Eliminating Windows Defender SmartScreen Warnings on Website Downloads

Windows Defender SmartScreen shows *"Windows protected your PC"* on **any unsigned `.exe` or `.msi`** downloaded from a website. Before publishing installers publicly:

1. **Recommended — Azure Trusted Signing (~\$9.99/mo)**:
   - Create a Trusted Signing Account and Certificate Profile in Azure after identity verification.
   - Uncomment `azureSignOptions` in `desktop/electron-builder.yml` with your `publisherName`, `endpoint`, `codeSigningAccountName`, and `certificateProfileName`.
   - Set `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` in GitHub Actions secrets (or locally) and run `npm run dist:win`.
2. **Alternative — EV Code Signing Certificate (`.pfx`)**:
   - Export/reference your EV certificate via `CSC_LINK` and `CSC_KEY_PASSWORD` before running `npm run dist:win`.
3. **Host over HTTPS + Publish `SHA256SUMS.txt`**:
   - Serve the signed `.exe` / `.msi` from an HTTPS download URL on your domain alongside the generated `SHA256SUMS.txt`.
