# Comprehensive Testing Plan - LabMate AI

## 🧪 Test Coverage Overview

### 1. Security Tests
- Authentication & Authorization
- Input Validation & Sanitization
- File Upload Security
- CORS & CSRF Protection
- Password Security
- Brute Force Protection

### 2. Functionality Tests
- User Registration & Login
- File Upload & Processing
- Code Execution
- Document Parsing
- Report Generation
- AI Analysis

### 3. Performance Tests
- Load Testing
- Stress Testing
- Concurrency Testing

### 4. Integration Tests
- API Integration
- Database Integration
- Frontend-Backend Integration

---

## 📋 Detailed Test Cases

### Authentication Tests

#### Test 1: Strong Password Requirement
```bash
# Test Case: Weak password should be rejected
POST /api/basic-auth/signup
Body: {
  "email": "test1@example.com",
  "name": "Test User",
  "password": "weak"
}
Expected: 422 Unprocessable Entity
Expected Response: Password validation errors
```

#### Test 2: Successful Registration
```bash
# Test Case: Valid registration should succeed
POST /api/basic-auth/signup
Body: {
  "email": "test2@example.com",
  "name": "Test User",
  "password": "SecureP@ssw0rd123"
}
Expected: 200 OK
Expected Response: User object with id, email, name
```

#### Test 3: Duplicate Email Prevention
```bash
# Test Case: Cannot register with existing email
POST /api/basic-auth/signup
Body: {
  "email": "test2@example.com",  # Already exists
  "name": "Another User",
  "password": "SecureP@ssw0rd456"
}
Expected: 400 Bad Request
Expected Response: "Email already registered"
```

#### Test 4: Successful Login
```bash
# Test Case: Login with correct credentials
POST /api/basic-auth/login
Body: {
  "email": "test2@example.com",
  "password": "SecureP@ssw0rd123"
}
Expected: 200 OK
Expected Response: User object
```

#### Test 5: Failed Login
```bash
# Test Case: Login with wrong password
POST /api/basic-auth/login
Body: {
  "email": "test2@example.com",
  "password": "WrongPassword123!"
}
Expected: 401 Unauthorized
Expected Response: "Invalid email or password"
```

#### Test 6: Brute Force Protection
```bash
# Test Case: Account lockout after 5 failed attempts
POST /api/basic-auth/login (repeat 6 times)
Body: {
  "email": "test2@example.com",
  "password": "WrongPassword123!"
}
Expected: 
- Attempts 1-5: 401 Unauthorized
- Attempt 6: 423 Locked
Expected Response: "Account is temporarily locked"
```

#### Test 7: Case-Insensitive Email
```bash
# Test Case: Login with different email case
POST /api/basic-auth/login
Body: {
  "email": "TEST2@EXAMPLE.COM",  # Uppercase
  "password": "SecureP@ssw0rd123"
}
Expected: 200 OK (emails are case-insensitive)
```

---

### File Upload Security Tests

#### Test 8: Valid DOCX Upload
```bash
# Test Case: Upload valid DOCX file
POST /api/upload
Form Data: 
  file: sample.docx (valid DOCX)
  user_id: 1
Headers: X-Beta-Key: [VALID_KEY]
Expected: 200 OK
Expected Response: Upload object with id, filename, file_type
```

#### Test 9: Invalid File Type
```bash
# Test Case: Reject non-DOCX/PDF files
POST /api/upload
Form Data: 
  file: malicious.exe
Headers: X-Beta-Key: [VALID_KEY]
Expected: 400 Bad Request
Expected Response: "Invalid file type"
```

#### Test 10: MIME Type Validation
```bash
# Test Case: Reject file with wrong MIME type
POST /api/upload
Form Data: 
  file: malicious.exe.docx (renamed .exe)
Headers: X-Beta-Key: [VALID_KEY]
Expected: 400 Bad Request
Expected Response: "File content does not match allowed types"
```

#### Test 11: File Size Limit
```bash
# Test Case: Reject oversized files
POST /api/upload
Form Data: 
  file: huge_file.docx (>50MB)
Headers: X-Beta-Key: [VALID_KEY]
Expected: 400 Bad Request
Expected Response: "File too large"
```

#### Test 12: Path Traversal Prevention
```bash
# Test Case: Prevent path traversal in filename
POST /api/upload
Form Data: 
  file: ../../../etc/passwd.docx
Headers: X-Beta-Key: [VALID_KEY]
Expected: 400 Bad Request or sanitized filename
```

#### Test 13: Empty File Rejection
```bash
# Test Case: Reject empty files
POST /api/upload
Form Data: 
  file: empty.docx (0 bytes)
Headers: X-Beta-Key: [VALID_KEY]
Expected: 400 Bad Request
Expected Response: "File is empty"
```

---

### CORS Tests

#### Test 14: Allowed Origin
```bash
# Test Case: Accept requests from allowed origin
GET /api/health
Headers: Origin: http://localhost:3000
Expected: 200 OK
Expected Headers: Access-Control-Allow-Origin: http://localhost:3000
```

#### Test 15: Disallowed Origin
```bash
# Test Case: Reject requests from disallowed origin
GET /api/health
Headers: Origin: https://malicious-site.com
Expected: No CORS headers OR 403 Forbidden
```

#### Test 16: Preflight Request
```bash
# Test Case: Handle OPTIONS preflight correctly
OPTIONS /api/upload
Headers: 
  Origin: http://localhost:3000
  Access-Control-Request-Method: POST
Expected: 200 OK
Expected Headers: Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

---

### Input Validation Tests

#### Test 17: SQL Injection Prevention
```bash
# Test Case: Prevent SQL injection in email
POST /api/basic-auth/login
Body: {
  "email": "admin'--",
  "password": "anything"
}
Expected: 401 Unauthorized (not SQL error)
```

#### Test 18: XSS Prevention in Name
```bash
# Test Case: Sanitize XSS in name field
POST /api/basic-auth/signup
Body: {
  "email": "xss@example.com",
  "name": "<script>alert('XSS')</script>",
  "password": "SecureP@ssw0rd123"
}
Expected: 422 Unprocessable Entity (validation error)
```

#### Test 19: Long Input Handling
```bash
# Test Case: Reject excessively long inputs
POST /api/basic-auth/signup
Body: {
  "email": "test@example.com",
  "name": "A" * 1000,  # 1000 characters
  "password": "SecureP@ssw0rd123"
}
Expected: 422 Unprocessable Entity
```

---

### Code Execution Tests

#### Test 20: Python Code Execution
```bash
# Test Case: Execute valid Python code
POST /api/run
Body: {
  "upload_id": 1,
  "task_ids": [1],
  "theme": "idle"
}
Expected: 200 OK
Expected Response: Job with status "completed", output_text
```

#### Test 21: Timeout Protection
```bash
# Test Case: Timeout infinite loop
POST /api/run
Body: {
  "upload_id": 2,  # Contains: while True: pass
  "task_ids": [1],
  "theme": "idle"
}
Expected: 200 OK
Expected Response: Job with status "failed", error "Execution timeout"
```

#### Test 22: Dangerous Code Detection
```bash
# Test Case: Flag dangerous system calls
POST /api/run
Body: {
  "upload_id": 3,  # Contains: import os; os.system('rm -rf /')
  "task_ids": [1],
  "theme": "idle"
}
Expected: 200 OK (executes but sandboxed)
Expected: Warning in logs about suspicious patterns
```

---

### API Rate Limiting Tests

#### Test 23: Rate Limit Compliance
```bash
# Test Case: Allow requests within rate limit
for i in range(10):
    GET /api/health
Expected: All return 200 OK
```

#### Test 24: Rate Limit Enforcement
```bash
# Test Case: Block excessive requests
for i in range(1001):  # Over limit
    GET /api/health
Expected: First 1000 return 200, rest return 429 Too Many Requests
```

---

### Database Tests

#### Test 25: Concurrent User Creation
```bash
# Test Case: Handle concurrent signups
Concurrent POST /api/basic-auth/signup (10 simultaneous)
Body: unique emails
Expected: All succeed with unique IDs
```

#### Test 26: Transaction Rollback
```bash
# Test Case: Rollback on error
POST /api/basic-auth/signup (cause database error mid-transaction)
Expected: No partial data in database
```

---

## 🔄 Integration Tests

### End-to-End User Flow
1. User signs up ✓
2. User logs in ✓
3. User uploads file ✓
4. System parses file ✓
5. User selects tasks ✓
6. System executes code ✓
7. System generates screenshots ✓
8. User downloads report ✓

---

## 📊 Performance Benchmarks

### Response Time Targets
- Authentication: < 200ms
- File upload: < 500ms (for 10MB file)
- Code execution: < 30s (with timeout)
- Report generation: < 5s

### Concurrency Targets
- Support 100 concurrent users
- Handle 1000 requests per minute
- No database deadlocks under load

---

## 🛠️ Test Execution

### Manual Testing
```bash
# Run backend tests
cd backend
pytest tests/ -v --cov=app

# Run frontend tests
cd frontend
npm test

# Run integration tests
npm run test:integration
```

### Automated Testing with TestSprite
See test implementation below.

---

## ✅ Success Criteria

- [ ] All security tests pass
- [ ] No critical vulnerabilities
- [ ] 90%+ code coverage
- [ ] All edge cases handled
- [ ] Performance targets met
- [ ] No data leaks
- [ ] Proper error handling
- [ ] Comprehensive logging

---

## 📝 Test Report Format

For each test:
1. Test ID & Name
2. Test Type (Security/Functional/Performance)
3. Input Data
4. Expected Result
5. Actual Result
6. Status (Pass/Fail)
7. Notes/Issues

