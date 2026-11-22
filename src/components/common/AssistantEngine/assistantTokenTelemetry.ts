import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserAiUsageStats {
  totalTokens: number;
  totalRequests: number;
  todayTokens: number;
  todayRequests: number;
  quotaHitsCount?: number;
  lastQuotaHitAt?: string;
  lastQuotaHitType?: 'user_rate_limit' | 'provider_quota_429';
  lastDate: string; // YYYY-MM-DD
  lastUpdatedAt: string;
}

/**
 * Estimated blended cost for Gemini 3.5 Flash-Lite (~$0.12 per 1M tokens blended input/output).
 */
export const ESTIMATED_USD_PER_MILLION_TOKENS = 0.12;

export function estimateTokenCostUsd(tokens: number): number {
  return (Math.max(0, tokens) / 1_000_000) * ESTIMATED_USD_PER_MILLION_TOKENS;
}

export function formatTokenCostIls(tokens: number): string {
  const ils = estimateTokenCostUsd(tokens) * 3.7;
  if (ils < 0.01) return '< ₪0.01';
  return `₪${ils.toFixed(2)}`;
}

/**
 * Non-blocking (fire-and-forget) per-user AI token usage recorder.
 * Stores daily & cumulative token usage on `users/{uid}.aiUsage` in Firestore
 * so Admins can monitor exact consumption & estimated cost per customer/user
 * without adding even 1ms of latency to the assistant response.
 */
export async function recordUserAiTokenUsage(uid: string | undefined, tokensUsed: number | undefined): Promise<void> {
  if (!uid || !tokensUsed || tokensUsed <= 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    const prev: Partial<UserAiUsageStats> = snap.exists() ? (snap.data()?.aiUsage || {}) : {};
    const isSameDay = prev.lastDate === today;

    const nextStats: UserAiUsageStats = {
      totalTokens: (Number(prev.totalTokens) || 0) + tokensUsed,
      totalRequests: (Number(prev.totalRequests) || 0) + 1,
      todayTokens: (isSameDay ? Number(prev.todayTokens) || 0 : 0) + tokensUsed,
      todayRequests: (isSameDay ? Number(prev.todayRequests) || 0 : 0) + 1,
      lastDate: today,
      lastUpdatedAt: nowIso
    };

    await setDoc(userRef, { aiUsage: nextStats }, { merge: true });
  } catch (err) {
    // Non-fatal telemetry error; never interrupt user flow
    console.warn('AI token telemetry warning:', err);
  }
}

/**
 * Records a quota exceeded event (429 shared provider quota or per-user rate limit)
 * on the affected user record so Admin immediately sees an alert badge in /admin/users.
 */
export async function recordAiQuotaHit(
  uid: string | undefined,
  hitType: 'user_rate_limit' | 'provider_quota_429'
): Promise<void> {
  if (!uid) return;
  const nowIso = new Date().toISOString();
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    const prev: Partial<UserAiUsageStats> = snap.exists() ? (snap.data()?.aiUsage || {}) : {};
    await setDoc(
      userRef,
      {
        aiUsage: {
          ...prev,
          quotaHitsCount: (Number(prev.quotaHitsCount) || 0) + 1,
          lastQuotaHitAt: nowIso,
          lastQuotaHitType: hitType,
          lastUpdatedAt: nowIso
        }
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('AI quota hit telemetry warning:', err);
  }
}
