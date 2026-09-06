'use client';

import { useAuth } from '../../../app/context/AuthContext';

export default function CreatorDisputesBanner({ space }: { space: any }) {
  const { user } = useAuth();
  
  if (!space || !space.members) return null;

  const isCreatorMe = Boolean(
    (user?.id && space.creatorId && user.id === space.creatorId) ||
    (space.createdBy && user?.realName && space.createdBy === user.realName)
  );

  if (!isCreatorMe) return null;

  const disputedMembers = space.members.filter((m: any) => m.status === 'disputed');
  
  if (disputedMembers.length === 0) return null;

  return (
    <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(239,68,68,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>🚨</span>
        <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.25rem', fontWeight: 'bold' }}>
          שותף דיווח על מחלוקת באחוזים! (v3.9)
        </h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {disputedMembers.map((m: any, idx: number) => (
          <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #fca5a5' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#7f1d1d' }}>{m.name || m.email || 'שותף'}</p>
            <p style={{ margin: '0 0 1rem 0', color: '#b91c1c', fontSize: '0.95rem' }}>
              <strong>הודעה מהשותף:</strong> "{m.disputeMessage}"
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-shares-editor'));
                }}
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
              >
                ערוך אחוזים עכשיו
              </button>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: '#991b1b' }}>
        * ברגע שתערוך ותשמור את האחוזים דרך "ערוך אחוזים", הסטטוס של השותף יתאפס והוא יוכל לאשר שוב.
      </p>
    </div>
  );
}
