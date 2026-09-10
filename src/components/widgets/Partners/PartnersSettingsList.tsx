"use client";

import { useState } from "react";
import { useSpaces } from "../../../app/context/SpacesContext";

export function PartnersSettingsList({ space, user }: { space: any; user: any }) {
  const { removeMember, updateMemberPermissions, updateSpaceSettings, getRoleForSpace, refreshMemberInvite, updateMemberStatus } = useSpaces();

  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === "creator";
  const creatorId = isCreatorMe ? user?.id || "me" : space.creatorId || space.createdBy || "creator_unknown";
  const partners = (space.members || []).filter((m: any) => m.userId !== creatorId);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handleEditWallToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSpaceSettings(space.id, { allowPartnersToEditWall: e.target.checked });
  };

  const PermissionToggle = ({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (val: boolean) => void; disabled?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <span style={{ fontSize: "0.9rem", color: disabled ? "#94a3b8" : "var(--text-main)" }}>{label}</span>
      <label style={{ display: "flex", alignItems: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
        <input type="checkbox" checked={checked || false} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
        <div style={{ width: "36px", height: "20px", background: checked ? "var(--primary)" : "#ccc", borderRadius: "20px", position: "relative", transition: "0.3s" }}>
          <div style={{ width: "16px", height: "16px", background: "white", borderRadius: "50%", position: "absolute", top: "2px", left: checked ? "2px" : "18px", transition: "0.3s" }} />
        </div>
      </label>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", background: "rgba(0,0,0,0.02)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", marginBottom: "1.25rem" }}>
        <div>
          <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem" }}>{ String.fromCharCode(1506,1512,1497,1499,1514) } { String.fromCharCode(1492,1511,1497,1512) } { String.fromCharCode(1492,1512,1488,1513,1497) } (v3.9)</h4>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "280px" }}>{ String.fromCharCode(1502,1488,1508,1513,1512) } { String.fromCharCode(1500,1513,1493,1514,1508,1497,1501) } { String.fromCharCode(1500,1506,1512,1493,1498) } { String.fromCharCode(1488,1514) } { String.fromCharCode(1499,1493,1514,1512,1514) } { String.fromCharCode(1493,1514,1488,1512,1497,1498) } { String.fromCharCode(1492,1502,1512,1495,1489) }</p>
        </div>
        <label style={{ display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <input type="checkbox" checked={space.settings?.allowPartnersToEditWall || false} onChange={handleEditWallToggle} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
          <div style={{ width: "44px", height: "24px", background: space.settings?.allowPartnersToEditWall ? "var(--primary)" : "#ccc", borderRadius: "24px", position: "relative", transition: "background 0.3s" }}>
            <div style={{ width: "20px", height: "20px", background: "white", borderRadius: "50%", position: "absolute", top: "2px", left: space.settings?.allowPartnersToEditWall ? "2px" : "22px", transition: "left 0.3s" }} />
          </div>
        </label>
      </div>

      {partners && partners.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", fontWeight: "bold", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <span style={{ flex: 1 }}>שם השותף</span>
            <span style={{ width: "80px", textAlign: "center" }}>סטאטוס</span>
            <span style={{ width: "90px", textAlign: "center" }}>הרשאות</span>
          </div>
          {partners.map((m: any) => {
            const isPending = m.status === "pending" || m.status === "extension_requested";
            const isExpired = m.status === "pending" && m.joinedAt && (new Date().getTime() - new Date(m.joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 1);
            const isExpanded = expandedMember === m.userId;
            return (
              <div key={m.userId} style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <div onClick={(e) => { const t = e.target as HTMLElement; if (t.closest("button") || t.closest("input")) return; setExpandedMember(expandedMember === m.userId ? null : m.userId); }} style={{ cursor: "pointer", background: "#f8fafc", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{m.displayName || m.email || m.userId}</span>
                  <span style={{ width: "80px", textAlign: "center", fontSize: "0.8rem", color: m.status === "active" ? "#16a34a" : m.status === "disputed" ? "#dc2626" : "#b45309" }}>
                    {m.status === "active" ? "✅ פעיל" : m.status === "pending" ? "⏳ ממתין" : m.status === "extension_requested" ? "🔄 הארכה" : m.status === "disputed" ? "⚠️ סכסוך" : m.status}
                  </span>
                  <span style={{ width: "90px", textAlign: "center", fontSize: "0.85rem" }}>{isExpanded ? "▲ סגור" : "▼ פתח"}</span>
                </div>
                {isExpanded && (
                  <div style={{ padding: "1rem", background: "#fff", borderTop: "1px solid var(--border-light)" }}>
                    {m.status === "disputed" && (
                      <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)" }}>
                        <h5 style={{ margin: "0 0 0.5rem 0", color: "#dc2626" }}>פעולות סכסוך:</h5>
                        <button onClick={() => { if (window.confirm("האם אתה בטוח שברצונך לפתור סכסוך זה ולהחזיר את השותף לפעילות?")) { updateMemberStatus(space.id, m.userId, "active"); } }} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>✅ פתור סכסוך (החזר לפעיל)</button>
                      </div>
                    )}
                    {(m.status === "extension_requested" || isExpired) && (
                      <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius-md)" }}>
                        <h5 style={{ margin: "0 0 0.5rem 0", color: "#b45309" }}>פעולות:</h5>
                        <button onClick={() => { if (window.confirm("האם לאשר הארכת זמן של 24 שעות לשותף זה?")) { refreshMemberInvite(space.id, m.userId); alert("הזמן הוארך בהצלחה!"); } }} style={{ background: "#f59e0b", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>⏳ אישור הארכת זמן (24 שעות)</button>
                      </div>
                    )}
                    <h5 style={{ margin: "0 0 0.5rem 0", color: "var(--text-secondary)" }}>הרשאות שותף:</h5>
                    <PermissionToggle label="העלאת קבצים / תמונות" checked={m.canUpload} disabled={m.isActive === false || isPending} onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canUpload: val })} />
                    <PermissionToggle label="מחיקת פריטים מהמרחב" checked={m.canDelete} disabled={m.isActive === false || isPending} onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canDelete: val })} />
                    <PermissionToggle label="עריכת אחוזים במניות" checked={m.canEditShares ?? true} disabled={m.isActive === false || isPending} onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canEditShares: val })} />
                    <PermissionToggle label="הוספת/הסרת כלים" checked={m.canAddPlugins ?? true} disabled={m.isActive === false || isPending} onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canAddPlugins: val })} />
                    <PermissionToggle label="שינוי הגדרות מרחב" checked={m.canEditSettings ?? true} disabled={m.isActive === false || isPending} onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canEditSettings: val })} />
                    <PermissionToggle label="הזמנת שותפים חדשים" checked={m.canInvitePartners ?? true} disabled={m.isActive === false || isPending} onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canInvitePartners: val })} />
                    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px dashed #fca5a5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", color: "#dc2626", fontWeight: "bold" }}>⚠️ אזור מפתח (DEV)</span>
                      <button onClick={() => { if (window.confirm("מחיקת פיתוח (DEV): האם למחוק את השותף לחלוטין כולל מחיקת מידע? השותף יימחק לתמיד ולא יוכל לחזור!")) { removeMember(space.id, m.userId, user?.id || "unknown", true); } }} style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", padding: "0.3rem 0.6rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>מחק שותף (Hard Delete)</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: "1.5rem", textAlign: "center", background: "rgba(0,0,0,0.02)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-light)" }}>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9rem" }}>אין שותפים במרחב זה.</p>
        </div>
      )}
    </>
  );
}