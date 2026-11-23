/**
 * Single Source of Truth (DRY) for Assistant Voice Personas & Human Greetings.
 * 4 Israeli personas (2 Female, 2 Male) with distinct Gemini Neural TTS voices,
 * portrait avatars, grammatical gender, and natural returning-user greetings.
 */

import { formatNameInHebrew } from '@/utils/shareMessageFormatter';

export type AssistantPersonaId = 'dana' | 'shimrit' | 'avi' | 'asaf';

export interface AssistantPersona {
  id: AssistantPersonaId;
  name: string;
  gender: 'female' | 'male';
  roleLabel: string;
  voiceTagline: string;
  avatarUrl: string;
  geminiVoiceName: string;
  gcpVoiceName: string;
  sampleLine: string;
  accentColor: string;
}

export const ASSISTANT_PERSONAS: AssistantPersona[] = [
  {
    id: 'dana',
    name: 'דנה',
    gender: 'female',
    roleLabel: 'העוזרת האישית שלך',
    voiceTagline: 'קול נשי צלול וצעיר',
    avatarUrl: '/avatars/assistant/dana.jpg',
    geminiVoiceName: 'Kore',
    gcpVoiceName: 'he-IL-Wavenet-A',
    sampleLine: 'היי! אני דנה, שמחה לעזור לך לנהל את הכל בקלות ובמהירות.',
    accentColor: '#4f46e5',
  },
  {
    id: 'shimrit',
    name: 'שימרית',
    gender: 'female',
    roleLabel: 'העוזרת האישית שלך',
    voiceTagline: 'קול נשי חם ורגוע',
    avatarUrl: '/avatars/assistant/shimrit.jpg',
    geminiVoiceName: 'Leda',
    gcpVoiceName: 'he-IL-Wavenet-C',
    sampleLine: 'שלום, אני שימרית. אני כאן איתך לכל שאלה, סידור או שיתוף.',
    accentColor: '#7c3aed',
  },
  {
    id: 'avi',
    name: 'אבי',
    gender: 'male',
    roleLabel: 'העוזר האישי שלך',
    voiceTagline: 'קול גברי עמוק ויציב',
    avatarUrl: '/avatars/assistant/avi.jpg',
    geminiVoiceName: 'Charon',
    gcpVoiceName: 'he-IL-Wavenet-B',
    sampleLine: 'אהלן, אני אבי. תגיד לי מה צריך לבצע ואני מטפל בזה מיד.',
    accentColor: '#0284c7',
  },
  {
    id: 'asaf',
    name: 'אסף',
    gender: 'male',
    roleLabel: 'העוזר האישי שלך',
    voiceTagline: 'קול גברי קליל וידידותי',
    avatarUrl: '/avatars/assistant/asaf.svg',
    geminiVoiceName: 'Puck',
    gcpVoiceName: 'he-IL-Wavenet-D',
    sampleLine: 'היי! אני אסף, בוא נתקתק יחד את כל המשימות והקבצים שלך.',
    accentColor: '#059669',
  },
];

const PERSONA_STORAGE_KEY = 'smartshare_assistant_persona_v1';
const HAS_MET_STORAGE_KEY = 'smartshare_assistant_has_met_v1';

export function getPersonaById(id?: string | null): AssistantPersona {
  return ASSISTANT_PERSONAS.find((p) => p.id === id) || ASSISTANT_PERSONAS[0];
}

export function loadSavedPersonaId(): AssistantPersonaId {
  if (typeof window === 'undefined') return 'dana';
  try {
    const saved = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (saved && ASSISTANT_PERSONAS.some((p) => p.id === saved)) {
      return saved as AssistantPersonaId;
    }
  } catch {}
  return 'dana';
}

export function savePersonaId(id: AssistantPersonaId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERSONA_STORAGE_KEY, id);
  } catch {}
}

export function hasMetAssistantBefore(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(HAS_MET_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAssistantMet(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HAS_MET_STORAGE_KEY, '1');
  } catch {}
}

/**
 * Extracts a friendly Hebrew first name from any user object (converting English names to Hebrew).
 */
export function getFriendlyHebrewFirstName(rawName?: string | null): string {
  if (!rawName) return '';
  const hebrewFull = formatNameInHebrew(rawName);
  return hebrewFull.split(/\s+/)[0] || '';
}

/**
 * Builds a warm, natural human greeting:
 * - First time ever: friendly 1-sentence intro with the persona's name.
 * - Returning user: short, familiar, human greeting (like talking to someone you already know!).
 */
export function buildHumanGreeting(
  persona: AssistantPersona,
  rawUserName?: string | null,
  isFirstTime = false
): string {
  const firstName = getFriendlyHebrewFirstName(rawUserName);
  const namePart = firstName ? ` ${firstName}` : '';

  if (isFirstTime) {
    return persona.gender === 'female'
      ? `היי${namePart}! אני ${persona.name}, ${persona.roleLabel} כאן. נעים להכיר! במה אוכל לעזור לך?`
      : `היי${namePart}! אני ${persona.name}, ${persona.roleLabel} כאן. נעים להכיר! במה אוכל לעזור לך?`;
  }

  const hour = new Date().getHours();
  const timeGreeting =
    hour >= 5 && hour < 12
      ? `בוקר טוב${namePart}!`
      : hour >= 12 && hour < 17
        ? `צהריים טובים${namePart}!`
        : hour >= 17 && hour < 22
          ? `ערב טוב${namePart}!`
          : `היי${namePart}!`;

  const returningVariants =
    persona.gender === 'female'
      ? [
          `${timeGreeting} מה נשמע? במה נטפל עכשיו?`,
          `היי${namePart}, אני כאן. איך אפשר לעזור?`,
          `אהלן${namePart}! מה עושים עכשיו?`,
        ]
      : [
          `${timeGreeting} מה נשמע? במה נטפל עכשיו?`,
          `אהלן${namePart}, אני כאן. מה צריך לבצע?`,
          `היי${namePart}! במה אוכל לעזור לך עכשיו?`,
        ];

  const pick = returningVariants[Math.floor(Math.random() * returningVariants.length)];
  return pick;
}
