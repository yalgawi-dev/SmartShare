const fs = require('fs');

let gateTx = fs.readFileSync('src/components/widgets/Partners/WelcomeGate.tsx', 'utf8');

// 1. Add `isFinancial` detection
gateTx = gateTx.replace(
  `  const currentMember = space?.members?.find((m: any) => m.userId === resolvedToken);`,
  `  const isFinancial = space?.features?.includes('finance');\n  const currentMember = space?.members?.find((m: any) => m.userId === resolvedToken);`
);

// 2. Wrap financial terms in `{isFinancial && (...)}`
// The financial terms block starts at: `<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>`
// Which contains "חלוקת אחוזים מתוכננת"
gateTx = gateTx.replace(
  /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0\.75rem', marginBottom: '2rem' \}\}>/g,
  `{isFinancial && (<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>`
);

// It ends before the submit button which looks like `<button onClick={handleStart}`
gateTx = gateTx.replace(
  /\{\/\* Action Button \*\/\}/g,
  `)} {/* Action Button */}`
);

// 3. Update titles
gateTx = gateTx.replace(
  `הוזמנת להצטרף כשותף לצוות!`,
  `{isFinancial ? 'הוזמנת להצטרף כשותף לצוות!' : 'הוזמנת לשתף פעולה במרחב'}`
);

gateTx = gateTx.replace(
  `אישור כניסה והסכם שותפות`,
  `{isFinancial ? 'אישור כניסה והסכם שותפות' : 'היכנס למרחב'}`
);

fs.writeFileSync('src/components/widgets/Partners/WelcomeGate.tsx', gateTx);
console.log("Patched WelcomeGate successfully");
