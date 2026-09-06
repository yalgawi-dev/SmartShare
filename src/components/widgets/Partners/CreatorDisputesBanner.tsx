'use client';

import { useState } from 'react';
import { useAuth } from '../../../app/context/AuthContext';
import { useSpaces } from '../../../app/context/SpacesContext';

export default function CreatorDisputesBanner({ space }: { space: any }) {
  const { user } = useAuth();
  const { updateMemberStatus, removeMember } = useSpaces();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  if (!space || !space.members) return null;

  const isCreatorMe = Boolean(
    (user?.id && space.creatorId && user.id === space.creatorId) ||
    (space.createdBy && user?.realName && space.createdBy === user.realName)
  );

  if (!isCreatorMe) return null;

  const disputedMembers = space.members.filter((m: any) => m.status === 'disputed');
  
  if (disputedMembers.length === 0) return null;

  if (isCollapsed) {
    return (
      <div 
        onClick={() => setIsCollapsed(false)}
        style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 2px 8px rgba(239,68,68,0.1)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🚨</span>
          <span style={{ color: '#991b1b', fontWeight: 'bold' }}>{disputedMembers.length} פניות משותפים ממתינות לטיפולך</span>
        </div>
        <button style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>הצג ▾</button>
      </div>
    );
  }

  return (
    <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(239,68,68,0.1)', position: 'relative' }}>
      
      <button 
        onClick={() => setIsCollapsed(true)}
        style={{ position: 'absolute', top: '16px', left: '16px', background: 'white', border: '1px solid #fca5a5', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(239,68,68,0.1)', color: '#991b1b' }}
        title="הקטן"
      >
        ▴
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingRight: '2.5rem' }}>
        <span style={{ fontSize: '1.5rem' }}>🚨</span>
        <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.25rem', fontWeight: 'bold' }}>
          התקבלה פנייה/מחלוקת משותף (v3.9)
        </h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {disputedMembers.map((m: any, idx: number) => (
          <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #fca5a5' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#7f1d1d' }}>{m.name || m.email || 'שותף'}</p>
            <p style={{ margin: '0 0 1rem 0', color: '#b91c1c', fontSize: '0.95rem' }}>
              <strong>תוכן הפנייה:</strong> "{m.disputeMessage}"
            </p>
            
            {/* Generic Resolution Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button 
                onClick={() => {
                  alert("מערכת 'ניהול הודעות וצ'אט' נמצאת כרגע בפיתוח ותצורף למנוע התקשורת בקרוב! בינתיים, תוכל ליצור איתו קשר מחוץ לאפליקציה.");
                }}
                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: '1 1 auto', fontSize: '0.9rem' }}
              >
                💬 השב (בקרוב)
              </button>
              
              <button 
                onClick={() => {
                  if (confirm('האם אתה בטוח שברצונך לאפס את הסטטוס שלו כדי שיוכל לנסות לאשר שוב?')) {
                     updateMemberStatus(space.id, m.userId, 'pending');
                  }
                }}
                style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: '1 1 auto', fontSize: '0.9rem' }}
              >
                ✅ סמן כטופל (אפס סטטוס)
              </button>

              <button 
                onClick={() => {
                  if (confirm('מחיקת השותף תסיר אותו מהקיר לחלוטין. האם אתה בטוח?')) {
                     removeMember(space.id, m.userId);
                  }
                }}
                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: '1 1 auto', fontSize: '0.9rem' }}
              >
                🗑️ הסר שותף
              </button>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: '#991b1b' }}>
        * שים לב: ניתן לערוך אחוזים דרך אזור הפיננסים (אם קיים). מערכת ההודעות המלאה תגיע בעדכון הבא.
      </p>
    </div>
  );
}
