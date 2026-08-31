const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");

// Ensure createPortal is imported if we need it, but since it's the root page, position: fixed is fine directly in the DOM without portal.
const oldFab = `{/* Floating Action Button for New Space */}
      <Link href="/space/new" className="fab" title="צור מרחב חדש">
        +
      </Link>`;
// Since powershell garbles Hebrew, we'll use regex to replace it
const regex = /\{\/\* Floating Action Button for New Space \*\/\}[\s\S]*?<\/Link>/;

const newFab = `
      {/* Floating Action Bar (Bottom Pill) for New Space - Consistent with FinanceWidget */}
      <div style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '100px',
        padding: '0.4rem',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 12px 35px rgba(0,0,0,0.15)',
        zIndex: 99999,
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <Link href="/space/new" style={{
          background: 'var(--primary)', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '100px',
          display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
          color: 'white', textDecoration: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>➕</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>מרחב חדש</span>
        </Link>
      </div>
`;

content = content.replace(regex, newFab);
fs.writeFileSync("src/app/page.tsx", content, "utf-8");
console.log("Updated Dashboard Pill");
