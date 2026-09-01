const fs = require('fs');

const path = 'src/app/space/[id]/settings/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Target the toggle block
const targetRegex = /<label style=\{\{ display: 'flex', alignItems: 'center', cursor: 'pointer' \}\}>\s*<input\s*type="checkbox"\s*checked=\{m\.isActive !== false\}\s*onChange=\{\(e\) => \{[\s\S]*?\}\}\s*style=\{\{ display: 'none' \}\}\s*\/>\s*<div style=\{\{ width: '36px', height: '20px', background: m\.isActive !== false \? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0\.3s' \}\}>\s*<div style=\{\{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m\.isActive !== false \? '2px' : '18px', transition: '0\.3s', boxShadow: '0 1px 3px rgba\(0,0,0,0\.3\)' \}\} \/>\s*<\/div>\s*<\/label>/m;

const replacement = `<label style={{ display: 'flex', alignItems: 'center', cursor: m.userId === user?.id ? 'not-allowed' : 'pointer', opacity: m.userId === user?.id ? 0.5 : 1 }} title={m.userId === user?.id ? "לא ניתן להסיר את עצמך מהפרויקט" : ""}>
                                <input 
                                  type="checkbox" 
                                  checked={m.isActive !== false} 
                                  disabled={m.userId === user?.id}
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
                                <div style={{ width: '36px', height: '20px', background: m.isActive !== false ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.isActive !== false ? '2px' : '18px', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                </div>
                              </label>`;

if (content.match(targetRegex)) {
  content = content.replace(targetRegex, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("Successfully disabled toggle for self");
} else {
  console.log("Failed to match toggle regex");
}
