'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PartnersSettingsList } from '../../../../components/widgets/Partners/PartnersSettingsList';
import { useSpaces } from '../../../context/SpacesContext';
import { useAuth } from '../../../context/AuthContext';
import styles from '../page.module.css';
import { getFeatureById } from '../../../data/features';

export default function SpaceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { spaces, updateSpaceSettings, updateMemberPermissions, toggleFeature, removeMember, restoreMember } = useSpaces();
  const { user } = useAuth();
  
  const space = spaces.find(s => s.id === id);
  const [vatRate, setVatRate] = useState<number>(18);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  useEffect(() => {
    if (space?.settings) {
      setVatRate(space.settings.defaultVatRate);
    }
  }, [space]);

  if (!space) return <div className={styles.container}><h1>המרחב אינו קיים.</h1></div>;

  const handleVatChange = (newVat: number) => {
    setVatRate(newVat);
    updateSpaceSettings(id, { defaultVatRate: newVat });
  };

  const handleToggleWallEdit = (allow: boolean) => {
    updateSpaceSettings(id, { allowPartnersToEditWall: allow });
  };

  const removeFeature = (featureId: string, featureName: string) => {
    let msg = `האם אתה בטוח שברצונך להסיר את "${featureName}"?\nהוא יוסר מהמרחב אך הנתונים יישמרו (אם קיימים).`;
    if (featureId === 'partners') {
      msg = 'שים לב! הסרת תוסף שותפים לא תמחק שותפים קיימים, אך הם לא יוכלו לגשת להוצאות. המאזנים יתאפסו. האם אתה בטוח?';
    }
    if (window.confirm(msg)) {
      toggleFeature(id, featureId as any, user?.id || 'me');
    }
  };

  return (
    <div className={styles.container} style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      
      {/* Unified Sticky Header - Professional Premium UI */}
      <div style={{ 
        position: 'sticky', top: 0, background: 'rgba(248, 250, 252, 0.9)', 
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100, padding: '0.75rem 1rem', margin: '-1rem -1rem 1.5rem -1rem', 
        borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'grid', 
        gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        {/* Right side - Back button (RTL layout implies it might be on the right, but we keep layout order) */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Link href={`/space/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontWeight: '600', textDecoration: 'none', background: 'white', padding: '0.35rem 0.85rem', borderRadius: '100px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', fontSize: '0.9rem', transition: 'all 0.2s' }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>&rarr;</span> לקיר
          </Link>
        </div>
        
        {/* Center - Title with Ellipsis to prevent wrapping */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: '800', color: 'var(--text-primary)', fontSize: '1.1rem', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{space.icon || '📁'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{space.title}</span>
        </div>
        
        {/* Left side - Empty spacer to balance the grid */}
        <div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
        
        {/* Dynamic Features Sections */}
        {space.features.map((featureId: string) => {
          const feature = getFeatureById(featureId);
          if (!feature) return null;

          return (
            <div key={featureId} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  הגדרות מנוע &bull; {feature.name}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(0,0,0,0.1), transparent)' }}></div>
              </div>
              <section className="card glass-panel" style={{ padding: '0', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)' }}>
              
              {/* Feature Header */}
              <div 
                onClick={() => setExpandedFeature(expandedFeature === featureId ? null : featureId)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.03)', borderBottom: expandedFeature === featureId ? '1px solid var(--border-light)' : 'none', padding: '1.25rem 1.5rem', cursor: 'pointer', transition: 'background 0.2s' }}
              >
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800' }}>
                  <span style={{ fontSize: '1.5rem' }}>{feature.icon}</span> {feature.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFeature(feature.id, feature.name); }}
                    style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                  >
                    הסרת הכלי
                  </button>
                  <div style={{ transform: expandedFeature === featureId ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                     ▼
                  </div>
                </div>
              </div>

              {/* Feature Body */}
              {expandedFeature === featureId && (
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.3s ease-in-out' }}>
                
                {/* Specific configs for Finance */}
                {featureId === 'finance' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>אחוז מע"מ מוגדר</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ישפיע על חישוב המע"מ בסורק</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="number" 
                          value={vatRate}
                          onChange={(e) => setVatRate(Number(e.target.value))}
                          onBlur={() => handleVatChange(vatRate)}
                          style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center', fontWeight: 'bold' }}
                        />
                        <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>צפייה בדוחות חכמים</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>דוחות מפורטים של ההתחשבנות (PDF/Excel)</p>
                      </div>
                      <Link href={`/space/${space.id}/reports`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white', fontWeight: '600', textDecoration: 'none', padding: '0.5rem 1.25rem', background: 'var(--primary)', borderRadius: '8px', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <span>📊</span>
                        לדוחות
                      </Link>
                    </div>
                  </>
                )}

                {/* Specific configs for Partners */}
                {featureId === 'partners' && (
                  <PartnersSettingsList space={space} user={user} />
                )}

                {/* Generic features message */}
                {featureId !== 'finance' && featureId !== 'partners' && (
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{feature.desc}</p>
                )}

              </div>
              )}
            </section>
            </div>
          );
        })}

      </div>
    </div>
  );
}
