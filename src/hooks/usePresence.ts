import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { getDoc, doc } from 'firebase/firestore';

export function usePresence(uids: string[]) {
  const [presence, setPresence] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!uids || uids.length === 0) return;
    
    let isMounted = true;
    
    const fetchPresence = async () => {
      const newPresence: Record<string, string> = {};
      
      await Promise.all([...new Set(uids)].map(async (uid: string) => {
        if (!uid || uid === 'group' || uid === 'me') return;
        try {
          const docSnap = await getDoc(doc(db, 'users', uid));
          if (docSnap.exists()) {
             newPresence[uid] = docSnap.data().lastActiveAt || '';
          }
        } catch(e) {}
      }));
      
      if (isMounted) {
        setPresence(prev => ({ ...prev, ...newPresence }));
      }
    };
    
    fetchPresence();
    
    const interval = setInterval(fetchPresence, 30000); // Every 30 seconds
    return () => {
       isMounted = false;
       clearInterval(interval);
    };
  }, [uids.join(',')]);

  const getPresenceColor = (uid: string, currentUserId?: string) => {
    if (uid === currentUserId) return '#10b981'; // Green
    const lastActive = presence[uid];
    if (!lastActive) return '#ef4444'; // Red
    const diffMins = (Date.now() - new Date(lastActive).getTime()) / 1000 / 60;
    if (diffMins < 6) return '#10b981'; // Green (<6m)
    if (diffMins < 30) return '#f59e0b'; // Orange (<30m)
    return '#ef4444'; // Red (>30m)
  };

  return { presence, getPresenceColor };
}
