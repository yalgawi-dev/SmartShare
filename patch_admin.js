const fs = require('fs');
let file = fs.readFileSync('src/app/admin/users/page.tsx', 'utf8');

const oldHeader = `<div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>`;

const newHeader = `<div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => {
            const current = localStorage.getItem('show_scanner_debug') === 'true';
            localStorage.setItem('show_scanner_debug', current ? 'false' : 'true');
            alert(current ? 'נתוני סורק הוסתרו' : 'נתוני סורק יופיעו');
          }}
          style={{ 
            background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', 
            padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginRight: 'auto', fontWeight: 'bold' 
          }}
        >
          Toggle Scanner Debug
        </button>`;

file = file.replace(oldHeader, newHeader);
fs.writeFileSync('src/app/admin/users/page.tsx', file);
console.log("Admin page updated");
