'use client';

import { useMemo, useState } from 'react';
import { useGuest } from '../../app/context/GuestContext';
import { useAuth } from '../../app/context/AuthContext';
import ProfileModal from './ProfileModal';

export default function TopGuestsWidget({ space }: { space: any }) {
  const { profile } = useGuest();
  const { user } = useAuth();
  const [inspectedProfile, setInspectedProfile] = useState<any | null>(null);
  // Aggregate media items by authorName
  const topGuests = useMemo(() => {
    if (!space.mediaItems || space.mediaItems.length === 0) return [];

    const counts: Record<string, { count: number, avatar?: string, status?: string }> = {};

    space.mediaItems.forEach((item: any) => {
      // Ignore system default author 'אורח/ת' if possible, or group them.
      // For Gamification, we want named users.
      const name = item.authorName || 'אורח/ת';
      
      if (!counts[name]) {
        counts[name] = { count: 0, avatar: item.avatarUrl, status: item.authorStatus };
      }
      counts[name].count += 1;
      // Prefer setting an avatar if they uploaded one later
      if (item.avatarUrl) {
        counts[name].avatar = item.avatarUrl;
      }
      if (item.authorStatus) {
        counts[name].status = item.authorStatus;
      }
    });

    // Sort by count descending, take top 10
    return Object.entries(counts)
      .map(([name, data]) => {
        // If this guest is the currently logged-in user, use their live data
        let finalAvatar = data.avatar;
        let finalGender = undefined;
        let finalStatus = data.status;
        let finalName = name;
        
        if (user && (name === user.nickname || name === user.realName || name === 'אורח/ת')) {
          // Find space member local override
          const spaceMember = space.members?.find((m: any) => m.userId === user.id);
          const displayAvatar = spaceMember?.localAvatarUrl || user.avatarUrl;
          if (displayAvatar) finalAvatar = displayAvatar;
          finalGender = user.gender;
          if (user.status) finalStatus = user.status;
          
          if (user.hideRealName && user.nickname) {
            finalName = user.nickname;
          } else {
            finalName = user.realName || user.nickname || 'אורח/ת';
          }
        }

        return { name: finalName, originalName: name, ...data, avatar: finalAvatar, gender: finalGender, status: finalStatus };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [space.mediaItems, user, space.members]);

  if (topGuests.length === 0) return null;

  return (
    <div style={{ marginBottom: '2rem' }}>
      {inspectedProfile && (
        <ProfileModal 
          profile={inspectedProfile} 
          onClose={() => setInspectedProfile(null)} 
        />
      )}
      <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '1rem', padding: '0 0.5rem', fontWeight: 'bold' }}>
        🏆 קיר התהילה (הפעילים ביותר)
      </h3>
      
      <div style={{ 
        display: 'flex', 
        gap: '1.5rem', 
        overflowX: 'auto', 
        padding: '0.5rem 0.5rem 1rem 0.5rem',
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE
      }}>
        {/* Hide scrollbar for Chrome/Safari using a CSS trick (or inline style fallback) */}
        <style>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>

        {topGuests.map((guest, idx) => (
          <div 
            key={`${guest.originalName}-${idx}`} 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '75px', cursor: 'pointer' }}
            onClick={() => setInspectedProfile({
              name: guest.name,
              avatarUrl: guest.avatar,
              status: guest.status,
              isCurrentUser: profile?.name === guest.name
            })}
          >
            <div style={{ 
              width: '70px', 
              height: '70px', 
              borderRadius: '50%', 
              background: 'linear-gradient(45deg, var(--primary), #e11d48)', 
              padding: '3px',
              position: 'relative',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: '50%', 
                background: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden',
                fontWeight: 'bold',
                color: 'var(--primary)',
                fontSize: '1.5rem'
              }}>
                {guest.avatar ? (
                  <img 
                    src={guest.avatar} 
                    alt={guest.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      // Create a span with the fallback emoji and append it
                      const fallback = document.createElement('span');
                      fallback.innerHTML = guest.gender === 'male' ? '👦' : guest.gender === 'female' ? '👧' : (guest.name === 'אורח/ת' ? '👤' : guest.name.charAt(0));
                      fallback.style.fontSize = '1.5rem';
                      (e.target as HTMLImageElement).parentElement?.appendChild(fallback);
                    }}
                  />
                ) : (
                  guest.gender === 'male' ? '👦' : guest.gender === 'female' ? '👧' : (guest.name === 'אורח/ת' ? '👤' : guest.name.charAt(0))
                )}
              </div>
              {/* Badge for #1 */}
              {idx === 0 && (
                <div style={{ position: 'absolute', bottom: -5, right: -5, background: 'gold', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  👑
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '75px', textAlign: 'center' }}>
              {guest.name}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {guest.count} רגעים
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
