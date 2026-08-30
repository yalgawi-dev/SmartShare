const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/reports/page.tsx", "utf-8");

const linkStart = `      <Link href={\`/space/\${id}\`} className={styles.backBtn}>`;
const linkEnd = `      </Link>`;

const linkRegex = /<Link href=\{`\/space\/\$\{id\}`\} className=\{styles\.backBtn\}>[\s\S]*?<\/Link>/;

const newLinkBlock = `<div style={{ position: 'sticky', top: 0, background: 'var(--bg-main, #f8fafc)', zIndex: 100, padding: '1rem 0', margin: '-1rem -1rem 1.5rem -1rem', paddingLeft: '1rem', paddingRight: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <Link href={\`/space/\${id}\`} className={styles.backBtn} style={{ margin: 0 }}>
          <span>&rarr;</span> חזרה לקיר הפרויקט
        </Link>
      </div>`;

content = content.replace(linkRegex, newLinkBlock);
fs.writeFileSync("src/app/space/[id]/reports/page.tsx", content, "utf-8");
console.log("Reports page sticky back button added.");
