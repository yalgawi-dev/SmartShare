'use client';

import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSpaces } from '../context/SpacesContext';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const { spaces, restoreSpace, removeMember } = useSpaces() as any;
  
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

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>יש להתחבר כדי לצפות בעמוד זה.</div>;

  // Auto-save logic
  const saveField = (field: string, value: any) => {
    updateProfile({ [field]: value });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateProfile({ avatarUrl: url });
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Sticky Header / Back Button */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-main, #f8fafc)', zIndex: 100, padding: '1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>&rarr;</span> חזרה למסך הראשי
        </Link>
        <button onClick={logout} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
          התנתק
        </button>
      </div>

      <header style={{ padding: '1.5rem 1rem 0' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)' }}>הגדרות חשבון אישי</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>השינויים שתבצע יישמרו באופן אוטומטי ויחולו על כל המרחבים שלך.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
        
        {/* Profile Card */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👤</span> פרופיל אישי
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--border-light)', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🧑‍💻</div>
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}
                title="החלף תמונה"
              >
                📷
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0' }}>{realName || user.id}</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>{phone || 'אין טלפון'}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              שם מלא:
              <input type="text" value={realName} onChange={e => setRealName(e.target.value)} onBlur={e => saveField('realName', e.target.value)} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              כינוי / תצוגה:
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} onBlur={e => saveField('nickname', e.target.value)} placeholder="הכינוי שלך..." style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              מספר טלפון:
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} onBlur={e => saveField('phone', e.target.value)} placeholder="05X-XXXXXXX" style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              אימייל:
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => saveField('email', e.target.value)} placeholder="your@email.com" style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="checkbox" 
                  checked={hideRealName} 
                  onChange={(e) => {
                    setHideRealName(e.target.checked);
                    saveField('hideRealName', e.target.checked);
                  }}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} 
                />
                <div style={{ width: '44px', height: '24px', background: hideRealName ? 'var(--primary)' : '#ccc', borderRadius: '24px', position: 'relative', transition: 'background 0.3s' }}>
                  <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: hideRealName ? '2px' : '22px', transition: 'left 0.3s' }} />
                </div>
              </div>
            </label>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>הסתר את שמי המלא ממשתמשים אחרים (יוצג כינוי בלבד)</span>
          </div>
        </section>

        {/* Extended Info */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1.25rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌟</span> מידע נוסף
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              מצב משפחתי:
              <select value={status} onChange={e => { setStatus(e.target.value as any); saveField('status', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <option value="hidden">לא מעוניין/ת לשתף</option>
                <option value="single">רווק/ה</option>
                <option value="relationship">במערכת יחסים</option>
                <option value="married">נשוי/אה</option>
                <option value="divorced">גרוש/ה</option>
                <option value="widowed">אלמן/ה</option>
                <option value="complicated">זה מסובך</option>
                <option value="other">אחר...</option>
              </select>
            </label>

            {status === 'other' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                פירוט:
                <input type="text" value={customStatus} onChange={e => setCustomStatus(e.target.value)} onBlur={e => saveField('customStatus', e.target.value)} placeholder="מצב אישי..." style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              מגדר:
              <select value={gender} onChange={e => { setGender(e.target.value); saveField('gender', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <option value="">לא צוין</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
                <option value="other">אחר</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              תאריך לידה:
              <input type="date" value={birthDate} onChange={e => { setBirthDate(e.target.value); saveField('birthDate', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              מזל:
              <select value={zodiacSign} onChange={e => { setZodiacSign(e.target.value); saveField('zodiacSign', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <option value="">לא צוין</option>
                <option value="טלה">טלה</option>
                <option value="שור">שור</option>
                <option value="תאומים">תאומים</option>
                <option value="סרטן">סרטן</option>
                <option value="אריה">אריה</option>
                <option value="בתולה">בתולה</option>
                <option value="מאזניים">מאזניים</option>
                <option value="עקרב">עקרב</option>
                <option value="קשת">קשת</option>
                <option value="גדי">גדי</option>
                <option value="דלי">דלי</option>
                <option value="דגים">דגים</option>
              </select>
            </label>
          </div>
        </section>

        {/* Contacts */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🤝</span> אנשי קשר
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            משתמשים שחולקים איתך מרחבי שותפות. תוכל ליצור איתם מרחבים חדשים בקלות.
          </p>

          {(() => {
            const allSpaceMembers = spaces.flatMap(s => s.members || []);
            const uniqueMembers = Array.from(new Map(allSpaceMembers.map(m => [m.userId, m])).values()).filter(m => m.userId !== user?.id);
            
            if (uniqueMembers.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-light)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  אין לך אנשי קשר משותפים במרחבים כרגע.
                </div>
              );
            }
            
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {uniqueMembers.map(contact => {
                  const userSpaces = spaces.filter(s => s.members?.some(m => m.userId === contact.userId));
                  return (
                    <div key={contact.userId} style={{ border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.01)' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        {contact.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{contact.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          שותף ב: {userSpaces.map(s => s.title || 'פרויקט ללא שם').join(', ')}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm(`האם אתה בטוח שברצונך למחוק את ${contact.name} מכל הפרויקטים שלך לחלוטין?`)) {
                            userSpaces.forEach(s => removeMember(s.id, contact.userId, user?.id || 'admin'));
                          }
                        }}
                        style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid #ef4444', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#ef4444' }}
                      >
                        מחק לצמיתות
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* Archived Spaces */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🗄️</span> מרחבים בארכיון
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            כאן תוכל למצוא מרחבים שהשהית או שהעברת לארכיון. לאחר 30 ימים, הם ימחקו לצמיתות.
          </p>
          
          <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '600px', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>מרחב</th>
                  <th style={{ padding: '0.75rem 1rem' }}>שותפים</th>
                  <th style={{ padding: '0.75rem 1rem' }}>הוצאות</th>
                  <th style={{ padding: '0.75rem 1rem' }}>מחיקה לצמיתות ב:</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {spaces.filter(s => s.status === 'pending_deletion').map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.icon} {s.title}</td>
                    <td style={{ padding: '1rem' }}>{s.members?.length || 0}</td>
                    <td style={{ padding: '1rem' }}>{s.invoices?.length || 0}</td>
                    <td style={{ padding: '1rem', color: '#EF4444', fontWeight: '500' }}>
                      {s.deletionScheduledFor ? new Date(s.deletionScheduledFor).toLocaleDateString('he-IL') : '-'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => restoreSpace(s.id)}
                        style={{ 
                          background: '#10B981', 
                          color: 'white', 
                          border: 'none', 
                          padding: '0.4rem 1rem', 
                          borderRadius: 'var(--radius-full)', 
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.85rem'
                        }}
                      >
                        ↩️ שחזר
                      </button>
                    </td>
                  </tr>
                ))}
                {spaces.filter(s => s.status === 'pending_deletion').length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      אין מרחבים בארכיון כרגע.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
