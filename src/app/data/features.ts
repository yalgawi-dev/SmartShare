export const AVAILABLE_FEATURES = [
  { id: 'finance', name: 'התחשבנות וחשבוניות', desc: 'סריקת חשבוניות וחלוקת הוצאות בין שותפים', icon: '💰' },
  { id: 'cashbox', name: 'קופת מזומן', desc: 'העברות כספים וקופה קטנה משותפת', icon: '💵' },
  { id: 'vault', name: 'מסמכים ותוכניות', desc: 'אחסון מסמכים, תוכניות וקבצי PDF', icon: '📂' },
  { id: 'scanner', name: 'סורק מסמכים', desc: 'סריקת חשבוניות ומסמכים רשמיים בצורה חכמה', icon: '📠' },
  { id: 'camera', name: 'מצלמה וגלריה', desc: 'צילום שטח ותמונות מהנייד לגלריה משותפת', icon: '📷' },
  { id: 'partners', name: 'שותפים לפרויקט', desc: 'ניהול חברי הפרויקט ואחוזי הבעלות', icon: '🤝' },
  { id: 'suppliers', name: 'ספקים ובעלי מקצוע', desc: 'ריכוז קבלנים ונותני שירות', icon: '👷‍♂️' },
  { id: 'chat', name: 'צ\'אט פנימי', desc: 'קבוצת התכתבויות מאובטחת לחברי המרחב', icon: '💬' },
  { id: 'journal', name: 'יומן מעקב', desc: 'תיעוד זמנים והערות ביומן', icon: '📝' },
  { id: 'location', name: 'מיקום בזמן אמת', desc: 'שיתוף וצפייה במיקום המשתתפים על גבי מפה', icon: '📍' },
  { id: 'tasks', name: 'משימות וצ\'קליסטים', desc: 'מעקב אחר ביצוע משימות שוטפות', icon: '✅' },
  { id: 'guests', name: 'ניהול מוזמנים (RSVP)', desc: 'רשימת אורחים, הזמנות דיגיטליות ואישורי הגעה', icon: '💌' },
  { id: 'guestbook', name: 'ספר אורחים', desc: 'ברכות ואיחולים מהמשתתפים באירוע', icon: '✍️' },
  { id: 'lists', name: 'רשימות קניות', desc: 'רשימות ציוד וקניות משותפות', icon: '🛒' },
];

export const getFeatureById = (id: string) => AVAILABLE_FEATURES.find(f => f.id === id);
