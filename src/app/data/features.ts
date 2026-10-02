export type FeatureId = string;

export interface Feature {
  id: FeatureId;
  name: string;
  desc: string;
  icon: string;
  requires?: FeatureId[];
  recommends?: FeatureId[];
  inDevelopment?: boolean;
}

export const AVAILABLE_FEATURES: Feature[] = [
  {
    id: 'chat',
    name: 'צ\'אט מרחב',
    desc: 'מערכת הודעות קבוצתית ואישית בין חברי המרחב',
    icon: '💬'
  },
  { id: 'finance', name: 'התחשבנות וחשבוניות', desc: 'סריקת חשבוניות וחלוקת הוצאות בין שותפים', icon: '💰', recommends: ['scanner', 'partners', 'cashbox'] },
  { id: 'income', name: 'הכנסות עסק', desc: 'תיעוד וחלוקת הכנסות ומכירות', icon: '💼', requires: ['finance'] },
  { id: 'cashbox', name: 'קופת מזומן', desc: 'העברות כספים וקופה קטנה משותפת', icon: '💸' , inDevelopment: true },
  { id: 'vault', name: 'מסמכים', desc: 'אחסון, ניהול ושיתוף חכם של המסמכים החשובים שלכם (חוזים, רשיונות, ביטוחים ועוד).', icon: '📁', inDevelopment: true },
  { id: 'scanner', name: 'סורק מסמכים', desc: 'סריקת חשבוניות ומסמכים רשמיים בצורה חכמה', icon: '🖨️', recommends: ['finance', 'vault'] },
  { id: 'gallery', name: 'מצלמה וגלריה', desc: 'צילום שטח ותמונות מהנייד לגלריה משותפת', icon: '📸' },
  { id: 'partners', name: 'שותפים לפרויקט', desc: 'ניהול חברי הפרויקט ואחוזי הבעלות', icon: '🤝', requires: ['finance'], recommends: ['chat'] },
  { id: 'suppliers', name: 'ספקים ובעלי מקצוע', desc: 'ריכוז קבלנים ונותני שירות', icon: '👷‍♂️' },
  { id: 'journal', name: 'יומן מעקב', desc: 'תיעוד זמנים והערות ביומן', icon: '📓' },
  { id: 'location', name: 'מיקום בזמן אמת', desc: 'שיתוף וצפייה במיקום המשתתפים על גבי מפה', icon: '📍' },
  { id: 'tasks', name: 'משימות וצ\'קליסטים', desc: 'מעקב אחר ביצוע משימות שוטפות', icon: '✅' },
  { id: 'guests', name: 'ניהול מוזמנים (RSVP)', desc: 'רשימת אורחים, הזמנות דיגיטליות ואישורי הגעה', icon: '💌' },
  { id: 'guestbook', name: 'ספר אורחים', desc: 'ברכות ואיחולים מהמשתתפים באירוע', icon: '✒️' },
  { id: 'lists', name: 'רשימות קניות', desc: 'רשימות ציוד וקניות משותפות', icon: '🛒' },
];

export const getFeatureById = (id: string) => AVAILABLE_FEATURES.find(f => f.id === id);
