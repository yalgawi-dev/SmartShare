const fs = require('fs');

let modalTx = fs.readFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', 'utf8');

// 1. Add `isFinancial` detection inside component
modalTx = modalTx.replace(
  `  const [customShare, setCustomShare] = useState('10');`,
  `  const [customShare, setCustomShare] = useState('10');\n  const isFinancial = space.features?.includes('finance');`
);

// 2. Wrap the configuration UI (allocationMode, retro, pie chart) in `{isFinancial && (...)}`
// The configuration UI starts right after the header:
// `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}> ... </div>`
const headerMatch = modalTx.match(/<button onClick=\{onClose\} style=\{\{ background: 'transparent', border: 'none', fontSize: '1\.5rem', cursor: 'pointer', color: '#64748b' \}\}>×<\/button>\s*<\/div>/);
if (headerMatch) {
  modalTx = modalTx.replace(headerMatch[0], headerMatch[0] + '\n\n        {isFinancial && (<>');
}

// And it ends right before `{/* Submit / Share Button */}`
modalTx = modalTx.replace(
  `{/* Submit / Share Button */}`,
  `</>)}\n        {/* Submit / Share Button */}`
);

// 3. Update the header title and description based on isFinancial
modalTx = modalTx.replace(
  `הזמנת שותף חדש (v3.8)`,
  `{isFinancial ? 'הזמנת שותף פיננסי' : 'הזמנת משתף פעולה'}`
);
modalTx = modalTx.replace(
  `הגדרת שותפות ואחוזים מראש`,
  `{isFinancial ? 'הגדרת שותפות ואחוזים מראש' : 'שיתוף גישה למרחב'}`
);

// 4. Force planned shares and balance when NOT financial
modalTx = modalTx.replace(
  `const { plannedGuestShare, plannedCreatorShare, plannedPartnerShares } = useMemo(() => {`,
  `const { plannedGuestShare, plannedCreatorShare, plannedPartnerShares } = useMemo(() => {\n    if (!isFinancial) return { plannedGuestShare: 0, plannedCreatorShare: 100, plannedPartnerShares: {} };`
);
modalTx = modalTx.replace(
  `const isBalanced = Math.abs(totalCalculated - 100) < 0.2;`,
  `const isBalanced = !isFinancial || Math.abs(totalCalculated - 100) < 0.2;`
);

// 5. Update WhatsApp text in `handleGenerateLink`
modalTx = modalTx.replace(
  `shareText: \`היי! צירפתי אותך לפרויקט "\${space.title}" עם חלק של \${plannedGuestShare}%. לחץ כאן כדי להיכנס:\\n\${link}\``,
  `shareText: isFinancial ? \`היי! צירפתי אותך לפרויקט "\${space.title}" עם חלק של \${plannedGuestShare}%. לחץ כאן כדי להיכנס:\\n\${link}\` : \`היי! הוזמנת לשתף פעולה במרחב "\${space.title}". לחץ כאן כדי להיכנס:\\n\${link}\``
);

fs.writeFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', modalTx);
console.log("Patched PartnersInviteModal successfully");
