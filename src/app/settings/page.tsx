'use client';

import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSpaces } from '../context/SpacesContext';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const { spaces } = useSpaces();
  
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [realName, setRealName] = useState(user?.realName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [status, setStatus] = useState(user?.status || 'hidden');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [zodiacSign, setZodiacSign] = useState(user?.zodiacSign || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [hideRealName, setHideRealName] = useState(user?.hideRealName || false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>יש להתחבר כדי לצפות במסך זה.</div>;

  const handleSave = () => {
    updateProfile({ nickname, realName, phone, email, status, customStatus, birthDate, zodiacSign, gender: gender as any, hideRealName });
    alert('הפרופיל עודכן בהצלחה!');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateProfile({ avatarUrl: url });
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
          &rarr; חזרה ללוח הראשי
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)' }}>הגדרות חשבון ⚙️</h1>
        <button onClick={logout} style={{ background: 'var(--bg-card)', color: 'red', border: '1px solid red', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
          התנתק
        </button>
      </header>

      <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
          <div style={{ position: 'relative', width: '100px', height: '100px' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--border-light)', overflow: 'hidden', border: '3px solid var(--primary)' }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>👤</div>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}
              title="שנה תמונה"
            >
              📷
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>{user.realName}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, marginBottom: '0.25rem' }}>טלפון: {user.phone}</p>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>אימייל: {user.email || 'לא סופק אימייל'}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '500px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>שם אמיתי (מוסתר מאורחים):</label>
            <input type="text" value={realName} onChange={e => setRealName(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>טלפון:</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05X-XXXXXXX" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>אימייל:</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>כינוי פומבי (יוצג לאורחים במקום השם האמיתי):</label>
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="הזן כינוי..." style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="hideRealName" checked={hideRealName} onChange={e => setHideRealName(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} />
            <label htmlFor="hideRealName" style={{ cursor: 'pointer' }}>הסתר את השם האמיתי שלי (הצג כינוי בלבד)</label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>סטטוס מערכת יחסים (אופציונלי):</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <option value="hidden">שמור על פרטיות 🤫</option>
              <option value="single">רווק/ה 🌟</option>
              <option value="relationship">בזוגיות ❤️</option>
              <option value="married">נשוי/ה 💍</option>
              <option value="divorced">גרוש/ה 🔄</option>
              <option value="widowed">אלמן/ה 🕊️</option>
              <option value="complicated">מסובך 🌀</option>
              <option value="other">אחר...</option>
            </select>
            {status === 'other' && (
              <input type="text" value={customStatus} onChange={e => setCustomStatus(e.target.value)} placeholder="כתוב משהו..." style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', marginTop: '0.5rem' }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <label style={{ fontWeight: 'bold' }}>מין:</label>
              <select value={gender} onChange={e => setGender(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <option value="">לא מוגדר</option>
                <option value="male">זכר 👦</option>
                <option value="female">נקבה 👧</option>
                <option value="other">אחר 👤</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <label style={{ fontWeight: 'bold' }}>תאריך לידה:</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <label style={{ fontWeight: 'bold' }}>מזל:</label>
              <select value={zodiacSign} onChange={e => setZodiacSign(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <option value="">לא מוגדר</option>
                <option value="♈ טלה">♈ טלה</option>
                <option value="♉ שור">♉ שור</option>
                <option value="♊ תאומים">♊ תאומים</option>
                <option value="♋ סרטן">♋ סרטן</option>
                <option value="♌ אריה">♌ אריה</option>
                <option value="♍ בתולה">♍ בתולה</option>
                <option value="♎ מאזניים">♎ מאזניים</option>
                <option value="♏ עקרב">♏ עקרב</option>
                <option value="♐ קשת">♐ קשת</option>
                <option value="♑ גדי">♑ גדי</option>
                <option value="♒ דלי">♒ דלי</option>
                <option value="♓ דגים">♓ דגים</option>
              </select>
            </div>
          </div>

          <button onClick={handleSave} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem' }}>
            שמור שינויים
          </button>
        </div>
      </div>

      <div className="card glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>👥 אנשי הקשר שלי</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          אנשים שהוספת בעבר כשותפים לפרויקטים, שמורים כאן לגישה מהירה.
        </p>

        {(() => {
          const allSpaceMembers = spaces.flatMap(s => s.members || []);
          const uniqueMembers = Array.from(new Map(allSpaceMembers.map(m => [m.userId, m])).values()).filter(m => m.userId !== user?.id);
          
          if (uniqueMembers.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                אין לך עדיין אנשי קשר מהמרחבים שלך.
              </div>
            );
          }
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {uniqueMembers.map(contact => (
                <div key={contact.userId} style={{ border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem', color: 'var(--text-secondary)' }}>
                    {contact.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{contact.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                      שותף בפרויקט • {contact.role === 'admin' ? 'מנהל מורשה' : 'משתמש רגיל'}
                    </div>
                  </div>
                  <button style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    שלח הודעה 💬
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
