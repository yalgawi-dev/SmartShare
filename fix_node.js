const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

if (!text.includes("getRemainingTimeText")) {
    text = text.replace("import { useSpaces }", "import { getRemainingTimeText } from '../../../utils/partnerUtils';\nimport { useSpaces }");
}

const regex = /\{isPending && \([\s\S]*?\}\)\n\s*<\/div>\n\s*\)\}/;

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
                  </div>
                )}`;

text = text.replace(regex, newBlock);
fs.writeFileSync(file, text, "utf8");

