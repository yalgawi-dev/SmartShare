const fs = require('fs');

const path = 'src/app/space/[id]/settings/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// 1. Add "סטטוס" header
const headerRegex = /<span style=\{\{ width: '70px', textAlign: 'center' \}\}>העלאה<\/span>/;
if (content.match(headerRegex)) {
  content = content.replace(headerRegex, `<span style={{ width: '70px', textAlign: 'center' }}>סטטוס</span>\n                          <span style={{ width: '70px', textAlign: 'center' }}>העלאה</span>`);
} else {
  console.log("Failed to find header regex");
}

// 2. Add "Dispute/Pending" badges and (הוסר) marker to the Name column
const nameRegex = /\{m\.name\} \{m\.userId === user\?\.id && <span style=\{\{ color: 'var\(--primary\)', fontSize: '0\.85rem' \}\}>\(אני\)<\/span>\}/;
const nameReplacement = `{m.name} {m.userId === user?.id && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>(אני)</span>}
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
                            )}`;
if (content.match(nameRegex)) {
  // wait, I also need to make sure I don't break the enclosing </div>.
  // The original string is inside `<div style={{ flex: 1, fontWeight: '500', fontSize: '0.95rem' }}>`.
  // Wait, I can just replace the inner contents.
  content = content.replace(nameRegex, nameReplacement);
} else {
  console.log("Failed to find name regex");
}

// 3. Add the Active Toggle before the 'canUpload' toggle
const uploadToggleRegex = /<div style=\{\{ width: '70px', display: 'flex', justifyContent: 'center' \}\}>\s*<label style=\{\{ display: 'flex', alignItems: 'center', cursor: 'pointer' \}\}>\s*<input type="checkbox" checked=\{m\.canUpload\}/;
const toggleReplacement = `<div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
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
                                <div style={{ width: '36px', height: '20px', background: m.isActive !== false ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.isActive !== false ? '2px' : '18px', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                </div>
                              </label>
                            </div>
                            
                            <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: m.isActive === false ? 0.5 : 1 }}>
                                <input type="checkbox" checked={m.canUpload} disabled={m.isActive === false}`;

if (content.match(uploadToggleRegex)) {
  content = content.replace(uploadToggleRegex, toggleReplacement);
} else {
  console.log("Failed to find upload regex");
}

// 4. Update the canDelete toggle to also have opacity/disabled
const deleteToggleRegex = /<input type="checkbox" checked=\{m\.canDelete\} onChange=\{e => updateMemberPermissions\(space\.id, m\.userId, \{ canDelete: e\.target\.checked \}\)\} style=\{\{ display: 'none' \}\} \/>/;
if (content.match(deleteToggleRegex)) {
  content = content.replace(deleteToggleRegex, `<input type="checkbox" checked={m.canDelete} onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} style={{ display: 'none' }} disabled={m.isActive === false} />`);
}
// Add opacity to the label wrapping it
const deleteLabelRegex = /<div style=\{\{ width: '70px', display: 'flex', justifyContent: 'center' \}\}>\s*<label style=\{\{ display: 'flex', alignItems: 'center', cursor: 'pointer' \}\}>\s*<input type="checkbox" checked=\{m\.canDelete\} disabled=\{m\.isActive === false\}/;
if (content.match(deleteLabelRegex)) {
  content = content.replace(deleteLabelRegex, `<div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>\n                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: m.isActive === false ? 0.5 : 1 }}>\n                                <input type="checkbox" checked={m.canDelete} disabled={m.isActive === false}`);
}

// 5. Add removeMember and restoreMember to useSpaces destructuring
const useSpacesRegex = /const \{ updateSpace, updateMemberPermissions, deleteSpace \} = useSpaces\(\);/;
if (content.match(useSpacesRegex)) {
  content = content.replace(useSpacesRegex, `const { updateSpace, updateMemberPermissions, deleteSpace, removeMember, restoreMember } = useSpaces();`);
} else {
  console.log("Failed to find useSpaces regex");
}

fs.writeFileSync(path, content, 'utf-8');
console.log('Successfully injected toggle and dispute badges');
