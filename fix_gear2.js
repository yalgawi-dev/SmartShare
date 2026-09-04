const fs = require("fs");
const file = "src/app/space/[id]/page.tsx";
let text = fs.readFileSync(file, "utf8");

// 1. Remove the gear icon from the old place (Action Gear block)
const gearBlockStart = text.indexOf("{/* Action Gear */}");
if (gearBlockStart !== -1) {
    const gearBlockEnd = text.indexOf(")}", gearBlockStart) + 2;
    text = text.substring(0, gearBlockStart) + text.substring(gearBlockEnd);
}

// 2. Add it to the top row
const topRowTarget = "className={styles.backBtn} style={{ margin: 0 }}>";
const topRowIndex = text.indexOf(topRowTarget);
if (topRowIndex !== -1) {
    const replacement = `className={styles.backBtn} style={{ margin: 0 }}>
          <span>&rarr;</span> \\u05dc\\u05dc\\u05d5\\u05d7 \\u05d4\\u05e8\\u05d0\\u05e9\\u05d9
        </Link>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!isGuestMode && (
            <Link href={\`/space/\${id}/settings\`} style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-light)", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", boxShadow: "var(--shadow-sm)", fontSize: "1.2rem" }} title="\\u05d4\\u05d2\\u05d3\\u05e8\\u05d5\\u05ea \\u05de\\u05e7\\u05d5\\u05de\\u05d9\\u05d5\\u05ea">
              \\u2699\\ufe0f
            </Link>
          )}
          {!isGuestMode && (
            <button onClick={() => setShowFeatureMenu(true)} style={{ background: "var(--primary)", color: "white", border: "none", padding: "0.6rem 1.25rem", borderRadius: "var(--radius-full)", fontWeight: "bold", cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
              \\u2795 \\u05d4\\u05d5\\u05e1\\u05e3 \\u05db\\u05dc\\u05d9\\u05dd
            </button>
          )}
        </div>`;
    
    // We are replacing from topRowTarget to the end of the button block
    const buttonEndTarget = "</button>\n        )}";
    const buttonEndIndex = text.indexOf(buttonEndTarget, topRowIndex) + buttonEndTarget.length;
    
    text = text.substring(0, topRowIndex) + replacement + text.substring(buttonEndIndex);
    fs.writeFileSync(file, text, "utf8");
    console.log("MOVED GEAR PROPERLY!");
} else {
    console.log("NOT FOUND TARGET!");
}

