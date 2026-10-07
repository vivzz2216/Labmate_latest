/**
 * Client-side sanitization utilities to prevent XSS attacks
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (!text) return ''
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  
  return text.replace(/[&<>"'/]/g, (char) => map[char])
}

/**
 * Sanitize user input for display
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  // Remove script tags and event handlers
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
  
  return sanitized
}

/**
 * Validate and sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return ''
  
  // Remove path components
  let sanitized = filename.replace(/^.*[\\\/]/, '')
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[^\w\s.-]/g, '_')
  
  // Remove multiple dots
  while (sanitized.includes('..')) {
    sanitized = sanitized.replace('..', '.')
  }
  
  return sanitized.trim()
}

/**
 * Sanitize URL to prevent javascript: and data: schemes
 */
export function sanitizeUrl(url: string): string {
  if (!url) return ''
  
  const lowerUrl = url.toLowerCase().trim()
  
  // Block dangerous protocols
  if (
    lowerUrl.startsWith('javascript:') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('vbscript:')
  ) {
    return ''
  }
  
  return url
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!password) {
    return { isValid: false, errors: ['Password is required'] }
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit')
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

