// Assistant Security Sandbox & Guardrails (Rule 5 & Strict Zero-Trust)

/**
 * Patterns that indicate code injection, attempts to extract codebase files,
 * tokens, Firebase credentials, or internal infrastructure secrets.
 */
const FORBIDDEN_EXTRACTION_PATTERNS = [
  /api[_-]?key/i,
  /service[_-]?account/i,
  /firebase[_-]?config/i,
  /secret/i,
  /process\.env/i,
  /token/i,
  /show\s+code/i,
  /print\s+code/i,
  /source\s+code/i,
  /קוד\s+מקור/i,
  /תראה\s+את\s+הקוד/i,
  /תדפיס\s+את\s+הקוד/i,
  /מפתח\s+סודי/i,
  /סיסמה/i,
  /eval\(/i,
  /<script/i,
];

/**
 * Sanitizes and validates user input before sending to the assistant brain.
 * Prevents prompt injections or malicious query extraction.
 */
export function sanitizeAssistantQuery(input: string): { safe: boolean; sanitizedText: string; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { safe: false, sanitizedText: '', reason: 'קלט ריק' };
  }

  const trimmed = input.trim();
  if (trimmed.length > 500) {
    return { safe: false, sanitizedText: trimmed.substring(0, 500), reason: 'השאלה ארוכה מדי (מוגבל ל-500 תווים)' };
  }

  // Check for forbidden code extraction / hacking attempts
  for (const pattern of FORBIDDEN_EXTRACTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        sanitizedText: trimmed,
        reason: 'מטעמי אבטחה, הסוכן אינו מציג קטעי קוד, מפתחות מערכת או נתונים פנימיים.'
      };
    }
  }

  return { safe: true, sanitizedText: trimmed };
}

/**
 * Filters and scrubs assistant responses before presenting to the user.
 * Ensures no raw code blocks, stack traces or credentials accidentally leak.
 */
export function filterAssistantResponse(response: string): string {
  if (!response) return '';

  // Scrub any markdown code blocks that look like raw code
  let sanitized = response.replace(/```(?:javascript|typescript|js|ts|tsx|jsx|json|sh|bash)?[\s\S]*?```/gi, '🔒 [הצגת קוד חסומה מטעמי אבטחה]');

  // Scrub inline backtick secrets or tokens
  sanitized = sanitized.replace(/`[A-Za-z0-9_-]{20,}`/g, '`[סודי]`');

  return sanitized;
}
