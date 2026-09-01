const fs = require('fs');
let content = fs.readFileSync('src/app/space/[id]/settings/page.tsx', 'utf-8');

// Replace the header
const headerTarget = `<div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <span style={{ flex: 1 }}>שם השותף</span>
                          <span style={{ width: '70px', textAlign: 'center' }}>העלאה</span>
                          <span style={{ width: '70px', textAlign: 'center' }}>מחיקה</span>
                        </div>`;
const headerReplacement = `<div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <span style={{ flex: 1 }}>שם השותף</span>
                          <span style={{ width: '70px', textAlign: 'center' }}>סטטוס</span>
                          <span style={{ width: '60px', textAlign: 'center' }}>העלאה</span>
                          <span style={{ width: '60px', textAlign: 'center' }}>מחיקה</span>
                        </div>`;

content = content.replace(headerTarget, headerReplacement);

// Replace the row
const rowTarget = `<div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.canUpload} onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })} style={{ display: 'none' }} />
                                <div style={{ width: '36px', height: '20px', background: m.canUpload ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canUpload ? '2px' : '18px', transition: '0.3s' }} />
                                </div>
                              </label>
                            </div>
                            
                            <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.canDelete} onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} style={{ display: 'none' }} />
                                <div style={{ width: '36px', height: '20px', background: m.canDelete ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canDelete ? '2px' : '18px', transition: '0.3s' }} />
                                </div>
                              </label>
                            </div>`;

const rowReplacement = `<div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.25rem' }}>
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

                            <div style={{ width: '60px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.canUpload} onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })} style={{ display: 'none' }} disabled={m.isActive === false} />
                                <div style={{ width: '36px', height: '20px', background: m.canUpload ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s', opacity: m.isActive === false ? 0.5 : 1 }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canUpload ? '2px' : '18px', transition: '0.3s' }} />
                                </div>
                              </label>
                            </div>
                            
                            <div style={{ width: '60px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.canDelete} onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} style={{ display: 'none' }} disabled={m.isActive === false} />
                                <div style={{ width: '36px', height: '20px', background: m.canDelete ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s', opacity: m.isActive === false ? 0.5 : 1 }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canDelete ? '2px' : '18px', transition: '0.3s' }} />
                                </div>
                              </label>
                            </div>`;

content = content.replace(rowTarget, rowReplacement);

// We need to import `removeMember` and `restoreMember` in `src/app/space/[id]/settings/page.tsx`!
const useSpacesRegex = /const \{ updateSpace, updateMemberPermissions, deleteSpace \} = useSpaces\(\);/;
const useSpacesReplacement = `const { updateSpace, updateMemberPermissions, deleteSpace, removeMember, restoreMember } = useSpaces();`;
content = content.replace(useSpacesRegex, useSpacesReplacement);

fs.writeFileSync('src/app/space/[id]/settings/page.tsx', content, 'utf-8');
console.log('Added Active toggle to Engine Settings page');
