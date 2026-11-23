/**
 * Single Source of Truth (DRY) for personal, pure-Hebrew share messages (WhatsApp / Copy / Email / Native).
 * - Automatically converts English/Latin user names (from Google Sign-In) into natural Hebrew
 *   so every message stays 100% single-language Hebrew with clean RTL direction.
 * - Eliminates technical jargon ("ממרחב"), avoids duplicating project/folder names,
 *   and prevents WhatsApp BiDi scrambling around numbers using Unicode RLM (\u200F).
 */

const RLM = '\u200F';

const COMMON_HEBREW_NAMES: Record<string, string> = {
  yehuda: 'יהודה',
  algwi: 'אלגווי',
  alga: 'אלגא',
  david: 'דוד',
  moshe: 'משה',
  yossi: 'יוסי',
  yosef: 'יוסף',
  avi: 'אבי',
  avraham: 'אברהם',
  asaf: 'אסף',
  assaf: 'אסף',
  dana: 'דנה',
  shimrit: 'שימרית',
  sharon: 'שרון',
  daniel: 'דניאל',
  daniela: 'דניאלה',
  michael: 'מיכאל',
  omer: 'עומר',
  noam: 'נועם',
  ron: 'רון',
  roni: 'רוני',
  tal: 'טל',
  gal: 'גל',
  or: 'אור',
  ori: 'אורי',
  eli: 'אלי',
  eliyahu: 'אליהו',
  shimon: 'שמעון',
  yaakov: 'יעקב',
  yitzhak: 'יצחק',
  itzik: 'איציק',
  shlomo: 'שלמה',
  chaim: 'חיים',
  haim: 'חיים',
  eyal: 'אייל',
  eran: 'ערן',
  yuval: 'יובל',
  amit: 'עמית',
  ido: 'עידו',
  itay: 'איתי',
  rotem: 'רותם',
  maya: 'מאיה',
  noa: 'נועה',
  tamar: 'תמר',
  michal: 'מיכל',
  yael: 'יעל',
  sarah: 'שרה',
  rachel: 'רחל',
  shira: 'שירה',
  lior: 'ליאור',
  bar: 'בר',
  ben: 'בן',
  guy: 'גיא',
  nir: 'ניר',
  ran: 'רן',
  ofer: 'עופר',
  alon: 'אלון',
  amir: 'אמיר',
  ariel: 'אריאל',
  cohen: 'כהן',
  levi: 'לוי',
  levy: 'לוי',
  mizrahi: 'מזרחי',
  peretz: 'פרץ',
  biton: 'ביטון',
  dahan: 'דהן',
  avitan: 'אביטן',
  friedman: 'פרידמן',
  katz: 'כץ',
  azulay: 'אזולאי',
  malka: 'מלכה',
  hadad: 'חדד',
  amar: 'עמר',
  ohayon: 'אוחיון',
  gabay: 'גבאי',
  gabbay: 'גבאי',
  benjamin: 'בנימין',
};

function transliterateWordToHebrew(word: string): string {
  const clean = word.trim();
  if (!clean) return '';
  // Already contains Hebrew letters -> keep untouched
  if (/[\u0590-\u05FF]/.test(clean)) return clean;
  // Numbers or punctuation -> keep untouched
  if (!/[a-zA-Z]/.test(clean)) return clean;

  const lower = clean.toLowerCase();
  if (COMMON_HEBREW_NAMES[lower]) return COMMON_HEBREW_NAMES[lower];

  // Generic phonetic Latin -> Hebrew transliteration for any external user's English name
  let out = '';
  let i = 0;
  while (i < lower.length) {
    const pair = lower.slice(i, i + 2);
    const ch = lower[i];
    if (pair === 'sh') { out += 'ש'; i += 2; continue; }
    if (pair === 'ch' || pair === 'kh') { out += 'ח'; i += 2; continue; }
    if (pair === 'th') { out += 'ת'; i += 2; continue; }
    if (pair === 'ph') { out += 'פ'; i += 2; continue; }
    if (pair === 'tz' || pair === 'ts') { out += 'צ'; i += 2; continue; }
    if (pair === 'ee' || pair === 'oo') { out += pair === 'ee' ? 'י' : 'ו'; i += 2; continue; }

    switch (ch) {
      case 'a': out += i === 0 || i === lower.length - 1 ? 'א' : ''; break;
      case 'e': out += i === 0 ? 'א' : (i === lower.length - 1 ? 'ה' : ''); break;
      case 'i': out += i === 0 ? 'אי' : 'י'; break;
      case 'o': out += i === 0 ? 'או' : 'ו'; break;
      case 'u': out += i === 0 ? 'או' : 'ו'; break;
      case 'y': out += 'י'; break;
      case 'b': out += 'ב'; break;
      case 'c': out += 'ק'; break;
      case 'd': out += 'ד'; break;
      case 'f': out += 'פ'; break;
      case 'g': out += 'ג'; break;
      case 'h': out += 'ה'; break;
      case 'j': out += 'ג׳'; break;
      case 'k': out += 'ק'; break;
      case 'l': out += 'ל'; break;
      case 'm': out += 'מ'; break;
      case 'n': out += 'נ'; break;
      case 'p': out += 'פ'; break;
      case 'q': out += 'ק'; break;
      case 'r': out += 'ר'; break;
      case 's': out += 'ס'; break;
      case 't': out += 'ט'; break;
      case 'v': case 'w': out += 'ו'; break;
      case 'x': out += 'קס'; break;
      case 'z': out += 'ז'; break;
      default: break;
    }
    i++;
  }

  // Convert trailing letters to proper Hebrew final forms (אותיות סופיות)
  out = out
    .replace(/מ$/, 'ם')
    .replace(/נ$/, 'ן')
    .replace(/צ$/, 'ץ')
    .replace(/פ$/, 'ף');

  return out || clean;
}

/**
 * Ensures any person/business name is displayed cleanly in Hebrew (never mixed Latin in Hebrew sentences).
 */
export function formatNameInHebrew(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map(transliterateWordToHebrew)
    .filter(Boolean)
    .join(' ');
}

function wrapRtlSafe(text: string): string {
  return `${RLM}${text.trim()}${RLM}`;
}

export interface BuildShareMessageParams {
  recipientName?: string;
  senderRawName?: string;
  businessName?: string;
  spaceTitle?: string;
  itemName: string;
  itemType: 'file' | 'folder';
  url: string;
  pin?: string;
  businessCard?: {
    slogan?: string;
    phone?: string;
    whatsapp?: string;
    portfolioUrl?: string;
  };
}

/**
 * Builds a warm, personal, 100% Hebrew share message with clean RTL BiDi safety.
 */
export function buildPersonalHebrewShareMessage(params: BuildShareMessageParams): string {
  const {
    recipientName,
    senderRawName,
    businessName,
    spaceTitle,
    itemName,
    itemType,
    url,
    pin,
    businessCard,
  } = params;

  const hebrewRecipient = recipientName ? formatNameInHebrew(recipientName) : '';
  const hebrewSender = formatNameInHebrew(senderRawName || businessName || '');
  const hebrewBusiness = businessName && senderRawName ? formatNameInHebrew(businessName) : '';
  const senderLabel = hebrewSender
    ? hebrewBusiness && hebrewBusiness !== hebrewSender
      ? `${hebrewSender} (${hebrewBusiness})`
      : hebrewSender
    : 'חבר';

  const cleanItemName = (itemName || '').trim();
  const cleanSpaceTitle = (spaceTitle || '').trim();
  const itemSameAsSpace =
    !cleanSpaceTitle ||
    cleanItemName.toLowerCase() === cleanSpaceTitle.toLowerCase() ||
    cleanItemName.toLowerCase().includes(cleanSpaceTitle.toLowerCase());

  const itemPhrase =
    itemType === 'folder'
      ? `את תיקיית ${wrapRtlSafe(cleanItemName)} 📁`
      : `את הקובץ ${wrapRtlSafe(cleanItemName)} 📄`;

  const contextSuffix = !itemSameAsSpace ? ` (${wrapRtlSafe(cleanSpaceTitle)})` : '';

  const greeting = hebrewRecipient ? `היי ${wrapRtlSafe(hebrewRecipient)},` : 'היי,';
  const mainLine = `${RLM}${senderLabel} שיתף איתך ${itemPhrase}${contextSuffix}`;
  const pinLine = pin ? `\n🔐 קוד גישה: ${pin}` : '';

  const extraLines: string[] = [];
  if (businessCard?.slogan) extraLines.push(`✨ ${businessCard.slogan}`);
  const phone = businessCard?.phone || businessCard?.whatsapp;
  if (phone) extraLines.push(`📞 ליצירת קשר: ${phone}`);
  if (businessCard?.portfolioUrl) extraLines.push(`🎨 תיק עבודות: ${businessCard.portfolioUrl}`);
  const footer = extraLines.length > 0 ? `\n\n${extraLines.join('\n')}` : '';

  return `${greeting}\n${mainLine}${pinLine}\n\nלצפייה נוחה ומאובטחת לחץ כאן:\n${url}${footer}`;
}
