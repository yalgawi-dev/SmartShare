/**
 * Single Source of Truth (DRY) for preparing Hebrew text for Gemini Neural TTS.
 * Ensures 100% pure Israeli Hebrew phonetics by stripping markdown/emojis/versions
 * and transliterating common Latin terms that otherwise trigger foreign accents.
 */
export function normalizeTextForHebrewTTS(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/[*_`#~>|]/g, '')
    .replace(/\(?\bv\d+\.\d+\.\d+\b\)?/gi, '')
    .replace(/₪/g, ' שקלים ')
    .replace(/-(\d[\d,.]*)/g, 'מינוס $1')
    .replace(/(\d[\d,.]*)-/g, 'מינוס $1')
    .replace(/SmartShare/gi, 'סמארט שייר')
    .replace(/MySpace/gi, 'מיי ספייס')
    .replace(/Yehuda\s+Algwi/gi, 'יהודה אלגווי')
    .replace(/Yehuda/gi, 'יהודה')
    .replace(/Algwi/gi, 'אלגווי')
    .replace(/\bAI\b/gi, 'איי איי')
    .replace(/\bPDF\b/gi, 'פי די אף')
    .replace(/\bWebP\b/gi, 'ווב פי')
    .replace(/Add to Home Screen/gi, 'הוסף למסך הבית')
    .replace(/\bSafari\b/gi, 'ספארי')
    .replace(/\bChrome\b/gi, 'כרום')
    .replace(/\biPhone\b/gi, 'אייפון')
    .replace(/\biOS\b/gi, 'איי או אס')
    .replace(/\bAirDrop\b/gi, 'אייר דרופ')
    .replace(/\bPWA\b/gi, 'אפליקציה')
    .replace(/\bAdd\b/g, 'הוסף')
    .replace(/\bExcel\b/gi, 'אקסל')
    .replace(/\b(DWFx|DWF|DWG|DXF|CAD)\b/gi, 'שרטוט')
    .replace(/\bWhatsApp\b/gi, 'וואטסאפ')
    .replace(/\bGoogle\b/gi, 'גוגל')
    .replace(/\bApple\b/gi, 'אפל')
    .replace(/\bAndroid\b/gi, 'אנדרואיד')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}
