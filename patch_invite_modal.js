const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', 'utf8');

const oldGenerateLink = `    return { link, shareTitle: 'הזמנה לפרויקט ' + space.title, shareText: \`היי! צירפתי אותך לפרויקט "\${space.title}" עם חלק של \${plannedGuestShare}%. לחץ כאן כדי להיכנס:\\n\${link}\` };
  };`;

const newGenerateLink = `    const isCollaborative = !(space.features || []).includes('finance');
    const textMsg = isCollaborative 
       ? \`היי! צירפתי אותך לשתף איתי פעולה במרחב "\${space.title}". לחץ כאן כדי להיכנס:\\n\${link}\`
       : \`היי! צירפתי אותך לפרויקט "\${space.title}" עם חלק של \${plannedGuestShare}%. לחץ כאן כדי להיכנס:\\n\${link}\`;
       
    return { link, shareTitle: 'הזמנה למרחב ' + space.title, shareText: textMsg };
  };`;

tx = tx.replace(oldGenerateLink, newGenerateLink);

// Replace UI conditions to hide things if isCollaborative
const oldRetro = `{/* Retroactive Settings */}`;
const newRetro = `const isCollaborativeMode = !(space.features || []).includes('finance');

        {/* Retroactive Settings */}`;
tx = tx.replace(oldRetro, newRetro);

// Wrap allocationMode, Retroactive inside `!isCollaborativeMode`
tx = tx.replace(/\{validMembers\.length > 0 && \(/g, '{!isCollaborativeMode && validMembers.length > 0 && (');
tx = tx.replace(/<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0\.5rem' \}\}>\s*<label style=\{\{ fontSize: '0\.85rem'/g, 
  '{!isCollaborativeMode && (\n          <div style={{ display: \'flex\', flexDirection: \'column\', gap: \'0.5rem\' }}>\n            <label style={{ fontSize: \'0.85rem\'');
tx = tx.replace(/<div style=\{\{ background: '#f8fafc', padding: '1rem', borderRadius: '12px'/g, 
  '{!isCollaborativeMode && (\n          <div style={{ background: \'#f8fafc\', padding: \'1rem\', borderRadius: \'12px\'');
tx = tx.replace(/\{\/\* Submit \/ Share Button \*\/\}/g, ')}\n        {/* Submit / Share Button */}');

// Make isBalanced always true if collaborative
const oldIsBalanced = `  const isBalanced = Math.abs(totalCalculated - 100) < 0.2;`;
const newIsBalanced = `  const isCollaborativeModeInner = !(space.features || []).includes('finance');\n  const isBalanced = isCollaborativeModeInner || Math.abs(totalCalculated - 100) < 0.2;`;
tx = tx.replace(oldIsBalanced, newIsBalanced);

// Force 0 for plannedGuestShare in collaborative
const oldPlanned = `  const { plannedGuestShare, plannedCreatorShare, plannedPartnerShares } = useMemo(() => {
    const totalCount = validMembers.length + 2;`;
const newPlanned = `  const { plannedGuestShare, plannedCreatorShare, plannedPartnerShares } = useMemo(() => {
    const isCollab = !(space.features || []).includes('finance');
    if (isCollab) {
      return { plannedGuestShare: 0, plannedCreatorShare: 100, plannedPartnerShares: {} };
    }
    const totalCount = validMembers.length + 2;`;
tx = tx.replace(oldPlanned, newPlanned);

fs.writeFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', tx);
console.log("Patched PartnersInviteModal");
