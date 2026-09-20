'use client';

import React, { useEffect, useState } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { uploadImageToStorage } from '../../lib/firebase';

export default function SharedFileHandler() {
  const { spaces, addInboxItem } = useSpaces();
  const { user } = useAuth();
  
  const [clientKeys, setClientKeys] = useState<any>({});
  const [guestTokens, setGuestTokens] = useState<string[]>([]);
  const [sharedFiles, setSharedFiles] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [routeDestination, setRouteDestination] = useState<'inbox' | 'direct'>('direct');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const ck = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      setClientKeys(ck || {});
      const gt = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
      setGuestTokens(Array.isArray(gt) ? gt : []);
    } catch(e){}
  }, []);

  const activeSpaces = React.useMemo(() => {
    if (!spaces) return [];
    
    const filtered = spaces.filter((s: any) => {
      if (s.status === 'pending_deletion') return false;
      
      if (user?.id && s.creatorId && user.id === s.creatorId) return true;
      if (user?.spaceKeys?.[s.id]?.role === 'creator') return true;
      if (clientKeys[s.id]?.role === 'creator') return true;
      
      if (user?.spaceKeys?.[s.id]?.role === 'partner') return true;
      if (clientKeys[s.id]?.role === 'partner') return true;
      
      const partnerToken = user?.spaceKeys?.[s.id]?.token || clientKeys[s.id]?.token;
      const isMember = s.members?.some((m: any) => {
        if (user?.id && m.userId === user.id) return true;
        if (partnerToken && m.userId === partnerToken) return true;
        if (Array.isArray(guestTokens) && guestTokens.includes(m.userId)) return true;
        return false;
      });
      return isMember;
    });
    
    return filtered.sort((a: any, b: any) => {
      const getLatest = (space: any) => {
        let latest = new Date(space.createdAt || 0).getTime();
        
        if (space.invoices && space.invoices.length > 0) {
          const invDates = space.invoices.map((i: any) => new Date(i.createdAt || i.date || 0).getTime()).filter((t: number) => !isNaN(t));
          if (invDates.length > 0) {
            latest = Math.max(latest, ...invDates);
          }
        }
        
        if (space.inbox && space.inbox.length > 0) {
          const inboxDates = space.inbox.map((i: any) => new Date(i.createdAt || 0).getTime()).filter((t: number) => !isNaN(t));
          if (inboxDates.length > 0) {
            latest = Math.max(latest, ...inboxDates);
          }
        }
        return latest;
      };
      
      return getLatest(b) - getLatest(a);
    });
  }, [spaces, user, clientKeys, guestTokens]);

  const displayedSpaces = React.useMemo(() => {
    if (!searchQuery.trim()) return activeSpaces;
    const lowerQuery = searchQuery.toLowerCase();
    return activeSpaces.filter((s: any) => s.title?.toLowerCase().includes(lowerQuery));
  }, [activeSpaces, searchQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('shared') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const request = indexedDB.open('MySpaceDB', 1);
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('sharedFiles')) {
          const tx = db.transaction('sharedFiles', 'readonly');
          const store = tx.objectStore('sharedFiles');
          const getReq = store.get('latest_shared');
          getReq.onsuccess = () => {
            if (getReq.result) {
              const files = Array.isArray(getReq.result) ? getReq.result : [getReq.result];
              setSharedFiles(files);
              setRouteDestination(files.length > 1 ? 'inbox' : 'direct');
              setIsModalOpen(true);
            }
          };
        }
      };
    }
  }, []);

  useEffect(() => {
    if (isModalOpen && displayedSpaces && displayedSpaces.length > 0) {
      if (!selectedSpaceId || !displayedSpaces.find((s:any) => s.id === selectedSpaceId)) {
        setSelectedSpaceId(displayedSpaces[0].id);
      }
    }
  }, [isModalOpen, displayedSpaces, selectedSpaceId]);

  const handleProcess = async () => {
    if (!selectedSpaceId || sharedFiles.length === 0) return;
    setIsProcessing(true);
    
    try {
      if (routeDestination === 'inbox') {
        for (const dataUri of sharedFiles) {
          const publicUrl = await uploadImageToStorage(dataUri, 'inbox/' + selectedSpaceId + '/' + Date.now() + '-' + Math.random().toString(36).substring(7) + '.jpg');
          await addInboxItem(selectedSpaceId, {
            imageUrl: publicUrl,
            createdAt: new Date().toISOString(),
            status: 'pending'
          });
        }
        
        const request = indexedDB.open('MySpaceDB', 1);
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          const tx = db.transaction('sharedFiles', 'readwrite');
          tx.objectStore('sharedFiles').delete('latest_shared');
        };
        
        setIsModalOpen(false);
        setIsProcessing(false);
        alert('הקבצים הועברו למחסן החשבוניות בהצלחה!');
        router.push('/space/' + selectedSpaceId);
      } else {
        setIsModalOpen(false);
        setIsProcessing(false);
        router.push('/space/' + selectedSpaceId + '?addExpense=true&triggerOcr=true');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה בהעברת הקבצים. נסה שוב.');
      setIsProcessing(false);
    }
  };

  if (!isModalOpen) return null;

  return (
    <>
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
            <span>📄</span> {sharedFiles.length > 1 ? 'קבצים חדשים התקבלו' : 'קובץ חדש התקבל'}
          </h2>
          
          <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '1.5rem' }}>
            לאיזו פעולה תרצה לנתב {sharedFiles.length > 1 ? 'את המסמכים ששיתפת?' : 'את המסמך ששיתפת?'}
          </p>

          {sharedFiles.length > 0 && (
            <div style={{ marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden', height: '120px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '0.5rem', padding: '0.5rem', overflowX: 'auto' }}>
              {sharedFiles.slice(0, 3).map((uri, idx) => (
                <img 
                  key={idx} 
                  src={uri} 
                  alt="Preview" 
                  style={{ height: '100%', objectFit: 'contain', cursor: 'zoom-in', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
                  onClick={() => setZoomedImage(uri)}
                />
              ))}
              {sharedFiles.length > 3 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minWidth: '80px', backgroundColor: '#e2e8f0', borderRadius: '8px', fontWeight: 'bold' }}>
                  +{sharedFiles.length - 3}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>בחר פעולה:</label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', border: routeDestination === 'direct' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: routeDestination === 'direct' ? '#eef2ff' : '#f8fafc', borderRadius: '8px', opacity: sharedFiles.length > 1 ? 0.5 : 1 }}>
              <input type="radio" name="routeDest" checked={routeDestination === 'direct'} disabled={sharedFiles.length > 1} onChange={() => setRouteDestination('direct')} />
              <div>
                <div style={{ fontWeight: 'bold', color: '#1e293b' }}>ישירות להוצאות הפרויקט {sharedFiles.length > 1 ? '(מוגבל לקובץ יחיד)' : ''}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>פתח את המרחב והפעל סורק AI מיידי</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', border: routeDestination === 'inbox' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: routeDestination === 'inbox' ? '#eef2ff' : '#f8fafc', borderRadius: '8px' }}>
              <input type="radio" name="routeDest" checked={routeDestination === 'inbox'} onChange={() => setRouteDestination('inbox')} />
              <div>
                <div style={{ fontWeight: 'bold', color: '#1e293b' }}>למחסן החשבוניות (Inbox)</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>שמור בארכיון הפרויקט למיון עתידי</div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>מרחב עבודה (פרויקט):</label>
            
            {activeSpaces.length > 5 && (
              <input 
                type="text" 
                placeholder="חיפוש מרחב..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', marginBottom: '0.25rem' }}
              />
            )}

            <select 
              value={selectedSpaceId} 
              onChange={e => setSelectedSpaceId(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#f8fafc' }}
            >
              {displayedSpaces.length === 0 && <option value="">לא נמצאו מרחבים תואמים</option>}
              {displayedSpaces.map((s: any) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={() => { 
                setIsModalOpen(false); 
                const request = indexedDB.open('MySpaceDB', 1);
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
      
      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)} 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', cursor: 'zoom-out' }}
        >
          <img src={zoomedImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
}
