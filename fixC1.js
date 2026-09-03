const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/WelcomeGate.tsx', 'utf-8');

c = c.replace(
  "<strong>לידיעתך:</strong> הוגדרת כשותף מלא מהיום הראשון, כלומר החלק שלך יחושב גם מתוך ההוצאות ההיסטוריות שהיו בפרויקט עד כה.",
  "<strong>לידיעתך:</strong> הוגדרת כשותף מלא מהיום הראשון (חישוב רטרואקטיבי). אל דאגה, גם לאחר האישור תוכל תמיד לערוך אחוזים, לפתוח דיון או לשנות חשבוניות."
);

fs.writeFileSync('src/components/widgets/WelcomeGate.tsx', c);
console.log('Fixed WelcomeGate retro text');
