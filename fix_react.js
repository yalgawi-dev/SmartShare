const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

if (!text.includes("getRemainingTimeText")) {
    text = text.replace("import { useSpaces }", "import { getRemainingTimeText } from '../../../utils/partnerUtils';\nimport { useSpaces }");
}

const match = text.match(/\{isPending && \([\s\S]*?\}\)\n\s*<\/div>\n\s*\)\}/);
if (match) {
    const oldBlock = match[0];
    const newBlock = `{isPending && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", color: isExpired ? "#ef4444" : "#f59e0b", fontWeight: isExpired ? "bold" : "normal" }}>
                      {isExpired ? "? פג תוקף" : "? ממתין"}
                    </span>
                    {!isExpired && m.joinedAt && (
                      <span style={{ fontSize: "0.7rem", color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>
                        {getRemainingTimeText(m.joinedAt, space.settings?.pendingExpirationHours || 1)}
                      </span>
                    )}
                    {isExpired && removeMember && refreshMemberInvite && (
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button type="button" onClick={() => removeMember(space.id, m.userId, user?.id || "system")} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "4px", color: "#ef4444", cursor: "pointer", fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}>??? הסר</button>
                        <button type="button" onClick={() => refreshMemberInvite(space.id, m.userId)} style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid #3b82f6", borderRadius: "4px", color: "#3b82f6", cursor: "pointer", fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}>?? חדש</button>
                      </div>
                    )}
                  </div>
                )}`;
    
    // We encode the newBlock cleanly inside Node so PowerShell Set-Content doesnt corrupt it when writing the js!
    // Wait, Set-Content will corrupt the JS script itself!!
}

