const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/Partners/PartnersDirectoryWidget.tsx', 'utf8');

// 1. Change space.creatorName fallback
code = code.replace(
  'name: space.creatorName || "מנהל המרחב",',
  'name: space.creatorName || (isCreatorMe ? (user?.displayName || user?.name || user?.email || "מנהל") : "מנהל"),'
);

// 2. Change 'מנהל מרחב' badge to 'מנהל', and also apply 'מנהל' to anyone with m.role === 'admin'
code = code.replace(
  /\{m\.role === 'creator' && !isMe && <span[^>]+>מנהל מרחב<\/span>\}/,
  `{(m.role === 'creator' || m.role === 'admin') && <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>מנהל</span>}`
);
code = code.replace(
  /\{m\.role === 'creator' && <span[^>]+>מנהל מרחב<\/span>\}/g,
  `{(m.role === 'creator' || m.role === 'admin') && <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>מנהל</span>}`
);
code = code.replace(
  /\{m\.role === 'creator' && <span[^>]+>מנהל המרחב<\/span>\}/g,
  `{(m.role === 'creator' || m.role === 'admin') && <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>מנהל</span>}`
);

// If the previous replacements missed something, let's just do a blanket regex:
code = code.replace(
  /\{isMe && <span style=\{\{ fontSize: '0\.75rem', background: 'var\(--primary\)', color: 'white', padding: '0\.1rem 0\.4rem', borderRadius: '10px', fontWeight: 'bold' \}\}>אני<\/span>\}\n\s*\{m\.role === 'creator' && !isMe && <span style=\{\{ fontSize: '0\.75rem', background: '#f59e0b', color: 'white', padding: '0\.1rem 0\.4rem', borderRadius: '10px', fontWeight: 'bold' \}\}>מנהל מרחב<\/span>\}/m,
  `{isMe && <span style={{ fontSize: '0.75rem', background: 'var(--primary)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>אני</span>}
                      {(m.role === 'creator' || m.role === 'admin') && <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>מנהל</span>}`
);


// 3. Remove "פעיל" from the status
// Current code: {m.status === "active" ? <span style={{ fontSize: '0.8rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>✅ פעיל</span> : 
// Change it to: {m.status === "active" ? null :
code = code.replace(
  /\{m\.status === "active" \? <span style=\{\{ fontSize: '0\.8rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0\.2rem' \}\}>✅ פעיל<\/span> : /g,
  '{m.status === "active" ? null : '
);

fs.writeFileSync('src/components/widgets/Partners/PartnersDirectoryWidget.tsx', code);
console.log('UI Patched!');
