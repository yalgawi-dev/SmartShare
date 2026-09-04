const fs = require("fs");
const file = "src/app/space/[id]/settings/page.tsx";
let text = fs.readFileSync(file, "utf8");

// Change `{m.isActive === false && ... (לא פעיל)}` 
// to `{m.status !== "pending" && m.isActive === false && ...}`
text = text.replace("{m.isActive === false && <span style={{ color: '#ef4444', fontSize: '0.85rem' }}> (לא פעיל)</span>}",
                    "{m.status !== 'pending' && m.isActive === false && <span style={{ color: '#ef4444', fontSize: '0.85rem' }}> (לא פעיל)</span>}");

// The same for the Delete button (מחק) which is disabled if isActive === false. We should also check for pending.
// Actually, let's just disable all toggles for pending members!
// `disabled={m.isActive === false || m.status === 'pending'}`

text = text.replace(/disabled=\{m\.isActive === false\}/g, "disabled={m.isActive === false || m.status === 'pending'}");

// Also, the "Status" toggle itself: 
// `<input type="checkbox" checked={m.isActive !== false} onChange={...} />`
// Let's disable it if pending:
text = text.replace(/<input\s+type="checkbox"\s+checked=\{m\.isActive !== false\}/g, 
                    "<input type=\"checkbox\" checked={m.isActive !== false} disabled={m.status === 'pending'} ");

// And the opacity for the toggles
text = text.replace(/opacity: m\.isActive === false \? 0\.5 : 1/g, 
                    "opacity: (m.isActive === false || m.status === 'pending') ? 0.5 : 1");

fs.writeFileSync(file, text, "utf8");
console.log("FIXED SETTINGS UI");

