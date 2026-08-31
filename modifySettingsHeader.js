const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf-8");

const startIndex = content.indexOf("{/* Sticky Header / Back Button */}");
const endIndex = content.indexOf("{/* Dynamic Features Sections */}");

if (startIndex !== -1 && endIndex !== -1) {
  const newHeader = `
      {/* Unified Sticky Header */}
      <div style={{ 
        position: 'sticky', top: 0, background: 'rgba(248, 250, 252, 0.95)', 
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        zIndex: 100, padding: '1rem', margin: '-1rem -1rem 1.5rem -1rem', 
        borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', 
        alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        <Link href={\`/space/\${id}\`} className={styles.backBtn} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontWeight: 'bold', textDecoration: 'none', background: 'var(--bg-card)', padding: '0.4rem 0.8rem', borderRadius: '100px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <span>&rarr;</span> לקיר
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800', color: 'var(--text-primary)', fontSize: '1.15rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{space.icon || '📁'}</span>
          {space.title}
        </div>
        
        <div style={{ width: '80px' }}></div> {/* Spacer to center the title exactly */}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        `;
  
  content = content.substring(0, startIndex) + newHeader + content.substring(endIndex);
  fs.writeFileSync("src/app/space/[id]/settings/page.tsx", content, "utf-8");
  console.log("Updated Space Settings unified header");
} else {
  console.log("Indices not found");
}
