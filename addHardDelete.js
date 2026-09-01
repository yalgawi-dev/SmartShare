const fs = require('fs');

const path = 'src/app/space/[id]/settings/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// I need to add a Trash can if isActive === false next to the toggle
const regex = /<label style=\{\{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0\.25rem' \}\}>[\s\S]*?<\/label>/;
const match = content.match(regex);
if (match) {
  const replacement = `<label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.25rem' }}>
                                <input 
                                  type="checkbox" 
                                  checked={m.isActive !== false} 
                                  onChange={(e) => {
                                    if (!e.target.checked) {
                                      if (confirm(\`האם אתה בטוח שברצונך להסיר את \${m.name} מהשותפות? החובות מחשבוניות עבר יישמרו, אך המערכת תבצע איזון מחדש לחשבוניות הבאות.\`)) {
                                        removeMember(space.id, m.userId, user?.id || 'unknown');
                                      }
                                    } else {
                                      restoreMember(space.id, m.userId, user?.id || 'unknown');
                                    }
                                  }}
                                  style={{ display: 'none' }}
                                />
                                <div style={{ width: '36px', height: '20px', background: m.isActive !== false ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.isActive !== false ? '2px' : '18px', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                </div>
                              </label>
                              {m.isActive === false && (
                                <button 
                                  onClick={() => {
                                    if (confirm(\`מחיקה לצמיתות (Hard Delete): האם אתה בטוח שברצונך למחוק את \${m.name} כליל מהפרויקט? פעולה זו תמחק גם את ההיסטוריה שלו.\`)) {
                                      removeMember(space.id, m.userId, user?.id || 'unknown', true);
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.2rem', padding: '0 0.25rem' }}
                                  title="מחיקה לצמיתות"
                                >
                                  🗑️
                                </button>
                              )}`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("Added hard delete button");
} else {
  console.log("Failed to match toggle regex");
}
