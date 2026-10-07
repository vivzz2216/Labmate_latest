# Frontend Security Guide - LabMate

## 🔒 Current Security Issues & Fixes

### 1. **localStorage Security Concerns**

**Issue:** User data stored in plaintext in localStorage  
**Risk:** XSS attacks can steal user data  
**Current Mitigation:**
- Input sanitization before storage
- Structure validation on retrieval
- XSS character removal

**Recommended Production Solution:**
```typescript
// Instead of localStorage, use HttpOnly cookies with JWT
// Backend sets cookie:
response.set_cookie(
    'auth_token',
    jwt_token,
    httponly=True,  // JavaScript cannot access
    secure=True,    // HTTPS only
    samesite='Strict'  // CSRF protection
)

// Frontend automatically sends cookie with requests
// No manual token handling needed
```

### 2. **XSS Prevention**

**Implemented:**
- HTML escaping utility (`escapeHtml`)
- User input sanitization (`sanitizeUserInput`)
- Filename sanitization
- URL validation

**Usage:**
```typescript
import { escapeHtml, sanitizeUserInput } from '@/lib/sanitize'

// Before displaying user content:
<div>{escapeHtml(user.name)}</div>

// Before storing user input:
const sanitized = sanitizeUserInput(userInput)
```

### 3. **CSRF Protection** (TODO)

**Status:** Not Implemented  
**Required for Production:**

1. **Backend:** Generate CSRF tokens
```python
from fastapi import FastAPI, Request
from fastapi_csrf_protect import CsrfProtect

@app.post("/api/upload")
async def upload(request: Request, csrf_protect: CsrfProtect = Depends()):
    await csrf_protect.validate_csrf(request)
    # ... handle upload
```

2. **Frontend:** Include token in requests
```typescript
// Get CSRF token from meta tag or cookie
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content

axios.post('/api/upload', data, {
  headers: {
    'X-CSRF-Token': csrfToken
  }
})
```

### 4. **Content Security Policy** (TODO)

**Status:** Not Implemented  
**Recommended Configuration:**

Add to Next.js config:
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Adjust as needed
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:8000",  // Your API
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  }
}
```

## 🛡️ Security Best Practices

### Input Validation

✅ **DO:**
```typescript
import { isValidEmail, validatePasswordStrength } from '@/lib/sanitize'

// Validate before API call
if (!isValidEmail(email)) {
  setError('Invalid email format')
  return
}

const { isValid, errors } = validatePasswordStrength(password)
if (!isValid) {
  setError(errors.join(', '))
  return
}
```

❌ **DON'T:**
```typescript
// Never trust user input
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// Never eval user input
eval(userInput)

// Never execute user code
new Function(userInput)()
```

### Output Encoding

✅ **DO:**
```typescript
import { escapeHtml } from '@/lib/sanitize'

// Always escape before rendering
{escapeHtml(user.name)}

// Use React's built-in escaping
{user.name}  // React escapes by default
```

❌ **DON'T:**
```typescript
// Never use dangerouslySetInnerHTML with unsanitized data
<div dangerouslySetInnerHTML={{ __html: user.bio }} />
```

### URL Handling

✅ **DO:**
```typescript
import { sanitizeUrl } from '@/lib/sanitize'

const safeUrl = sanitizeUrl(userProvidedUrl)
if (safeUrl) {
  window.location.href = safeUrl
}
```

❌ **DON'T:**
```typescript
// Never use user input directly in URLs
window.location.href = userInput  // XSS risk!
```

### File Upload

✅ **DO:**
```typescript
import { sanitizeFilename } from '@/lib/sanitize'

const file = event.target.files[0]
const safeName = sanitizeFilename(file.name)

// Validate file type
const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
if (!allowedTypes.includes(file.type)) {
  setError('Invalid file type')
  return
}

// Validate file size
if (file.size > 50 * 1024 * 1024) {  // 50MB
  setError('File too large')
  return
}
```

## 🔍 Security Testing

### Manual Testing Checklist

- [ ] **XSS Tests:**
  - Enter `<script>alert('XSS')</script>` in text fields
  - Try `<img src=x onerror=alert('XSS')>`
  - Test with `javascript:alert('XSS')` in URLs
  - All should be escaped or blocked

- [ ] **CSRF Tests:**
  - Create form on external site that posts to your API
  - Should be blocked by CSRF protection
  - Should be blocked by CORS

- [ ] **Auth Tests:**
  - Try accessing protected pages without login
  - Try using expired tokens
  - Try token tampering

- [ ] **File Upload Tests:**
  - Try uploading .exe, .sh, .php files
  - Try files with malicious names (`../../../etc/passwd`)
  - Try oversized files

### Automated Testing

```bash
# Install security testing tools
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D eslint-plugin-security

# Run tests
npm test

# Run security linter
npx eslint . --ext .ts,.tsx
```

## 📚 Additional Resources

### OWASP Top 10 (Frontend-Relevant):

1. **Injection** - Use parameterized queries, escape output
2. **Broken Authentication** - Use secure session management
3. **XSS** - Sanitize input, escape output, use CSP
4. **Broken Access Control** - Validate permissions on frontend and backend
5. **Security Misconfiguration** - Set security headers, disable debug mode

### Tools:

- **OWASP ZAP** - Web application security scanner
- **Burp Suite** - Security testing platform
- **npm audit** - Check for vulnerable dependencies
- **Snyk** - Continuous security monitoring

### Commands:

```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Check with Snyk
npx snyk test
```

## ⚠️ Production Deployment Checklist

Before deploying to production:

- [ ] Remove all console.log statements with sensitive data
- [ ] Enable HTTPS (force redirect from HTTP)
- [ ] Set security headers (CSP, X-Frame-Options, etc.)
- [ ] Implement CSRF protection
- [ ] Use HttpOnly cookies for authentication
- [ ] Enable rate limiting on API
- [ ] Set up monitoring and alerts
- [ ] Test all security controls
- [ ] Review .env file (no secrets in code)
- [ ] Enable production build optimizations

## 🔐 Environment Variables

Never commit these:

```bash
# .env.local (add to .gitignore)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_BETA_KEY=  # DON'T USE - handle on backend only
```

## 📞 Security Contact

For security issues:
- Email: security@yourdomain.com
- Bug Bounty: [Your bug bounty program]
- PGP Key: [Public key for encrypted communications]

---

**Remember:** Security is a process, not a product. Regularly review and update security measures.

