export interface ScreenContext {
  route: string;
  spaceId?: string;
  spaceTitle?: string;
  currentFolderId?: string | null;
  currentFolderName?: string;
  activeWidget?: 'fileshare' | 'documents' | 'accounting' | 'scanner' | 'partners' | 'gallery' | 'general';
  activeModal?: 'share' | 'move' | 'recycle_bin' | 'privacy' | 'invite' | null;
  userRole?: 'creator' | 'admin' | 'partner' | 'guest';
}

export interface AssistantTopic {
  id: string;
  title: string;
  keywords: string[];
  explanation: string;
  contextSuggestion?: string;
}

export const KNOWLEDGE_BASE: AssistantTopic[] = [
  {
    id: 'single_file_share',
    title: 'שיתוף קובץ בודד',
    keywords: ['קובץ', 'מסמך', 'שיתוף קובץ', 'לינק', 'קישור'],
    explanation: 'שיתוף של קובץ בודד (PDF, תוכנית, תמונה או גיליון) יוצר קישור ייעודי שחושף אך ורק את אותו הקובץ. כל שאר התיקיות, הקבצים והמרחב נשארים חסויים לחלוטין.',
    contextSuggestion: 'איך עובד שיתוף של קובץ יחיד?'
  },
  {
    id: 'folder_share_modes',
    title: 'שיתוף תיקייה (ברירת מחדל מול עץ מלא)',
    keywords: ['תיקייה', 'שיתוף תיקייה', 'עץ', 'תת תיקייה', 'נכדים', 'בנים', 'היררכיה'],
    explanation: 'בעת שיתוף תיקייה יש 2 מצבים:\n1. 📁 תיקייה זו בלבד (ברירת מחדל): האורח רואה רק את הקבצים הישירים ששוכבים בתיקייה, ותתי-התיקיות הפנימיות חסומות.\n2. 🌳 כולל תתי-תיקיות (עץ מלא): האורח רואה את התיקייה ואת כל תתי-התיקיות שמתחתיה (בנים, נכדים וכו׳). תיקיות אחיות או תיקיות אב במרחב לעולם אינן נחשפות.',
    contextSuggestion: 'האם שיתוף תיקייה חושף גם את תתי-התיקיות שבתוכה?'
  },
  {
    id: 'wall_share',
    title: 'שיתוף כל הקיר',
    keywords: ['קיר', 'שיתוף קיר', 'כל המרחב', 'שיתוף פרויקט'],
    explanation: 'כפתור שיתוף כל הקיר מאפשר ליצור קישור מרכזי לכל הפרויקט. ניתן לבחור האם לשתף את הקבצים הישירים בלבד או להפעיל עץ מלא שחושף את כלל התיקיות והקבצים.',
    contextSuggestion: 'איך לשתף את כל הקיר עם גורם חיצוני?'
  },
  {
    id: 'recipients_tracking',
    title: 'מעקב נמענים וקישורים אישיים',
    keywords: ['נמען', 'נמענים', 'מעקב', 'צפיות', 'זמן', 'מייק', 'לקוח', 'ספק', 'חסימה'],
    explanation: 'במקום לשלוח קישור אנונימי כללי, ניתן להוסיף שמות נמענים ייעודיים. כל נמען מקבל קישור אישי ייחודי, כך שתוכל לראות בדיוק מתי הוא פתח את הקישור, כמה פעמים, וכמה זמן הוא שהה במסמך, ואף לחסום אותו בקליק במידת הצורך.',
    contextSuggestion: 'איך פועל מעקב צפיות אישי לנמענים?'
  },
  {
    id: 'privacy_rules',
    title: 'פרטיות והרשאות (חוק ברירת מחדל 🌐 מול 🔒)',
    keywords: ['פרטיות', 'הרשאות', 'מנעול', 'גלובוס', 'שותפים'],
    explanation: 'על פי חוקי המערכת, כל מרחב, תיקייה ומסמך שנוצרים פתוחים כברירת מחדל לכל חברי המרחב (🌐). ניתן להגדיר תיקייה כפרטית עבורך בלבד (סולו) או לנעול אותה לשותפים ספציפיים (🔒).',
    contextSuggestion: 'מה ההבדל בין פריט פתוח 🌐 לבין פריט מוגבל 🔒?'
  },
  {
    id: 'recycle_bin',
    title: 'סל מחזור ושימור 12 שעות',
    keywords: ['מחיקה', 'פח', 'אשפה', 'סל מחזור', 'שחזור', '12 שעות'],
    explanation: 'פריטים שנמחקים עוברים לסל המחזור ונשמרים ל-12 שעות, כדי למנוע מחיקות שגויות. במהלך 12 השעות ניתן לשחזר אותם בלחיצת כפתור אחת. תיקיות שבסל אינן מופיעות כיעדי העברה.',
    contextSuggestion: 'האם ניתן לשחזר קובץ או תיקייה שנמחקו?'
  },
  {
    id: 'scans_and_webp',
    title: 'סריקה, חידוד וקבצי WebP',
    keywords: ['סריקה', 'סורק', 'חידוד', 'איכות', 'pdf', 'webp'],
    explanation: 'קבצי תמונות וסריקות מומרים בטעינה ל-WebP ברזולוציה אופטימלית וחדות מקסימלית, מה שמאפשר טעינה מיידית, חיסכון של 80%+ בנפח האחסון, ועבודה חלקה ביותר בנייד.',
    contextSuggestion: 'למה מסמכים סרוקים נשמרים כ-WebP?'
  }
];

/**
 * Intelligent context-aware answer generator based on current screen and query.
 */
export function queryAssistantBrain(query: string, context: ScreenContext): { answer: string; relatedTopicId?: string } {
  const cleanQ = query.toLowerCase().trim();

  // Find best matching topic
  let bestMatch: AssistantTopic | null = null;
  let highestScore = 0;

  for (const topic of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (cleanQ.includes(kw.toLowerCase())) {
        score += 2;
      }
    }
    if (cleanQ.includes(topic.title.toLowerCase())) {
      score += 4;
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = topic;
    }
  }

  if (bestMatch && highestScore > 0) {
    return {
      answer: bestMatch.explanation,
      relatedTopicId: bestMatch.id
    };
  }

  // Fallback intelligent response tailored to context
  if (context.activeWidget === 'fileshare') {
    return {
      answer: 'אתה נמצא כרגע בפורטל שיתוף הקבצים. מכאן ניתן ליצור תיקיות, להעלות מסמכים, להגדיר קישורי שיתוף מאובטחים ללקוחות וספקים, ולעקוב אחר צפיות בזמן אמת. על מה תרצה פירוט?'
    };
  }

  return {
    answer: 'שלום! אני העוזר האישי של SmartShare. אני כאן כדי ללוות אותך בכל פעולה, להסביר חוקיות של הרשאות, שיתופים, תיקיות וסריקות. על מה תרצה הסבר?'
  };
}

/**
 * Computes suggested context questions based on where the user currently is.
 */
export function getContextSuggestions(context: ScreenContext): string[] {
  if (context.activeModal === 'share') {
    return [
      'האם שיתוף תיקייה חושף גם תתי-תיקיות?',
      'איך עובד מעקב צפיות אישי לנמענים?',
      'מה קורה כאשר חוסמים נמען?'
    ];
  }

  if (context.activeWidget === 'fileshare') {
    if (context.currentFolderId) {
      return [
        'איך לשתף את התיקייה הזו כולל תתי-התיקיות?',
        'איך להעביר קבצים לתיקייה אחרת?',
        'האם שותף במרחב רואה את התיקייה הזו?'
      ];
    }
    return [
      'איך משתפים את כל הקיר?',
      'איך פועל סל המחזור ל-12 שעות?',
      'מה ההבדל בין 🌐 פתוח ל-🔒 מוגבל?'
    ];
  }

  return [
    'איך עובד שיתוף קבצים ותיקיות?',
    'מה החוקיות לגבי הרשאות שותפים?',
    'כיצד פועל מעקב הצפיות?'
  ];
}
