/**
 * ADR-013: Graduated Autonomy Skill Compiler, Shadow Teacher Auditor & Circuit Breaker
 *
 * 100% App-Agnostic Universal Agent OS Engine:
 * - Stage 1 (Teacher): AI solves & executes new tasks; successful actions crystallize into local skills.
 * - Stage 2 (Apprentice + Dry-Run Shadow Audit): Local skill proposes immediately (~50ms) while AI Teacher
 *   audits in dry-run shadow mode in the background (never double-executing!).
 * - Stage 3 (Graduated Zero-AI Autonomy): After 5 consecutive shadow matches, runs locally at 0 tokens
 *   with 10% probabilistic spot-check audits + automatic re-audit on DOM/screen changes.
 * - Circuit Breaker: Any mismatch or execution error immediately quarantines the skill and routes back to AI.
 */

import type { AgentActionProposal } from './assistantActionRegistry';

export type SkillAutonomyStage = 'apprentice' | 'graduated' | 'quarantined';

export interface CompiledAgentSkill {
  id: string;
  tool: string;
  title: string;
  normalizedPattern: string;
  keywords: string[];
  stage: SkillAutonomyStage;
  verifiedStreak: number;
  mismatchCount: number;
  totalUses: number;
  lastUsedAt: number;
  lastAuditedAt?: number;
  createdAt: number;
}

const COMPILED_SKILLS_KEY = 'smartshare_agent_compiled_skills_v1';
const GRADUATION_STREAK_THRESHOLD = 5;
const SPOT_AUDIT_RATE = 0.1; // 10% spot-check audit on graduated skills

const NEGATION_WORDS = ['לא', 'אל', 'בלי', 'בטל', 'תעצרי', 'אל תעבירי', 'אל תמחקי', 'dont', "don't", 'never', 'stop'];

function normalizeIntent(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/["'׳״.,?!()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(norm: string): string[] {
  const stopWords = new Set(['את', 'אל', 'על', 'של', 'עם', 'זה', 'הזה', 'הזו', 'פה', 'כאן', 'לי', 'בבקשה', 'אני', 'רוצה']);
  return Array.from(
    new Set(
      norm
        .split(' ')
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && !stopWords.has(w))
    )
  ).slice(0, 8);
}

export function getCompiledSkills(): CompiledAgentSkill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPILED_SKILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCompiledSkills(skills: CompiledAgentSkill[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMPILED_SKILLS_KEY, JSON.stringify(skills.slice(0, 40)));
  } catch {}
}

/**
 * Stage 1 -> Stage 2: Crystallize a successful AI-proposed action into a local Apprentice Skill.
 */
export function recordSkillSuccessFromAI(userQuery: string, proposal: AgentActionProposal): CompiledAgentSkill | null {
  if (!proposal?.tool || proposal.tool.startsWith('ui_')) return null;
  const norm = normalizeIntent(userQuery);
  const keywords = extractKeywords(norm);
  if (keywords.length === 0) return null;

  const skills = getCompiledSkills();
  const existing = skills.find(
    (s) => s.tool === proposal.tool && s.keywords.filter((k) => keywords.includes(k)).length >= Math.min(2, keywords.length)
  );

  const now = Date.now();
  if (existing) {
    existing.totalUses += 1;
    existing.lastUsedAt = now;
    if (existing.stage === 'quarantined') {
      // Self-healed by AI Teacher! Re-enter Apprentice stage
      existing.stage = 'apprentice';
      existing.verifiedStreak = 1;
    } else {
      existing.verifiedStreak += 1;
      if (existing.verifiedStreak >= GRADUATION_STREAK_THRESHOLD) {
        existing.stage = 'graduated';
      }
    }
    saveCompiledSkills(skills);
    return existing;
  }

  const created: CompiledAgentSkill = {
    id: `skill_${now}_${Math.random().toString(36).slice(2, 6)}`,
    tool: proposal.tool,
    title: proposal.title || proposal.tool,
    normalizedPattern: norm.slice(0, 90),
    keywords,
    stage: 'apprentice',
    verifiedStreak: 1,
    mismatchCount: 0,
    totalUses: 1,
    lastUsedAt: now,
    createdAt: now,
  };
  skills.unshift(created);
  saveCompiledSkills(skills);
  return created;
}

/**
 * Matches a user query against non-quarantined local skills with strict safety guards:
 * - Rejects any negation words
 * - Requires high keyword overlap (>= 0.85)
 */
export function findMatchingCompiledSkill(userQuery: string): CompiledAgentSkill | null {
  const norm = normalizeIntent(userQuery);
  if (!norm) return null;
  if (NEGATION_WORDS.some((neg) => norm.includes(neg))) return null;

  const queryKeywords = extractKeywords(norm);
  if (queryKeywords.length === 0) return null;

  const skills = getCompiledSkills().filter((s) => s.stage !== 'quarantined');
  let best: { skill: CompiledAgentSkill; score: number } | null = null;

  for (const skill of skills) {
    if (skill.keywords.length === 0) continue;
    const overlap = skill.keywords.filter((k) => queryKeywords.includes(k)).length;
    const score = overlap / Math.max(skill.keywords.length, 1);
    if (score >= 0.85 && (!best || score > best.score)) {
      best = { skill, score };
    }
  }

  return best ? best.skill : null;
}

/**
 * Decides whether a dry-run Shadow Teacher Audit should run in the background:
 * - Apprentice skills: ALWAYS audited (100%)
 * - Graduated skills: 10% probabilistic spot-check audit
 */
export function shouldRunShadowTeacherAudit(skill: CompiledAgentSkill): boolean {
  if (skill.stage === 'apprentice') return true;
  if (skill.stage === 'graduated') {
    return Math.random() < SPOT_AUDIT_RATE;
  }
  return true;
}

/**
 * Records the result of a Dry-Run Shadow Teacher Diff (or execution outcome).
 * Circuit Breaker: Any mismatch immediately quarantines the skill and routes future runs to AI Teacher!
 */
export function recordShadowAuditOutcome(skillId: string, matched: boolean): CompiledAgentSkill | null {
  const skills = getCompiledSkills();
  const target = skills.find((s) => s.id === skillId);
  if (!target) return null;

  target.lastAuditedAt = Date.now();
  if (matched) {
    target.verifiedStreak += 1;
    if (target.stage === 'apprentice' && target.verifiedStreak >= GRADUATION_STREAK_THRESHOLD) {
      target.stage = 'graduated';
    }
  } else {
    target.mismatchCount += 1;
    target.verifiedStreak = 0;
    // Circuit Breaker tripped: quarantine skill so AI Teacher handles & heals it next time
    target.stage = 'quarantined';
  }

  saveCompiledSkills(skills);
  return target;
}
