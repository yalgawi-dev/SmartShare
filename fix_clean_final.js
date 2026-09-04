const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

text = text.replace("import { useSpaces }", "import { getRemainingTimeText } from '../../../utils/partnerUtils';\nimport { useSpaces }");

// Let us find the EXACT string block using indexOf and length
const start = text.indexOf("{isPending && (");
const end = text.indexOf(")}", text.indexOf(")}", start) + 2) + 2; // skip the inner )}

const newBlock = `{isPending && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", color: isExpired ? "#ef4444" : "#f59e0b", fontWeight: isExpired ? "bold" : "normal" }}>
                      {isExpired ? "\\u274c \\u05e4\\u05d2 \\u05ea\\u05d5\\u05e7\\u05e3" : "\\u23f3 \\u05de\\u05de\\u05ea\\u05d9\\u05df"}
                    </span>
                    {!isExpired && m.joinedAt && (
                      <span style={{ fontSize: "0.7rem", color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>
                        {getRemainingTimeText(m.joinedAt, space.settings?.pendingExpirationHours || 1)}
                      </span>
                    )}
                    {isExpired && removeMember && refreshMemberInvite && (
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button type="button" onClick={() => removeMember(space.id, m.userId, user?.id || "system")} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "4px", color: "#ef4444", cursor: "pointer", fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}>\\uD83D\\uDDD1\\uFE0F \\u05d4\\u05e1\\u05e8</button>
                        <button type="button" onClick={() => refreshMemberInvite(space.id, m.userId)} style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid #3b82f6", borderRadius: "4px", color: "#3b82f6", cursor: "pointer", fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}>\\uD83D\\uDD04 \\u05d7\\u05d3\\u05e9</button>
                      </div>
                    )}
                  </div>
                )}`;

text = text.substring(0, start) + newBlock + text.substring(end);
fs.writeFileSync(file, text, "utf8");
console.log("REPLACED EXACTLY!");

