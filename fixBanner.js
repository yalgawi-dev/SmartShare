const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/PendingApprovalBanner.tsx', 'utf-8');

c = c.replace(
  "'השותף שהזמין אותך צירף אותך רטרואקטיבית. בחן את ההוצאות בלוח, האם החלוקה הנוכחית מקובלת עליך?'",
  "'השותף שהזמין אותך צירף אותך לחישוב רטרואקטיבי (כולל הוצאות קודמות). אל דאגה, תוכל תמיד לערוך חשבוניות, לפתוח עליהן דיון או לשנות אחוזים גם לאחר האישור. האם לאשר את השותפות כדי להתחיל?'"
);

fs.writeFileSync('src/components/widgets/PendingApprovalBanner.tsx', c);
console.log('Fixed pending banner text');
