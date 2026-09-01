const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/PartnersWidget.tsx', 'utf-8');

// Replace the column header
const headerRegex = /<th style=\{\{ padding: '0\.5rem', textAlign: 'center' \}\}>.*<\/th>/g;
// Actually I'll just search for the last <th> which is currently `פעולות`
content = content.replace(
  `<th style={{ padding: '0.5rem', textAlign: 'center' }}>פעולות</th>`,
  `<th style={{ padding: '0.5rem', textAlign: 'center' }}>סטטוס</th>`
);

// Replace the action cell with a toggle switch
const actionCellRegex = /<td style=\{\{ padding: '0\.5rem', textAlign: 'center' \}\}>\s*\{m\.isActive === false \? \([\s\S]*?<\/button>\s*\)\}\s*<\/td>/;
const newActionCell = `<td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', width: '36px', height: '20px', background: m.isActive !== false ? '#10b981' : '#cbd5e1', borderRadius: '20px', transition: 'all 0.3s' }}>
                          <div style={{ position: 'absolute', top: '2px', left: m.isActive !== false ? '18px' : '2px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                        <input 
                          type="checkbox" 
                          checked={m.isActive !== false} 
                          onChange={(e) => {
                            if (!e.target.checked) {
                              if (confirm(\`האם אתה בטוח שברצונך להסיר את \${m.name} מהשותפות? החובות שלו מחשבוניות עבר יישמרו, אך המערכת תבצע איזון מחדש לחשבוניות הבאות.\`)) {
                                removeMember(space.id, m.userId, user?.id || 'unknown');
                              }
                            } else {
                              restoreMember(space.id, m.userId, user?.id || 'unknown');
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: m.isActive !== false ? '#10b981' : '#94a3b8' }}>
                          {m.isActive !== false ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </label>
                    </td>`;

content = content.replace(actionCellRegex, newActionCell);
fs.writeFileSync('src/components/widgets/PartnersWidget.tsx', content, 'utf-8');
console.log('Replaced delete button with toggle in PartnersWidget');
