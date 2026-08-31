const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf-8");

// 1. Increase gap between sections
content = content.replace(
  "<div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>",
  "<div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>"
);

// 2. Wrap the section in a div with a label
const sectionRegex = /return \(\s*<section key=\{featureId\} className="card glass-panel" style=\{\{ padding: '0', background: 'var\(--bg-card\)', borderRadius: 'var\(--radius-lg\)', overflow: 'hidden' \}\}>/m;

const newSection = `return (
            <div key={featureId} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  הגדרות מנוע &bull; {feature.name}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(0,0,0,0.1), transparent)' }}></div>
              </div>
              <section className="card glass-panel" style={{ padding: '0', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)' }}>`;

content = content.replace(sectionRegex, newSection);

// Close the wrapping div at the end of the map
const endSectionRegex = /<\/section>\s*\);\s*\}\)}/m;
content = content.replace(endSectionRegex, "</section>\n            </div>\n          );\n        })}");

fs.writeFileSync("src/app/space/[id]/settings/page.tsx", content, "utf-8");
console.log("Updated Space Settings UI for clear separation");
