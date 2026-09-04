const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

// Add useEffect
text = text.replace("import { useState }", "import { useState, useEffect }");

// Auto-save logic
const autoSaveLogic = `
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (Math.abs(total - 100) < 0.1) {
      if (updateSharesBulk) updateSharesBulk(space.id, myShare, partnerShares);
      if (updateSpaceSettings) updateSpaceSettings(space.id, { pendingExpirationHours: expHours });
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [myShare, partnerShares, expHours, total, space.id, updateSharesBulk, updateSpaceSettings]);

  // handleSave is no longer strictly needed for saving, but we can keep it as a fallback or remove it
`;

text = text.replace(/const handleSave = \(\) => \{[\s\S]*?onClose\(\);\s*\n\s*\};/, autoSaveLogic);

// Remove the save button and adjust the auto-balance button
const buttonsRegex = /<div style=\{\{ display: 'flex', gap: '0\.75rem' \}\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/;

const newButtons = `<div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
          <button 
            onClick={handleAutoBalance}
            style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            איזון שווה
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '0.9rem', color: Math.abs(total - 100) > 0.1 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
            {Math.abs(total - 100) > 0.1 ? 'חובה להגיע ל-100%' : (saved ? '? נשמר אוטומטית' : 'מאוזן 100%')}
          </div>
        </div>
      </div>
    </div>
  );
}`;

text = text.replace(buttonsRegex, newButtons);

fs.writeFileSync(file, text, "utf8");
console.log("FIXED AUTOSAVE");

