const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf-8");

// 1. Add toggleFeature to destructuring
content = content.replace(
  "const { spaces, updateSpaceSettings, updateMemberPermissions } = useSpaces();",
  "const { spaces, updateSpaceSettings, updateMemberPermissions, toggleFeature } = useSpaces();"
);

// 2. Add AVAILABLE_FEATURES import
if (!content.includes("AVAILABLE_FEATURES")) {
  content = content.replace(
    "import styles from '../page.module.css';",
    "import styles from '../page.module.css';\nimport { AVAILABLE_FEATURES, getFeatureById } from '../../../data/features';"
  );
}

// 3. Create the Tools section HTML
const toolsSection = `
        {/* Tools & Features Management Section */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🧩</span> ניהול כלים ותוספים
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            הוסף או הסר כלים מהמרחב שלך בלחיצת כפתור. הכלי יתווסף ישירות למסך הראשי.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {AVAILABLE_FEATURES.map(feature => {
              const isActive = space.features.includes(feature.id);
              return (
                <div key={feature.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: isActive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: isActive ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                      {feature.icon}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{feature.name}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>{feature.desc}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      if (isActive) {
                        let msg = \`האם אתה בטוח שברצונך לכבות את התוסף "\${feature.name}"?\\nהוא יוסר ממסך המרחב הראשי, אך הנתונים יישמרו (אם קיימים).\`;
                        if (feature.id === 'partners') {
                          msg = 'שים לב! הסרת תוסף שותפים לא תמחק שותפים קיימים, אך הם לא יוכלו לגשת להוצאות. המאזנים יתאפסו. האם אתה בטוח?';
                        }
                        if (window.confirm(msg)) {
                          toggleFeature(id, feature.id as any, user?.id || 'me');
                        }
                      } else {
                        toggleFeature(id, feature.id as any, user?.id || 'me');
                      }
                    }}
                    style={{ 
                      background: isActive ? '#fee2e2' : 'var(--primary)', 
                      color: isActive ? '#991b1b' : 'white', 
                      border: 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: 'var(--radius-full)', 
                      fontWeight: 'bold', 
                      cursor: 'pointer', 
                      fontSize: '0.85rem',
                      minWidth: '80px',
                      flexShrink: 0
                    }}
                  >
                    {isActive ? 'הסר' : 'הוסף כלי'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
`;

// Insert the tools section below General Settings
const genSetRegex = /\{\/\* General Settings Section \*\/\}\s*<section[\s\S]*?<\/section>/;
const match = content.match(genSetRegex);
if (match) {
  const insertIndex = content.indexOf(match[0]) + match[0].length;
  content = content.substring(0, insertIndex) + "\n\n" + toolsSection + content.substring(insertIndex);
  fs.writeFileSync("src/app/space/[id]/settings/page.tsx", content, "utf-8");
  console.log("Updated Space Settings Page");
} else {
  console.log("General Settings Section not found!");
}
