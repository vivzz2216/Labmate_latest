"""
Input validation and sanitization utilities
"""
import os
import re
from typing import Tuple
from pathlib import Path


def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitize a filename to prevent path traversal and other attacks
    
    Args:
        filename: Original filename
        max_length: Maximum allowed filename length
        
    Returns:
        Sanitized filename
        
    Raises:
        ValueError: If filename is invalid or malicious
    """
    if not filename:
        raise ValueError("Filename cannot be empty")
    
    # Remove any directory components
    filename = os.path.basename(filename)
    
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Remove/replace dangerous characters
    # Allow only alphanumeric, dots, dashes, underscores
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    
    # Prevent multiple dots (could hide file extensions)
    while '..' in filename:
        filename = filename.replace('..', '.')
    
    # Remove leading/trailing dots and dashes
    filename = filename.strip('.-')
    
    # Ensure filename has at least one non-special character
    if not re.search(r'[a-zA-Z0-9]', filename):
        raise ValueError("Filename must contain at least one alphanumeric character")
    
    # Truncate if too long
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext
    
    # Check for reserved names (Windows)
    reserved_names = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                     'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                     'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
    name_without_ext = os.path.splitext(filename)[0].upper()
    if name_without_ext in reserved_names:
        filename = f"file_{filename}"
    
    return filename


_STRIPPABLE_EXT_RE = re.compile(
    r"\.(?:pdf|docx?|txt|md|rtf|odt|sql|py|ipynb|c|cpp|cc|cxx|h|hpp|java|js|jsx|ts|tsx|html?|css|json|xml|csv|zip|tar|gz)(?=$|[\s_()\[\].-])",
    re.IGNORECASE,
)


def normalize_output_name(raw_name: str, default: str = "lab_report", max_length: int = 70) -> str:
    """Normalize a filename or user-supplied output_name into a safe ^[A-Za-z0-9_-]{1,max_length}$ identifier."""
    if not isinstance(raw_name, str):
        return default
    cleaned = raw_name.replace("\x00", "").replace("\\", "/").strip().split("/")[-1]
    prev = None
    while prev != cleaned:
        prev = cleaned
        cleaned = _STRIPPABLE_EXT_RE.sub("", cleaned)
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned)
    cleaned = re.sub(r"-+", "-", cleaned)
    cleaned = re.sub(r"(?:_-|-_)+", "_", cleaned)
    cleaned = cleaned.strip("_-")[:max_length].strip("_-")
    if not re.search(r"[A-Za-z0-9]", cleaned):
        return default
    return cleaned or default


def validate_file_path(file_path: str, allowed_base_dirs: list) -> Tuple[bool, str]:
    """
    Validate that a file path doesn't escape allowed directories
    
    Args:
        file_path: Path to validate
        allowed_base_dirs: List of allowed base directories
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Resolve to absolute path
        abs_path = Path(file_path).resolve()
        
        # Check if path is within any allowed base directory
        for base_dir in allowed_base_dirs:
            base_path = Path(base_dir).resolve()
            try:
                abs_path.relative_to(base_path)
                return True, ""
            except ValueError:
                continue
        
        return False, "File path is outside allowed directories"
        
    except Exception as e:
        return False, f"Invalid file path: {str(e)}"


def sanitize_code_input(code: str, max_length: int = 50000) -> str:
    """
    Sanitize code input to prevent injection attacks
    
    Args:
        code: Code string to sanitize
        max_length: Maximum allowed code length
        
    Returns:
        Sanitized code
        
    Raises:
        ValueError: If code is invalid or exceeds length
    """
    if not code or not isinstance(code, str):
        raise ValueError("Code must be a non-empty string")
    
    # Check length
    if len(code) > max_length:
        raise ValueError(f"Code exceeds maximum length of {max_length} characters")
    
    # Remove null bytes
    code = code.replace('\x00', '')
    
    # Check for suspicious patterns that might indicate injection attempts
    suspicious_patterns = [
        r'import\s+os\s*;.*system',  # os.system() calls
        r'import\s+subprocess\s*;.*call',  # subprocess calls
        r'exec\s*\(',  # exec() calls
        r'eval\s*\(',  # eval() calls (less strict, as it's common in Python)
        r'__import__\s*\(',  # Dynamic imports
        r'compile\s*\(',  # compile() calls
        r'open\s*\([^)]*["\']\/etc\/',  # Reading system files
        r'open\s*\([^)]*["\']\/proc\/',  # Reading proc files
    ]
    
    # Log warnings but don't block (these might be legitimate in some cases)
    for pattern in suspicious_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            print(f"[WARNING] Suspicious pattern detected in code: {pattern}")
    
    return code


def validate_email_format(email: str) -> bool:
    """
    Validate email format using regex
    
    Args:
        email: Email address to validate
        
    Returns:
        True if valid, False otherwise
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def sanitize_html(text: str) -> str:
    """
    Sanitize HTML to prevent XSS attacks
    
    Args:
        text: Text that might contain HTML
        
    Returns:
        Sanitized text with HTML escaped
    """
    if not text:
        return ""
    
    # Escape HTML special characters
    replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    }
    
    for char, escaped in replacements.items():
        text = text.replace(char, escaped)
    
    return text


def validate_theme(theme: str) -> bool:
    """
    Validate that theme is one of the allowed values
    
    Args:
        theme: Theme name to validate
        
    Returns:
        True if valid, False otherwise
    """
    allowed_themes = ['idle', 'vscode', 'notepad', 'codeblocks', 'html', 'react', 'node']
    return theme in allowed_themes


def validate_task_type(task_type: str) -> bool:
    """
    Validate that task_type is one of the allowed values
    
    Args:
        task_type: Task type to validate
        
    Returns:
        True if valid, False otherwise
    """
    allowed_types = ['screenshot_request', 'answer_request', 'code_execution', 'react_project']
    return task_type in allowed_types

