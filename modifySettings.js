
const fs = require("fs");
let content = fs.readFileSync("src/app/settings/page.tsx", "utf-8");

content = content.replace("const { spaces } = useSpaces();", "const { spaces, restoreSpace } = useSpaces();");

const archivedSpacesBlock = `
      <div className="card glass-panel" style={{ marginTop: "3rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", color: "var(--text-primary)" }}>מרחבים בהשהייה / ארכיון</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          כאן תוכל למצוא מרחבים שנמחקו לאחרונה או נמצאים בהשהייה. תוכל לשחזר אותם במידת הצורך.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.05)", borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ padding: "1rem" }}>שם המרחב</th>
                <th style={{ padding: "1rem" }}>שותפים</th>
                <th style={{ padding: "1rem" }}>הוצאות</th>
                <th style={{ padding: "1rem" }}>תאריך מחיקה</th>
                <th style={{ padding: "1rem", textAlign: "center" }}>פעולה</th>
              </tr>
            </thead>
            <tbody>
              {spaces.filter(s => s.status === "pending_deletion").map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>{s.icon} {s.title}</td>
                  <td style={{ padding: "1rem" }}>{s.members?.length || 0}</td>
                  <td style={{ padding: "1rem" }}>{s.invoices?.length || 0}</td>
                  <td style={{ padding: "1rem", color: "#EF4444" }}>
                    {s.deletionScheduledFor ? new Date(s.deletionScheduledFor).toLocaleDateString("he-IL") : "-"}
                  </td>
                  <td style={{ padding: "1rem", textAlign: "center" }}>
                    <button 
                      onClick={() => restoreSpace(s.id)}
                      style={{ 
                        background: "#10B981", 
                        color: "white", 
                        border: "none", 
                        padding: "0.5rem 1rem", 
                        borderRadius: "4px", 
                        cursor: "pointer",
                        fontWeight: "bold"
                      }}
                    >
                      שחזר מרחב ♻️
                    </button>
                  </td>
                </tr>
              ))}
              {spaces.filter(s => s.status === "pending_deletion").length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    אין מרחבים בארכיון או בהשהייה.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
`;

const targetEnd = `      </div>
    </div>
  );
}`;

content = content.replace(targetEnd, `      </div>\n${archivedSpacesBlock}\n    </div>\n  );\n}`);
fs.writeFileSync("src/app/settings/page.tsx", content, "utf-8");
console.log("done");

