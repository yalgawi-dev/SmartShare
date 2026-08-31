const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf-8");

const headerRegex = /\{\/\* Unified Sticky Header \*\/\}[\s\S]*?<div style=\{\{ display: 'flex', flexDirection: 'column'/m;

const newHeader = `{/* Unified Sticky Header - Professional Premium UI */}
      <div style={{ 
        position: 'sticky', top: 0, background: 'rgba(248, 250, 252, 0.9)', 
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100, padding: '0.75rem 1rem', margin: '-1rem -1rem 1.5rem -1rem', 
        borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'grid', 
        gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        {/* Right side - Back button (RTL layout implies it might be on the right, but we keep layout order) */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Link href={\`/space/\${id}\`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontWeight: '600', textDecoration: 'none', background: 'white', padding: '0.35rem 0.85rem', borderRadius: '100px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', fontSize: '0.9rem', transition: 'all 0.2s' }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>&rarr;</span> לקיר
          </Link>
        </div>
        
        {/* Center - Title with Ellipsis to prevent wrapping */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: '800', color: 'var(--text-primary)', fontSize: '1.1rem', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{space.icon || '📁'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{space.title}</span>
        </div>
        
        {/* Left side - Empty spacer to balance the grid */}
        <div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column'`;

content = content.replace(headerRegex, newHeader);
fs.writeFileSync("src/app/space/[id]/settings/page.tsx", content, "utf-8");
console.log("Updated space settings header for better UI");
