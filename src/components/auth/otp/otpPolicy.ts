/**
 * Single Source of Truth for SMS OTP behaviour across all phone-auth flows
 * (AuthWall, PhoneLoginFlow, PhoneLinkEnforcer).
 */

/**
 * ⚠️ DEV-PHASE SETTING (approved by user): no automatic verification.
 * The code is only filled into the field; the user presses "אימות קוד".
 * REMINDER: flip to `true` after development is finished (user request).
 */
export const OTP_AUTO_VERIFY = false;

export const OTP_LENGTH = 6;

/** Codes already rejected by Firebase in this session — never paste them again. */
const rejectedCodes = new Set<string>();

export const markOtpRejected = (code: string) => {
  if (code) rejectedCodes.add(code.trim());
};

export const isOtpRejected = (code: string) => rejectedCodes.has(code.trim());

export const sanitizeOtp = (value: string) => value.replace(/\D/g, '').slice(0, OTP_LENGTH);

/** Extracts an exact standalone 6-digit code from free text (e.g. a copied SMS). */
export const extractOtpFromText = (text: string): string | null => {
  const match = text.match(/(?:^|\D)(\d{6})(?!\d)/);
  return match ? match[1] : null;
};
