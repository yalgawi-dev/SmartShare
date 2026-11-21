// Assistant Security Sandbox & Guardrails (Rule 5 & Strict Zero-Trust)

/**
 * Patterns that indicate prompt injection, jailbreak attempts, code extraction,
 * tokens, Firebase credentials, or cross-user data probing.
 */
const FORBIDDEN_EXTRACTION_PATTERNS = [
  /api[_-]?key/i,
  /service[_-]?account/i,
  /firebase[_-]?config/i,
  /master[_-]?key/i,
  /space[_-]?keys/i,
  /secret/i,
  /process\.env/i,
  /token/i,
  /localstorage/i,
  /sessionstorage/i,
  /cookie/i,
  /show\s+code/i,
  /print\s+code/i,
  /source\s+code/i,
  /system\s*prompt/i,
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /forget\s+(?:all\s+)?instructions/i,
  /jailbreak/i,
  /bypass\s+(?:security|auth|permission)/i,
  /dump\s+(?:database|firestore|users|spaces)/i,
  /קוד\s+מקור/i,
  /תראה\s+את\s+הקוד/i,
  /תדפיס\s+את\s+הקוד/i,
  /הוראות\s+מערכת/i,
  /התעלם\s+מ(?:כל\s+)?ההוראות/i,
  /שכח\s+את\s+ההוראות/i,
  /עקוף\s+הרשאות/i,
  /מרחבים\s+של\s+(?:משתמשים\s+)?אחרים/i,
  /נתונים\s+של\s+משתמשים\s+אחרים/i,
  /מפתח\s+סודי/i,
  /סיסמה/i,
  /eval\(/i,
  /<script/i,
  /javascript:/i
];

/**
 * Sanitizes and validates user input before sending to the assistant brain.
 * Enforced on both client and server (Zero-Trust).
 */
export function sanitizeAssistantQuery(input: string): { safe: boolean; sanitizedText: string; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { safe: false, sanitizedText: '', reason: 'קלט ריק' };
  }

  const trimmed = input.trim();
  if (trimmed.length > 500) {
    return { safe: false, sanitizedText: trimmed.substring(0, 500), reason: 'השאלה ארוכה מדי (מוגבל ל-500 תווים)' };
  }

  for (const pattern of FORBIDDEN_EXTRACTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        sanitizedText: trimmed,
        reason: 'מטעמי אבטחה והגנת פרטיות (Zero-Trust), בקשה זו חסומה. הסוכן מורשה לגשת אך ורק לנתונים המורשים של המשתמש המחובר.'
      };
    }
  }

  return { safe: true, sanitizedText: trimmed };
}

/**
 * Filters and scrubs assistant responses before presenting to the user.
 * Ensures no raw code blocks, stack traces, internal tags, or credentials accidentally leak.
 */
export function filterAssistantResponse(response: string): string {
  if (!response) return '';

  // Scrub any markdown code blocks that look like raw code
  let sanitized = response.replace(/```(?:javascript|typescript|js|ts|tsx|jsx|json|sh|bash|html|sql)?[\s\S]*?```/gi, '🔒 [הצגת קוד חסומה מטעמי אבטחה]');

  // Scrub internal permission markers if ever echoed
  sanitized = sanitized
    .replace(/__only_me__/g, 'רק ליוצר')
    .replace(/__creator_vault_secret__/g, 'מנהלים בלבד')
    .replace(/__space_treasury__/g, 'קופת המרחב');

  // Scrub inline backtick secrets or long tokens
  sanitized = sanitized.replace(/`[A-Za-z0-9_-]{20,}`/g, '`[סודי]`');
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[REDACTED_KEY]');

  return sanitized;
}
