const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

// The place where it renders the icon is:
// <div style={{
//   width: '40px', height: '40px',
//   background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
//   borderRadius: '50%',
//   display: 'flex', alignItems: 'center', justifyContent: 'center',
//   color: 'white', fontSize: '1.2rem', fontWeight: 'bold',
//   boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer'
// }} onClick={handleIconClick}>
//   {space.icon || space.title.charAt(0)}
// </div>

const oldIconCode = `{space.icon || space.title.charAt(0)}`;
const newIconCode = `{space.logoUrl ? <img src={space.logoUrl} alt="Logo" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} /> : (space.icon || space.title.charAt(0))}`;

tx = tx.split(oldIconCode).join(newIconCode);

fs.writeFileSync('src/app/space/[id]/page.tsx', tx);
console.log('Patched space details header to show logoUrl');
