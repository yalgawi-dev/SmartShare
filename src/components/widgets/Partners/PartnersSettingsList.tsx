"use client";

import { useSpaces } from "../../../app/context/SpacesContext";

export function PartnersSettingsList({ space, user }: { space: any, user: any }) {
  const { removeMember, restoreMember, updateMemberPermissions, updateSpaceSettings } = useSpaces();
  
  // Re-use logic for edit wall toggle
  const handleEditWallToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSpaceSettings(space.id, { allowPartnersToEditWall: e.target.checked });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", background: "rgba(0,0,0,0.02)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", marginBottom: "1.25rem" }}>
        <div>
          <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem" }}>עריכת הקיר הראשי</h4>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "280px" }}>מאפשר לשותפים לערוך את כותרת ותאריך המרחב</p>
        </div>
        <label style={{ display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <input 
            type="checkbox" 
            checked={space.settings?.allowPartnersToEditWall || false}
            onChange={handleEditWallToggle}
            style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} 
          />
          <div style={{ 
            width: "44px", height: "24px", 
            background: space.settings?.allowPartnersToEditWall ? "var(--primary)" : "#ccc", 
            borderRadius: "24px", 
            position: "relative",
            transition: "background 0.3s"
          }}>
            <div style={{
              width: "20px", height: "20px",
              background: "white",
              borderRadius: "50%",
              position: "absolute",
              top: "2px",
              left: space.settings?.allowPartnersToEditWall ? "2px" : "22px",
              transition: "left 0.3s"
            }} />
          </div>
        </label>
      </div>

      {space.members && space.members.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", fontWeight: "bold", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <span style={{ flex: 1 }}>שם השותף</span>
            <span style={{ width: "70px", textAlign: "center" }}>סטטוס</span>
            <span style={{ width: "70px", textAlign: "center" }}>העלאה</span>
            <span style={{ width: "70px", textAlign: "center" }}>מחיקה</span>
          </div>
          
          {space.members.map((m: any) => {
            const isPending = m.status === "pending";
            const isExpired = isPending && m.joinedAt && (new Date().getTime() - new Date(m.joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 1);
            return (
            <div key={m.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "var(--bg-main)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
              <div style={{ flex: 1, fontWeight: "500", fontSize: "0.95rem" }}>
                <div>
                  {m.name} {m.userId === user?.id && <span style={{ color: "var(--primary)", fontSize: "0.85rem" }}>(אני)</span>}
                  {m.status !== "pending" && m.isActive === false && <span style={{ color: "#ef4444", fontSize: "0.85rem" }}> (לא פעיל)</span>}
                </div>
                {isPending && (
                  <div style={{ fontSize: "0.75rem", color: isExpired ? "#ef4444" : "#f59e0b", marginTop: "0.2rem", fontWeight: "bold" }}>
                    {isExpired ? "❌ פג תוקף" : "⏳ ממתין לאישור השותף"}
                  </div>
                )}
                {m.status === "disputed" && (
                  <div style={{ fontSize: "0.8rem", color: "#ef4444", marginTop: "0.2rem", background: "#fef2f2", padding: "0.4rem", borderRadius: "4px" }}>
                    <strong>נפתח סכסוך:</strong> {m.disputeMessage}
                  </div>
                )}
              </div>
              
              <div style={{ width: "70px", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: (m.userId === user?.id || isPending) ? "not-allowed" : "pointer", opacity: (m.userId === user?.id || isPending) ? 0.5 : 1 }} title={m.userId === user?.id ? "אינך יכול לשנות את הסטטוס של עצמך" : ""}>
                  <input 
                    type="checkbox" 
                    checked={m.isActive !== false} 
                    disabled={m.userId === user?.id || isPending}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        if (confirm(`האם אתה בטוח שברצונך להסיר את ${m.name} מהשותפות? החובות שלו מחשבוניות עבר יישמרו, אך המערכת תבצע איזון מחדש לחשבוניות הבאות.`)) {
                          removeMember(space.id, m.userId, user?.id || "unknown");
                        }
                      } else {
                        restoreMember(space.id, m.userId, user?.id || "unknown");
                      }
                    }}
                    style={{ display: "none" }}
                  />
                  <div style={{ width: "36px", height: "20px", background: m.isActive !== false ? "#10b981" : "#cbd5e1", borderRadius: "20px", position: "relative", transition: "0.3s" }}>
                    <div style={{ width: "16px", height: "16px", background: "white", borderRadius: "50%", position: "absolute", top: "2px", left: m.isActive !== false ? "2px" : "18px", transition: "0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </div>
                </label>
                
                {m.isActive === false && (
                  <button 
                    onClick={() => {
                      if (confirm(`הסרת משתמש לצמיתות (Hard Delete): האם אתה בטוח שברצונך למחוק לחלוטין את ${m.name} מהמערכת? פעולה זו בלתי הפיכה ותמחק גם את היסטוריית החובות שלו.`)) {
                        removeMember(space.id, m.userId, user?.id || "unknown", true);
                      }
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1.2rem", padding: "0", display: "flex", alignItems: "center", justifyContent: "center" }}
                    title="מחיקת משתמש לצמיתות"
                  >
                    🗑️
                  </button>
                )}
              </div>
              
              <div style={{ width: "70px", display: "flex", justifyContent: "center" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", opacity: (m.isActive === false || isPending) ? 0.5 : 1 }}>
                  <input type="checkbox" checked={m.canUpload} disabled={m.isActive === false || isPending} onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })} style={{ display: "none" }} />
                  <div style={{ width: "36px", height: "20px", background: m.canUpload ? "var(--primary)" : "#ccc", borderRadius: "20px", position: "relative", transition: "0.3s" }}>
                    <div style={{ width: "16px", height: "16px", background: "white", borderRadius: "50%", position: "absolute", top: "2px", left: m.canUpload ? "2px" : "18px", transition: "0.3s" }} />
                  </div>
                </label>
              </div>
              
              <div style={{ width: "70px", display: "flex", justifyContent: "center" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={m.canDelete} onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} style={{ display: "none" }} disabled={m.isActive === false || isPending} />
                  <div style={{ width: "36px", height: "20px", background: m.canDelete ? "var(--primary)" : "#ccc", borderRadius: "20px", position: "relative", transition: "0.3s" }}>
                    <div style={{ width: "16px", height: "16px", background: "white", borderRadius: "50%", position: "absolute", top: "2px", left: m.canDelete ? "2px" : "18px", transition: "0.3s" }} />
                  </div>
                </label>
              </div>
            </div>
          )})}
        </div>
      ) : (
        <div style={{ padding: "1.5rem", textAlign: "center", background: "rgba(0,0,0,0.02)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-light)" }}>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9rem" }}>אין שותפים במרחב זה.</p>
        </div>
      )}
    </>
  );
}
