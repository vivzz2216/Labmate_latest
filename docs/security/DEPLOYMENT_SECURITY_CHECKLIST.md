# 🔒 Deployment Security Checklist

## ⚠️ CRITICAL - Complete Before Deployment

### 1. **Rotate Compromised API Keys**

- [ ] **TestSprite API Key** - Found in `.cursor/mcp.json`
  - Current (COMPROMISED): `REDACTED`
  - Action: Generate new key at TestSprite dashboard
  - Update in: `.cursor/mcp.json` (and keep out of git!)

### 2. **Generate Production Secrets**

```bash
# Generate BETA_KEY
python -c "import secrets; print('BETA_KEY=' + secrets.token_urlsafe(32))"

# Generate SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
```

- [ ] Copy generated keys to `.env` file
- [ ] Set in Railway environment variables
- [ ] NEVER commit these keys to git

### 3. **Configure CORS Origins**

- [ ] Update `ALLOWED_ORIGINS` in `.env`:
  ```
  ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
  ```
- [ ] Remove `localhost` from production ALLOWED_ORIGINS

### 4. **Database Migration**

- [ ] Run migration: `backend/migrations/005_add_password_security.sql`
  ```bash
  psql $DATABASE_URL < backend/migrations/005_add_password_security.sql
  ```
- [ ] Verify new columns exist:
  - `users.password_hash`
  - `users.is_active`
  - `users.failed_login_attempts`
  - `users.locked_until`

### 5. **Dependency Installation**

- [ ] Install python-magic:
  ```bash
  pip install python-magic
  ```
- [ ] Update all packages:
  ```bash
  pip install -r backend/requirements.txt --upgrade
  ```

### 6. **Environment Variables**

Required variables in Railway:
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `BETA_KEY` - API access key (32+ chars)
- [ ] `SECRET_KEY` - Session signing key (32+ chars)
- [ ] `ALLOWED_ORIGINS` - Frontend domains (comma-separated)
- [ ] `REDIS_URL` - Redis connection string
- [ ] `OPENAI_API_KEY` - OpenAI API key
- [ ] `RATE_LIMIT_ENABLED` - Set to "true"
- [ ] `RATE_LIMIT_PER_MINUTE` - e.g., "60"

---

## 🧪 Testing Before Go-Live

### Authentication Tests

```bash
# Test 1: Strong password required
curl -X POST https://your-api.com/api/basic-auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "weak"
  }'
# Expected: 422 with password strength errors

# Test 2: Successful signup
curl -X POST https://your-api.com/api/basic-auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "SecureP@ssw0rd123"
  }'
# Expected: 200 with user data

# Test 3: Failed login increments counter
for i in {1..6}; do
  curl -X POST https://your-api.com/api/basic-auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "WrongPassword123!"
    }'
  sleep 1
done
# Expected: 6th attempt returns 423 (Locked)

# Test 4: CORS rejection
curl -X GET https://your-api.com/api/health \
  -H "Origin: https://malicious-site.com" \
  -v
# Expected: CORS error or no Access-Control-Allow-Origin header
```

### File Upload Tests

```bash
# Test 1: Valid DOCX upload
curl -X POST https://your-api.com/api/upload \
  -F "file=@test.docx" \
  -H "X-Beta-Key: YOUR_BETA_KEY"
# Expected: 200 with upload response

# Test 2: Invalid file type
curl -X POST https://your-api.com/api/upload \
  -F "file=@malicious.exe" \
  -H "X-Beta-Key: YOUR_BETA_KEY"
# Expected: 400 with "Invalid file type" error

# Test 3: Path traversal attempt
curl -X POST https://your-api.com/api/upload \
  -F "file=@../../../etc/passwd" \
  -H "X-Beta-Key: YOUR_BETA_KEY"
# Expected: 400 with validation error
```

---

## 🔍 Post-Deployment Monitoring

### Day 1 Checks

- [ ] Monitor failed login attempts
- [ ] Check for unusual file upload patterns
- [ ] Verify CORS is blocking unauthorized origins
- [ ] Review error logs for security warnings
- [ ] Test brute force protection is working

### Week 1 Checks

- [ ] Review all security logs
- [ ] Check for any exposed secrets in logs
- [ ] Verify rate limiting is effective
- [ ] Monitor database for suspicious activity
- [ ] Test disaster recovery procedures

### Monthly Checks

- [ ] Rotate API keys and secrets
- [ ] Update dependencies (`pip list --outdated`)
- [ ] Run security audit (`pip audit`)
- [ ] Review access logs
- [ ] Test backup restoration

---

## 📊 Security Metrics to Track

1. **Failed login attempts** - Should be < 1% of total logins
2. **Account lockouts** - Track frequency and investigate patterns
3. **Invalid file uploads** - Monitor for attack patterns
4. **CORS violations** - Investigate any unexpected origins
5. **Rate limit hits** - May indicate bot activity

---

## 🚨 Incident Response Plan

### If Security Breach Detected:

1. **Immediate Actions:**
   - [ ] Rotate ALL API keys and secrets
   - [ ] Review recent access logs
   - [ ] Check for data exfiltration
   - [ ] Notify affected users
   - [ ] Document the incident

2. **Investigation:**
   - [ ] Identify attack vector
   - [ ] Assess damage scope
   - [ ] Review security logs
   - [ ] Check database for modifications
   - [ ] Identify compromised accounts

3. **Remediation:**
   - [ ] Patch vulnerability
   - [ ] Force password reset for affected users
   - [ ] Update security measures
   - [ ] Deploy hotfix
   - [ ] Test fix thoroughly

4. **Post-Incident:**
   - [ ] Write incident report
   - [ ] Update security procedures
   - [ ] Train team on lessons learned
   - [ ] Implement additional monitoring
   - [ ] Schedule security review

---

## 📝 Security Contacts

- **Security Team:** [Your team email]
- **On-Call Engineer:** [Phone/Slack]
- **Database Admin:** [Contact info]
- **DevOps Lead:** [Contact info]

---

## ✅ Final Verification

Before marking deployment complete:

- [ ] All critical vulnerabilities fixed
- [ ] All secrets rotated
- [ ] Database migration successful
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Monitoring active
- [ ] Logs reviewed
- [ ] Team briefed on changes
- [ ] Documentation updated
- [ ] Rollback plan ready

---

**Deployment Approved By:** _________________  
**Date:** _________________  
**Next Security Review:** _________________

