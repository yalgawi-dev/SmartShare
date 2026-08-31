const fs = require('fs');
let content = fs.readFileSync('src/app/settings/page.tsx', 'utf-8');

// Ensure we have removeMember imported
if (!content.includes('removeMember')) {
  content = content.replace(
    'const { spaces, updateSpaceTitle } = useSpaces();',
    'const { spaces, updateSpaceTitle, removeMember } = useSpaces();'
  );
}

// Locate the return statement for uniqueMembers.map
const startMap = content.indexOf('{uniqueMembers.map(contact => (');
const endMap = content.indexOf('</div>\n              );', startMap);

if (startMap !== -1 && endMap !== -1) {
  const newMapLogic = `{uniqueMembers.map(contact => {
                  const userSpaces = spaces.filter(s => s.members?.some(m => m.userId === contact.userId));
                  return (
                    <div key={contact.userId} style={{ border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.01)' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        {contact.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{contact.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          שותף ב: {userSpaces.map(s => s.title).join(', ')}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm(\`האם אתה בטוח שברצונך למחוק את \${contact.name} מכל הפרויקטים שלך?\`)) {
                            userSpaces.forEach(s => removeMember(s.id, contact.userId, user?.id || 'admin'));
                          }
                        }}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-full)', border: '1px solid #ef4444', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#ef4444' }}
                      >
                        מחק איש קשר
                      </button>
                    </div>
                  );
                })}`;

  const beforeMap = content.slice(0, startMap);
  const afterMap = content.slice(endMap);
  
  // We need to replace the exact block.
  // Wait, the endMap is at "</div>\n              );" which means we replace everything inside.
  // Let's do it precisely.
  content = beforeMap + newMapLogic + "\n                " + afterMap;
  fs.writeFileSync('src/app/settings/page.tsx', content, 'utf-8');
  console.log('Settings page updated with delete contact feature');
} else {
  console.log('Could not find uniqueMembers map');
}
