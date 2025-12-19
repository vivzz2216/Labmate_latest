# Agile Test Runner Guide

## Quick Start

### Run All Tests
```bash
cd backend
pytest
```

### Run with Coverage
```bash
pytest --cov=app --cov-report=html
# Open htmlcov/index.html in browser
```

### Run Specific Module
```bash
# Single service
pytest tests/unit/test_services/test_composer_service.py

# All service tests
pytest tests/unit/test_services/

# All unit tests
pytest tests/unit/

# All integration tests
pytest tests/integration/
```

### Run by Marker
```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# Skip slow tests
pytest -m "not slow"
```

## Test Coverage Goals

- **Overall**: 70%+
- **Critical Modules**: 90%+
  - Authentication: 90%+
  - Security: 90%+
  - Core Services: 80%+
  - API Endpoints: 75%+

## Test Execution Time Targets

- Unit tests: < 1 second each
- Integration tests: < 5 seconds each
- E2E tests: < 30 seconds each
- Total suite: < 5 minutes

## Viewing Coverage

After running tests with coverage:
```bash
# HTML report
pytest --cov=app --cov-report=html
# Open htmlcov/index.html

# Terminal report
pytest --cov=app --cov-report=term-missing

# XML report (for CI/CD)
pytest --cov=app --cov-report=xml
```

## Continuous Testing

### Watch Mode (requires pytest-watch)
```bash
pip install pytest-watch
ptw tests/
```

### Pre-commit Hook
Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
cd backend && pytest tests/unit/ -v
```




