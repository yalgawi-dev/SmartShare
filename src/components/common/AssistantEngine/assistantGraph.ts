import { APP_VERSION } from '@/constants/version';
import type { KnowledgeGraph } from './assistantMatcher';

/**
 * LIVING TWIN OF SMARTSHARE (Neural Map):
 * Must be updated alongside every feature/engine change so the Assistant always
 * reflects the exact architecture and rules of the live application.
 */
export const SMARTSHARE_GRAPH: KnowledgeGraph = {
  appName: 'SmartShare',
  version: APP_VERSION,
  nodes: [
    {
      id: 'home_spaces',
      title: 'מסך הבית ומרחבי עבודה',
      domain: 'ניווט ומרחבים',
      routePatterns: ['/'],
      widgets: ['general'],
      keywords: ['מרחב', 'מרחבים', 'פרויקט', 'דף הבית', 'יצירת מרחב', 'קיר', 'עבודה'],
      synonyms: ['ראשי', 'פתיחה', 'חדש', 'להתחיל'],
      explanation: 'במסך הבית מופיעים כל המרחבים (הפרויקטים) שלך — הן מרחבים שיצרת והן מרחבים ששותפת אליהם. ניתן ליצור מרחב חדש דרך כפתור "+ מרחב חדש", לעבור בין מרחבים, ולראות התראות וסטטוס כללי.',
      sampleQuestion: 'איך יוצרים מרחב עבודה חדש?',
      edges: ['space_overview', 'partners_management', 'privacy_rules']
    },
    {
      id: 'space_overview',
      title: 'בתוך מרחב עבודה וניהול מדפים',
      domain: 'ניווט ומרחבים',
      routePatterns: ['/space/'],
      widgets: ['general', 'fileshare', 'documents'],
      keywords: ['מדף', 'מדפים', 'נושא', 'נושאים', 'מרחב', 'הוסף כלים', 'עריכה'],
      synonyms: ['קטגוריה', 'חלוקה', 'לסדר', 'לנהל'],
      explanation: 'כל מרחב מחולק למדפים (נושאים) וכלים פעילים (כספת מסמכים, סורק, התחשבנויות, שותפים). דרך "הוסף כלים" בראש המרחב ניתן להפעיל או לכבות מנועים נוספים בכל רגע.',
      sampleQuestion: 'איך מוסיפים מדפים או כלים למרחב?',
      edges: ['vault_folders', 'single_file_share', 'partners_management']
    },
    {
      id: 'vault_folders',
      title: 'כספת מסמכים, תיקיות והיררכיה',
      domain: 'ניהול מסמכים',
      routePatterns: ['/space/'],
      widgets: ['fileshare', 'documents'],
      keywords: ['תיקייה', 'תת תיקייה', 'מסמך', 'העלאה', 'ייבוא', 'העברה', 'העתקה', 'כספת'],
      synonyms: ['קובץ', 'לשמור', 'להעביר', 'להעתיק', 'לסדר', 'תור', 'העלאת'],
      explanation: 'בכספת המסמכים ניתן ליצור תיקיות ותתי-תיקיות, להעלות קבצים ישירות (PDF, תמונות, תוכניות), או לייבא קבצים חיצוניים. ניתן להעביר או להעתיק פריטים בין תיקיות ומדפים באמצעות כלי הניהול של כל פריט.',
      sampleQuestion: 'איך מעלים, מייבאים או מעבירים קבצים ותיקיות?',
      edges: ['folder_share_modes', 'privacy_rules', 'recycle_bin']
    },
    {
      id: 'single_file_share',
      title: 'שיתוף קובץ בודד',
      domain: 'שיתוף ופרטיות',
      routePatterns: ['/space/', '/share/'],
      widgets: ['fileshare', 'documents'],
      modals: ['share'],
      keywords: ['שיתוף קובץ', 'קישור', 'לינק', 'קובץ בודד', 'לשתף'],
      synonyms: ['לשלוח', 'העברה', 'לקוח', 'חיצוני'],
      explanation: 'שיתוף של קובץ בודד (PDF, תוכנית, תמונה או גיליון) יוצר קישור ייעודי שחושף אך ורק את אותו הקובץ. כל שאר התיקיות, הקבצים והמרחב נשארים חסויים לחלוטין.',
      sampleQuestion: 'איך עובד שיתוף של קובץ יחיד?',
      edges: ['folder_share_modes', 'recipients_tracking', 'wall_share']
    },
    {
      id: 'folder_share_modes',
      title: 'שיתוף תיקייה (ברירת מחדל מול עץ מלא)',
      domain: 'שיתוף ופרטיות',
      routePatterns: ['/space/'],
      widgets: ['fileshare', 'documents'],
      modals: ['share'],
      keywords: ['שיתוף תיקייה', 'עץ', 'עץ מלא', 'תת תיקייה', 'נכדים', 'בנים', 'היררכיה'],
      synonyms: ['חושף', 'רואה', 'תיקייה פנימית'],
      explanation: 'בעת שיתוף תיקייה יש 2 מצבים:\n1. 📁 תיקייה זו בלבד (ברירת מחדל): האורח רואה רק את הקבצים הישירים ששוכבים בתיקייה, ותתי-התיקיות הפנימיות חסומות.\n2. 🌳 כולל תתי-תיקיות (עץ מלא): האורח רואה את התיקייה ואת כל תתי-התיקיות שמתחתיה (בנים, נכדים וכו׳). תיקיות אחיות או תיקיות אב במרחב לעולם אינן נחשפות.',
      sampleQuestion: 'האם שיתוף תיקייה חושף גם תתי-תיקיות?',
      edges: ['single_file_share', 'wall_share', 'recipients_tracking']
    },
    {
      id: 'wall_share',
      title: 'שיתוף כל הקיר (שיתוף פרויקט)',
      domain: 'שיתוף ופרטיות',
      routePatterns: ['/space/'],
      widgets: ['fileshare', 'documents'],
      modals: ['share'],
      keywords: ['שיתוף קיר', 'כל הקיר', 'שיתוף פרויקט', 'כל המרחב'],
      synonyms: ['הכל ביחד', 'קישור ראשי'],
      explanation: 'כפתור שיתוף כל הקיר מאפשר ליצור קישור מרכזי לכל הפרויקט. ניתן לבחור האם לשתף את הקבצים הישירים בלבד או להפעיל עץ מלא שחושף את כלל התיקיות והקבצים.',
      sampleQuestion: 'איך משתפים את כל הקיר עם גורם חיצוני?',
      edges: ['folder_share_modes', 'recipients_tracking', 'privacy_rules']
    },
    {
      id: 'recipients_tracking',
      title: 'מעקב נמענים, זמנים וחסימת גישה',
      domain: 'שיתוף ופרטיות',
      routePatterns: ['/space/', '/admin/'],
      widgets: ['fileshare', 'documents'],
      modals: ['share'],
      keywords: ['נמען', 'נמענים', 'מעקב', 'צפיות', 'זמן', 'שהייה', 'חסימה', 'לחסום'],
      synonyms: ['מי ראה', 'מתי פתח', 'כמה פעמים', 'לבטל קישור'],
      explanation: 'במקום לשלוח קישור אנונימי כללי, ניתן להוסיף שמות נמענים ייעודיים. כל נמען מקבל קישור אישי ייחודי, כך שתוכל לראות מתי הוא נכנס, כמה פעמים צפה וכמה זמן שהה במסמך — ואף לחסום או לשחרר אותו בקליק.',
      sampleQuestion: 'איך פועל מעקב צפיות אישי לנמענים?',
      edges: ['single_file_share', 'folder_share_modes', 'privacy_rules']
    },
    {
      id: 'privacy_rules',
      title: 'פרטיות והרשאות (🌐 פתוח לכולם מול 🔒 מוגבל)',
      domain: 'שיתוף ופרטיות',
      routePatterns: ['/space/', '/settings'],
      widgets: ['fileshare', 'documents', 'partners', 'general'],
      modals: ['privacy'],
      keywords: ['פרטיות', 'הרשאות', 'מנעול', 'גלובוס', 'פתוח', 'מוגבל', 'סולו', 'ירושה'],
      synonyms: ['נעלתי', 'חסום', 'גישה', 'מי רואה', 'הסתרה'],
      explanation: 'כל מרחב, מדף, תיקייה ומסמך שנוצרים פתוחים כברירת מחדל לכל חברי המרחב (🌐). ניתן לנעול פריט לשותפים ספציפיים או לעצמך בלבד (🔒). חשוב לדעת: הרשאה מפורשת לפריט פנימי נותנת גישה ישירה אליו גם אם תיקיית-האב שלו מוגבלת.',
      sampleQuestion: 'מה ההבדל בין 🌐 פתוח ל-🔒 מוגבל?',
      edges: ['partners_management', 'vault_folders', 'recipients_tracking']
    },
    {
      id: 'recycle_bin',
      title: 'סל מחזור ושחזור (שימור 12 שעות)',
      domain: 'ניהול מסמכים',
      routePatterns: ['/space/'],
      widgets: ['fileshare', 'documents'],
      modals: ['recycle_bin'],
      keywords: ['מחיקה', 'למחוק', 'מחקתי', 'נמחק', 'פח', 'אשפה', 'סל מחזור', 'שחזור', '12 שעות'],
      synonyms: ['להחזיר', 'טעות', 'איפה הקובץ'],
      explanation: 'פריטים שנמחקים עוברים לסל המחזור ונשמרים ל-12 שעות כדי למנוע מחיקות שגויות. במהלך 12 השעות ניתן לשחזר אותם בלחיצת כפתור אחת. תיקיות שבסל אינן מופיעות כיעדי העברה.',
      sampleQuestion: 'האם ניתן לשחזר קובץ או תיקייה שנמחקו?',
      edges: ['vault_folders', 'privacy_rules']
    },
    {
      id: 'scanner_webp_pdf',
      title: 'סורק מסמכים, PDF והעלאה מהירה',
      domain: 'כלים וצילום',
      routePatterns: ['/space/'],
      widgets: ['scanner', 'gallery', 'documents', 'fileshare'],
      keywords: ['סריקה', 'סורק', 'מצלמה', 'חידוד', 'איכות', 'pdf', 'webp', 'גודל', 'עמודים'],
      synonyms: ['לצלם', 'לסרוק', 'תמונה', 'קובץ כבד', 'דחיסה'],
      explanation: 'סורק המסמכים מזהה גבולות דף, משפר חדות וממיר סריקות ל-WebP קל ומהיר (חיסכון של 80%+ בנפח). מסמכי PDF מרובי עמודים עולים כקובץ בינארי ישיר לצפייה מיידית במציג המכשיר.',
      sampleQuestion: 'איך עובד סורק המסמכים ושמירת קבצי PDF?',
      edges: ['vault_folders', 'accounting_engine']
    },
    {
      id: 'accounting_engine',
      title: 'מנוע התחשבנויות, חשבוניות ודוחות',
      domain: 'פיננסים ושותפים',
      routePatterns: ['/space/', '/reports'],
      widgets: ['accounting', 'general'],
      keywords: ['התחשבנות', 'התחשבנויות', 'חשבונית', 'חשבוניות', 'קבלה', 'הוצאות', 'דוח', 'דוחות', 'אקסל', 'כסף'],
      synonyms: ['כמה חייב', 'תשלום', 'איזון', 'סיכום', 'פיננסי'],
      explanation: 'מנוע ההתחשבנויות מנהל הוצאות, חשבוניות ואיזונים בין שותפי המרחב. ניתן לאשר או לדחות הוצאות, לצפות בסיכום כספי לפי שותף, ולייצא דוחות מסודרים בקליק אחד.',
      sampleQuestion: 'איך עובד מנוע ההתחשבנויות והדוחות?',
      edges: ['partners_management', 'scanner_webp_pdf', 'space_overview']
    },
    {
      id: 'partners_management',
      title: 'ניהול שותפים והזמנת חברים למרחב',
      domain: 'פיננסים ושותפים',
      routePatterns: ['/space/'],
      widgets: ['partners', 'general'],
      modals: ['invite'],
      keywords: ['שותף', 'שותפים', 'הזמנה', 'להזמין', 'חבר', 'חברים', 'יוצר', 'מנהל'],
      synonyms: ['לצרף', 'מי במרחב', 'להוסיף מישהו'],
      explanation: 'במנוע השותפים ניתן להזמין אנשים למרחב העבודה, להגדיר תפקידים, ולעקוב אחר שותפים פעילים. הצטרפות למרחב מאפשרת שיתוף פעולה במסמכים ובהתחשבנויות בהתאם להרשאות (🌐/🔒).',
      sampleQuestion: 'איך מזמינים שותפים חדשים למרחב?',
      edges: ['privacy_rules', 'accounting_engine', 'home_spaces']
    },
    {
      id: 'auth_and_pwa',
      title: 'התחברות, אבטחה והתקנת אפליקציה (PWA)',
      domain: 'מערכת והגדרות',
      routePatterns: ['/settings', '/'],
      widgets: ['general'],
      keywords: ['התחברות', 'טלפון', 'קוד', 'sms', 'ספאם', 'גוגל', 'אפל', 'התקנה', 'אפליקציה', 'מסך הבית', 'pwa'],
      synonyms: ['להתקין', 'להיכנס', 'סיסמה', 'אימות', 'אנדרואיד', 'אייפון'],
      explanation: 'ההתחברות מתבצעת בצורה מאובטחת עם Google, Apple או קוד אימות SMS. ניתן להתקין את SmartShare כאפליקציה על מסך הבית: באנדרואיד בלחיצה אחת ישירה, ובאייפון דרך כפתור השיתוף של Safari ← "הוסף למסך הבית".',
      sampleQuestion: 'איך מתקינים את האפליקציה על הטלפון?',
      edges: ['home_spaces', 'privacy_rules']
    },
    {
      id: 'assistant_capabilities',
      title: 'יכולות הסוכן החכם ועדכונים',
      domain: 'עוזר אישי',
      routePatterns: ['/'],
      widgets: ['general'],
      keywords: ['סוכן', 'עוזר', 'בוט', 'להזיז', 'דיבור', 'קול', 'מיקרופון', 'עזרה'],
      synonyms: ['מי אתה', 'מה אתה יודע', 'איך להשתמש בך'],
      explanation: `אני הסוכן המובנה של SmartShare (גרסה ${APP_VERSION}). אני עוקב אחרי המיקום שלך באפליקציה, מכיר את כל המנועים וההרשאות, ויודע לענות בכתב ובקול. ניתן לגרור את האייקון שלי לכל מקום נוח על המסך.`,
      sampleQuestion: 'מה הסוכן יודע לעשות כאן?',
      edges: ['home_spaces', 'space_overview', 'privacy_rules']
    }
  ]
};
