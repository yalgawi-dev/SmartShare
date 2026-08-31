const fs = require('fs');
let content = fs.readFileSync('src/app/settings/page.tsx', 'utf-8');

// First replace `useSpaces();` to bring in `removeMember`
content = content.replace(
  'const { spaces, updateSpaceTitle } = useSpaces();',
  'const { spaces, updateSpaceTitle, removeMember } = useSpaces() as any;'
);
content = content.replace(
  'const { spaces, updateSpaceTitle } = useSpaces() as any;',
  'const { spaces, updateSpaceTitle, removeMember } = useSpaces() as any;'
);

const oldTextStart = "{uniqueMembers.map(contact => (";
const oldTextEnd = "))}";

const startIndex = content.indexOf(oldTextStart);
const endIndex = content.indexOf(oldTextEnd, startIndex) + oldTextEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{uniqueMembers.map(contact => {
                  const userSpaces = spaces.filter(s => s.members?.some(m => m.userId === contact.userId));
                  return (
                    <div key={contact.userId} style={{ border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.01)' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        {contact.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{contact.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          שותף ב: {userSpaces.map(s => s.title || 'פרויקט ללא שם').join(', ')}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm(\`האם אתה בטוח שברצונך למחוק את \${contact.name} מכל הפרויקטים שלך לחלוטין?\`)) {
                            userSpaces.forEach(s => removeMember(s.id, contact.userId, user?.id || 'admin'));
                          }
                        }}
                        style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid #ef4444', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#ef4444' }}
                      >
                        מחק לצמיתות
                      </button>
                    </div>
                  );
                })}`;

  content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
  fs.writeFileSync('src/app/settings/page.tsx', content, 'utf-8');
  console.log("Successfully replaced contact map");
} else {
  console.log("Failed to find index");
}
