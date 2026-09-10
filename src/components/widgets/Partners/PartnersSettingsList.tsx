"use client";

import { useState } from "react";
import { useSpaces } from "../../../app/context/SpacesContext";

export function PartnersSettingsList({ space, user }: { space: any, user: any }) {
  const { removeMember, restoreMember, updateMemberPermissions, updateSpaceSettings, getRoleForSpace, toggleFeature, refreshMemberInvite, updateMemberStatus } = useSpaces();
  
  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === 'creator';
  const creatorId = isCreatorMe ? (user?.id || 'me') : (space.creatorId || space.createdBy || 'creator_unknown');
  
  const partners = (space.members || []).filter((m: any) => m.userId !== creatorId);

  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handleEditWallToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSpaceSettings(space.id, { allowPartnersToEditWall: e.target.checked });
  };

  const PermissionToggle = ({ label, checked, onChange, disabled }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <span style={{ fontSize: "0.9rem", color: disabled ? "#94a3b8" : "var(--text-main)" }}>{label}</span>
      <label style={{ display: "flex", alignItems: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
        <input 
          type="checkbox" 
          checked={checked || false} 
          disabled={disabled}
          onChange={e => onChange(e.target.checked)} 
          style={{ display: "none" }} 
        />
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
          <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem" }}>עריכת הקיר הראשי (v3.9)</h4>
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

      {partners && partners.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", fontWeight: "bold", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <span style={{ flex: 1 }}>שם השותף</span>
            <span style={{ width: "80px", textAlign: "center" }}>סטטוס</span>
            <span style={{ width: "90px", textAlign: "center" }}>הרשאות</span>


import { useState } from "react";
import { useSpaces } from "../../../app/context/SpacesContext";

export function PartnersSettingsList({ space, user }: { space: any, user: any }) {
  const { removeMember, restoreMember, updateMemberPermissions, updateSpaceSettings, getRoleForSpace, toggleFeature, refreshMemberInvite, updateMemberStatus } = useSpaces();
  
  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === 'creator';
  const creatorId = isCreatorMe ? (user?.id || 'me') : (space.creatorId || space.createdBy || 'creator_unknown');
  
  const partners = (space.members || []).filter((m: any) => m.userId !== creatorId);

  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handleEditWallToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSpaceSettings(space.id, { allowPartnersToEditWall: e.target.checked });
  };

  const PermissionToggle = ({ label, checked, onChange, disabled }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <span style={{ fontSize: "0.9rem", color: disabled ? "#94a3b8" : "var(--text-main)" }}>{label}</span>
      <label style={{ display: "flex", alignItems: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
        <input 
          type="checkbox" 
          checked={checked || false} 
          disabled={disabled}
          onChange={e => onChange(e.target.checked)} 
          style={{ display: "none" }} 
        />
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
          <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem" }}>עריכת הקיר הראשי (v3.9)</h4>
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

      {partners && partners.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", fontWeight: "bold", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <span style={{ flex: 1 }}>שם השותף</span>
            <span style={{ width: "80px", textAlign: "center" }}>סטטוס</span>
            <span style={{ width: "90px", textAlign: "center" }}>הרשאות</span>
          </div>
          
          {partners.map((m: any) => {
  const isPending = m.status === "pending" || m.status === "extension_requested";
  const isExpired = m.status === "pending" && m.joinedAt && (new Date().getTime() - new Date(m.joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 1);
  const isExpanded = expandedMember === m.userId;
  
  return (
    <div key={m.userId} style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <div onClick={(e) => { const target = e.target as HTMLElement; if (target.closest('button') || target.closest('input')) return; setExpandedMember(expandedMember === m.userId ? null : m.userId); }} style={{ cursor: "pointer", background: "#f8fafc", padding: "1rem", borderTop: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  
                  
                  {m.status === 'disputed' && (
                    <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)" }}>
                      <h5 style={{ margin: "0 0 0.5rem 0", color: "#dc2626" }}>פעולות סכסוך:</h5>
                      <button 
                        onClick={() => {
                          if (window.confirm('האם אתה בטוח שברצונך לפתור סכסוך זה ולהחזיר את השותף לפעילות?')) {
                            // Can't use updateMemberStatus directly here if we didn't import it, but wait, updateMemberStatus was not imported!
                            // I need to import updateMemberStatus!
                            updateMemberStatus(space.id, m.userId, 'active');
                          }
                        }}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        ✅ פתור סכסוך (החזר לפעיל)
                      </button>
                    </div>
                  )}

                  {(m.status === 'extension_requested' || isExpired) && (
                    <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius-md)" }}>
                      <h5 style={{ margin: "0 0 0.5rem 0", color: "#b45309" }}>פעולות:</h5>
                      <button 
                        onClick={() => {
                          if (window.confirm('האם לאשר הארכת זמן של 24 שעות לשותף זה?')) {
                            refreshMemberInvite(space.id, m.userId);
                            alert('הזמן הוארך בהצלחה!');
                          }
                        }}
                        style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        ⏳ אישור הארכת זמן (24 שעות)
                      </button>
                    </div>
                  )}

                  <h5 style={{ margin: "0 0 0.5rem 0", color: "var(--text-secondary)" }}>הרשאות שותף:</h5>
                  <PermissionToggle 
                    label="העלאת קבצים / תמונות" 
                    checked={m.canUpload} 
                    disabled={m.isActive === false || isPending} 
                    onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canUpload: val })} 
                  />
                  <PermissionToggle 
                    label="מחיקת פריטים מהמרחב" 
                    checked={m.canDelete} 
                    disabled={m.isActive === false || isPending} 
                    onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canDelete: val })} 
                  />
                  <PermissionToggle 
                    label="עריכת אחוזים במניות (v3.9)" 
                    checked={m.canEditShares ?? true} 
                    disabled={m.isActive === false || isPending} 
                    onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canEditShares: val })} 
                  />
                  <PermissionToggle 
                    label="הוספת/הסרת כלים (v3.9)" 
                    checked={m.canAddPlugins ?? true} 
                    disabled={m.isActive === false || isPending} 
                    onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canAddPlugins: val })} 
                  />
                  <PermissionToggle 
                    label="שינוי הגדרות מרחב (v3.9)" 
                    checked={m.canEditSettings ?? true} 
                    disabled={m.isActive === false || isPending} 
                    onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canEditSettings: val })} 
                  />
                  <PermissionToggle 
                    label="הזמנת שותפים חדשים (v3.9)" 
                    checked={m.canInvitePartners ?? true} 
                    disabled={m.isActive === false || isPending} 
                    onChange={(val: boolean) => updateMemberPermissions(space.id, m.userId, { canInvitePartners: val })} 
                  />
                  
                  {/* אזור פיתוח */}
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 'bold' }}>⚠️ אזור מפתח (DEV)</span>
                    <button 
                      onClick={() => {
                        if (window.confirm('מחיקת פיתוח (DEV): האם למחוק את השותף לחלוטין כולל מחיקת מידע? השותף יימחק לתמיד ולא יוכל לחזור!')) {
                          removeMember(space.id, m.userId, user?.id || 'unknown', true);
                        }
                      }}
                      style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                      title='מחיקת פיתוח - מחיקת הרדקור'
                    >
                      מחק שותף (Hard Delete)
                    </button>
                  </div>
                </div>
              )}
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

