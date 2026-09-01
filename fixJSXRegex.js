const fs = require('fs');

const path = 'src/app/space/[id]/settings/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

const regex = /<div style=\{\{ flex: 1, fontWeight: '500', fontSize: '0\.95rem' \}\}>[\s\S]*?\{m\.status === 'disputed'[\s\S]*?\{m\.disputeMessage\}\s*<\/div>\s*\)\}\s*<\/div>/m;
const match = content.match(regex);
if (match) {
  const replacement = `<div style={{ flex: 1, fontWeight: '500', fontSize: '0.95rem' }}>
                              <div>
                                {m.name} {m.userId === user?.id && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>(אני)</span>}
                                {m.isActive === false && <span style={{ color: '#ef4444', fontSize: '0.85rem' }}> (לא פעיל)</span>}
                              </div>
                              {m.status === 'pending' && (
                                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem', fontWeight: 'bold' }}>
                                  ⏳ ממתין לאישור השותף
                                </div>
                              )}
                              {m.status === 'disputed' && (
                                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.2rem', background: '#fef2f2', padding: '0.4rem', borderRadius: '4px' }}>
                                  <strong>יש השגה:</strong> {m.disputeMessage}
                                </div>
                              )}
                            </div>`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Fixed broken JSX with regex');
} else {
  console.log('Could not find regex match');
}
