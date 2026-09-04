const fs = require("fs");
const file = "src/components/widgets/Finance/FinanceSummary.tsx";
let text = fs.readFileSync(file, "utf8");

const start = text.indexOf("{(b as any).status === 'pending' && (");
if (start !== -1) {
  const end = text.indexOf(")}", start + 20) + 2;
  const newBlock = `{(b as any).status === 'pending' && (() => {
        const isExpired = (b as any).joinedAt && (new Date().getTime() - new Date((b as any).joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 1);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.1rem" }}>
            <span style={{ fontSize: "0.7rem", color: isExpired ? "#ef4444" : "#f59e0b", display: "flex", alignItems: "center", gap: "0.2rem", fontWeight: isExpired ? "bold" : "normal" }}>
              {isExpired ? "\\u274c \\u05e4\\u05d2 \\u05ea\\u05d5\\u05e7\\u05e3" : "\\u23f3 \\u05de\\u05de\\u05ea\\u05d9\\u05df"}
            </span>
          </div>
        );
      })()}`;
  text = text.substring(0, start) + newBlock + text.substring(end);
  fs.writeFileSync(file, text, "utf8");
  console.log("REPLACED FINANCESUMMARY!");
} else {
  console.log("NOT FOUND!");
}

