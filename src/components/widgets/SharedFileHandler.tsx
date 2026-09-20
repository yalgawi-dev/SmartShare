'use client';

import React, { useEffect, useState } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useRouter } from 'next/navigation';
import { uploadImageToStorage } from '../../lib/firebase';

export default function SharedFileHandler() {
  const { spaces, addInboxItem } = useSpaces();
  const router = useRouter();
  
  const [sharedDataUri, setSharedDataUri] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('shared') === 'true') {
      // Remove query param to avoid looping
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Load from IndexedDB
      const request = indexedDB.open('SmartShareDB', 1);
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('sharedFiles')) {
          const tx = db.transaction('sharedFiles', 'readonly');
          const store = tx.objectStore('sharedFiles');
          const getReq = store.get('latest_shared');
          getReq.onsuccess = () => {
            if (getReq.result) {
              setSharedDataUri(getReq.result);
              setIsModalOpen(true);
            }
          };
        }
      };
    }
  }, []);

  // Default to first space if none selected
  useEffect(() => {
    if (isModalOpen && spaces && spaces.length > 0 && !selectedSpaceId) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [isModalOpen, spaces, selectedSpaceId]);

  const handleProcess = async () => {
    if (!selectedSpaceId || !sharedDataUri) return;
    setIsProcessing(true);
    
    try {
      if (routeDestination === 'inbox') {
        // Upload to storage and add to inbox
        const publicUrl = await uploadImageToStorage(sharedDataUri, `inbox/${selectedSpaceId}/${Date.now()}.jpg`);
        await addInboxItem(selectedSpaceId, {
          imageUrl: publicUrl,
          createdAt: new Date().toISOString(),
          status: 'pending'
        });
        
        // Clear IndexedDB
        const request = indexedDB.open('SmartShareDB', 1);
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          const tx = db.transaction('sharedFiles', 'readwrite');
          tx.objectStore('sharedFiles').delete('latest_shared');
        };
        
        setIsModalOpen(false);
        setIsProcessing(false);
        alert('הקובץ הועבר בהצלחה למחסן!');
        router.push(`/space/${selectedSpaceId}`);
      } else {
        // Direct to project (opens scanner modal automatically)
        // Leave in IndexedDB, just route to space with trigger
        setIsModalOpen(false);
        setIsProcessing(false);
        router.push(`/space/${selectedSpaceId}?addExpense=true&triggerOcr=true`);
      }
    } catch (e) {
      console.error(e);
      alert('אירעה שגיאה בעיבוד הקובץ');
      setIsProcessing(false);
    }
  };

  if (!isModalOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '1.5rem',
        width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔗</span> קובץ חדש התקבל
        </h2>
        
        <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '1.5rem' }}>
          בחר לאיזה מרחב עבודה להעביר את המסמך ששיתפת:
        </p>

        {sharedDataUri && (
          <div style={{ marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden', height: '120px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={sharedDataUri} alt="Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>מרחב עבודה:</label>
          <select 
            value={selectedSpaceId} 
            onChange={e => setSelectedSpaceId(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
          >
            {spaces && spaces.map((s: any) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#64748b', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
          המסמך יועבר אוטומטית ל<strong>מחסן החשבוניות (Inbox)</strong> של הפרויקט שבחרת, שם הוא יעבור סריקה ומיון אוטומטי (AI) כדי לבדוק האם מדובר בחשבונית או במסמך לא רלוונטי.
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => { 
              setIsModalOpen(false); 
              // Clear IndexedDB on cancel
              const request = indexedDB.open('SmartShareDB', 1);
              request.onsuccess = (e: any) => {
                const db = e.target.result;
                const tx = db.transaction('sharedFiles', 'readwrite');
                tx.objectStore('sharedFiles').delete('latest_shared');
              };
            }}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ביטול
          </button>
          <button 
            onClick={handleProcess}
            disabled={!selectedSpaceId || isProcessing}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}
          >
            {isProcessing ? 'מעבד...' : 'המשך'}
          </button>
        </div>
      </div>
    </div>
  );
}
