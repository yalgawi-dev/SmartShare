const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', 'utf8');

// Destructure updateMemberRole
code = code.replace(
  'const { approveExtension, removeMember, updateMemberStatus, approveShareChange, rejectShareChange } = useSpaces() as any;',
  'const { approveExtension, removeMember, updateMemberStatus, updateMemberRole, approveShareChange, rejectShareChange } = useSpaces() as any;'
);

// Add handlers
const roleHandlers = `
  const handleMakeAdmin = () => {
    if (confirm(\`להגדיר את "\${memberName}" כמנהל למרחב זה?\`)) {
      if(typeof updateMemberRole === 'function') updateMemberRole(space.id, member.userId, 'admin');
    }
  };

  const handleRemoveAdmin = () => {
    if (confirm(\`להסיר את הרשאות הניהול של "\${memberName}"?\`)) {
      if(typeof updateMemberRole === 'function') updateMemberRole(space.id, member.userId, 'partner');
    }
  };
`;

code = code.replace(
  'const handleRemove = () => {',
  roleHandlers + '\n  const handleRemove = () => {'
);

// Add the UI buttons. We want it in viewMode === 'creator' and if the member is NOT a creator.
// Replace the buttons block starting with `<button onClick={handleRemove}` or somewhere near.
// Let's add it before `🗑️ הסר`
const newButtons = `
              {member.role !== 'creator' && member.role !== 'admin' && (
                <button onClick={handleMakeAdmin} style={{ background: '#fef3c7', color: '#92400e', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  👑 הגדר כמנהל
                </button>
              )}
              {member.role === 'admin' && (
                <button onClick={handleRemoveAdmin} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  👤 בטל ניהול
                </button>
              )}
              {memberStatus !== 'active' && (
`;

code = code.replace(
  "{memberStatus !== 'active' && (",
  newButtons
);

fs.writeFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', code);
console.log('PartnerControlPanel patched for roles!');
