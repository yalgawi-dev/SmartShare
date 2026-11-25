'use client';

/**
 * ADR-014: Admin Product Intelligence & Universal Agent Learning Dashboard
 *
 * Modular, decoupled dashboard component displaying:
 * 1. Top User Actions vs. Unused Discovered Controls
 * 2. Before/After Version Change-Impact Analytics (with N >= 50 statistical honesty guard)
 * 3. Autonomous Screen & UI Change Detection (MutationObserver live map + change markers)
 * 4. Graduated Autonomy Compiled Skills (Zero-AI vs Apprentice vs Quarantined)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CollectiveTelemetrySnapshot,
  computeVersionImpactReport,
  fetchCollectiveTelemetryDoc,
  flushCollectiveTelemetryNow,
} from './agentCollectiveTelemetry';
import { getDiscoveredScreensMap, DiscoveredScreenSnapshot } from './assistantUiMapLearner';
import { getCompiledSkills, CompiledAgentSkill } from './agentSkillCompiler';
import { APP_VERSION } from '@/constants/version';

type IntelSubTab = 'actions' | 'impact' | 'screens' | 'skills';

export function AgentIntelligencePanel() {
  const [subTab, setSubTab] = useState<IntelSubTab>('actions');
  const [snapshot, setSnapshot] = useState<CollectiveTelemetrySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [baseVersion, setBaseVersion] = useState<string>('');
  const [targetVersion, setTargetVersion] = useState<string>('');
  const [localScreens, setLocalScreens] = useState<DiscoveredScreenSnapshot[]>([]);
  const [compiledSkills, setCompiledSkills] = useState<CompiledAgentSkill[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const docData = await fetchCollectiveTelemetryDoc();
      setSnapshot(docData);
      setLocalScreens(getDiscoveredScreensMap());
      setCompiledSkills(getCompiledSkills());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const report = useMemo(
    () =>
      computeVersionImpactReport(
        snapshot,
        baseVersion || undefined,
        targetVersion || undefined
      ),
    [snapshot, baseVersion, targetVersion]
  );

  useEffect(() => {
    if (!baseVersion && report.baseVersion) setBaseVersion(report.baseVersion);
    if (!targetVersion && report.targetVersion) setTargetVersion(report.targetVersion);
  }, [report.baseVersion, report.targetVersion, baseVersion, targetVersion]);

  const handleForceFlushAndRefresh = async () => {
    setSyncing(true);
    try {
      await flushCollectiveTelemetryNow();
      await loadData();
    } finally {
      setSyncing(false);
    }
  };

  const graduatedCount = compiledSkills.filter((s) => s.stage === 'graduated').length;
  const apprenticeCount = compiledSkills.filter((s) => s.stage === 'apprentice').length;
  const quarantinedCount = compiledSkills.filter((s) => s.stage === 'quarantined').length;

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.1rem',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>🧠</span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
              מודיעין מוצר ולמידת סוכן קולקטיבית (ADR-014)
            </h3>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '3px' }}>
            סנכרון אצווה אנונימי כל 60 שניות • אפס כתיבות פר קליק • גרסה נוכחית: <strong>{APP_VERSION}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleForceFlushAndRefresh}
          disabled={syncing || loading}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: '10px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: syncing ? 'wait' : 'pointer',
          }}
        >
          {syncing ? '⏳ מסנכרן...' : '🔄 רענן וסנכרן אצווה'}
        </button>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.65rem 0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>אירועי שימוש קולקטיביים</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
            {(snapshot?.totalEvents || 0).toLocaleString()}
          </div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.65rem 0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700 }}>מיומנויות עצמאיות (0 AI)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#166534', marginTop: '2px' }}>
            {graduatedCount} <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>/ {compiledSkills.length}</span>
          </div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '0.65rem 0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700 }}>גרסאות במעקב</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e3a8a', marginTop: '2px' }}>
            {report.availableVersions.length}
          </div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '0.65rem 0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 700 }}>כפתורים ללא שימוש</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>
            {report.unusedDiscoveredControls.length}
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
        {[
          { id: 'actions' as const, label: '🔥 פעולות מול לא מנוצלים' },
          { id: 'impact' as const, label: '📈 השפעת שינוי גרסה' },
          { id: 'screens' as const, label: '🗺️ מפת מסכים ושינויים' },
          { id: 'skills' as const, label: `🎓 מיומנויות (${compiledSkills.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            style={{
              flex: '1 1 auto',
              padding: '0.45rem 0.65rem',
              borderRadius: '9px',
              border: 'none',
              background: subTab === tab.id ? '#ffffff' : 'transparent',
              color: subTab === tab.id ? '#1d4ed8' : '#475569',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: subTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          טוען נתוני מודיעין קולקטיביים...
        </div>
      ) : (
        <>
          {/* TAB 1: Top Actions vs Unused Controls */}
          {subTab === 'actions' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                  🔥 הפעולות המבוקשות ביותר
                </div>
                {report.topActions.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    עדיין לא נצברו פעולות בענן. הפעולות יסונכרנו אוטומטית כל 60 שניות.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {report.topActions.slice(0, 10).map((item, idx) => (
                      <div
                        key={item.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.5rem',
                          background: idx < 3 ? '#f0f9ff' : '#f8fafc',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ color: '#0f172a' }}>{item.actionLabel}</strong>
                          <span style={{ color: '#64748b', fontSize: '0.7rem', marginRight: '6px' }}>
                            ({item.routePattern})
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                          {item.count} ({item.sharePct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid #fde68a', background: '#fffdf5', borderRadius: '12px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#92400e', marginBottom: '0.5rem' }}>
                  🧊 כפתורים שזוהו במסכים עם 0 לחיצות
                </div>
                {report.unusedDiscoveredControls.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#78716c' }}>
                    כל הכפתורים שזוהו עד כה נמצאו בשימוש, או שטרם נאספה מפת מסכים.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {report.unusedDiscoveredControls.slice(0, 18).map((u, i) => (
                      <span
                        key={`${u.routePattern}-${u.controlLabel}-${i}`}
                        style={{
                          fontSize: '0.73rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fcd34d',
                          borderRadius: '999px',
                          padding: '3px 9px',
                          fontWeight: 700,
                        }}
                        title={`מסך: ${u.routePattern}`}
                      >
                        {u.controlLabel}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Version Change-Impact Before/After */}
          {subTab === 'impact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  גרסת בסיס (לפני):
                  <select
                    value={baseVersion}
                    onChange={(e) => setBaseVersion(e.target.value)}
                    style={{ marginRight: '6px', padding: '4px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">בחר גרסה</option>
                    {report.availableVersions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  גרסת יעד (אחרי):
                  <select
                    value={targetVersion}
                    onChange={(e) => setTargetVersion(e.target.value)}
                    style={{ marginRight: '6px', padding: '4px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">בחר גרסה</option>
                    {report.availableVersions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Statistical Honesty Banner */}
              <div
                style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: report.isStatisticallySignificant ? '#ecfdf5' : '#fffbeb',
                  border: `1px solid ${report.isStatisticallySignificant ? '#a7f3d0' : '#fde68a'}`,
                  color: report.isStatisticallySignificant ? '#047857' : '#b45309',
                }}
              >
                {report.isStatisticallySignificant
                  ? `✅ מדגם מובהק סטטיסטית: ${report.baseTotal} פעולות ב-${report.baseVersion} מול ${report.targetTotal} פעולות ב-${report.targetVersion}.`
                  : `⚠️ מדגם קטן (לפני: ${report.baseTotal}, אחרי: ${report.targetTotal}) — נדרשות לפחות ${report.minSampleThreshold} פעולות בכל גרסה כדי להסיק מסקנת השפעה אמינה.`}
              </div>

              {report.deltas.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  נדרשות לפחות שתי גרסאות שונות עם נתוני שימוש כדי להציג השוואת השפעה (לפני/אחרי).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {report.deltas.map((d) => {
                    const isUp = d.deltaSharePct > 0;
                    return (
                      <div
                        key={d.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div>
                          <strong>{d.actionLabel}</strong>
                          <span style={{ color: '#64748b', fontSize: '0.7rem', marginRight: '6px' }}>
                            ({d.routePattern})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                          <span style={{ color: '#64748b' }}>
                            {d.baseSharePct}% ← {d.targetSharePct}%
                          </span>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '999px',
                              background: isUp ? '#dcfce7' : '#fee2e2',
                              color: isUp ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {isUp ? `+${d.deltaSharePct}%` : `${d.deltaSharePct}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Auto-Discovered Screens & Structural Change Markers */}
          {subTab === 'screens' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                  🚨 שינויים מבניים (כפתורים/מסכים חדשים שזוהו אוטומטית)
                </div>
                {report.recentChangeMarkers.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    טרם נרשמו שינויים מבניים חדשים בענן. המנוע מזהה אוטומטית כל כפתור חדש שמופיע במסכים.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {report.recentChangeMarkers.slice(0, 8).map((m, i) => (
                      <div
                        key={`${m.detectedAt}-${i}`}
                        style={{
                          padding: '0.5rem 0.7rem',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.77rem',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: '#1e293b' }}>
                          {m.version} • {m.scopeLabel} ({m.routePattern})
                        </div>
                        <div style={{ color: '#047857', marginTop: '2px' }}>
                          + נוספו: {m.addedControls.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                  🗺️ מסכים שנסרקו במכשיר זה ({localScreens.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {localScreens.slice(0, 8).map((s, i) => (
                    <div
                      key={`${s.routePattern}-${s.scopeLabel}-${i}`}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '9px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem',
                      }}
                    >
                      <strong>{s.scopeLabel}</strong> <span style={{ color: '#64748b' }}>({s.routePattern})</span>
                      <div style={{ color: '#475569', marginTop: '2px' }}>
                        בקרות: {s.controls.slice(0, 8).join(' • ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Graduated Autonomy Compiled Skills */}
          {subTab === 'skills' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                🎓 עצמאי (0 AI): <strong>{graduatedCount}</strong> • 🧪 חניך בבדיקת צל: <strong>{apprenticeCount}</strong> • ⚠️ בהסגר: <strong>{quarantinedCount}</strong>
              </div>
              {compiledSkills.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  עדיין לא נצברו מיומנויות במכשיר זה. לאחר כל פעולה מוצלחת של הסוכן נוצרת מיומנות חניך שמתקדמת לעצמאות (5/5).
                </div>
              ) : (
                compiledSkills.map((skill) => {
                  const badge =
                    skill.stage === 'graduated'
                      ? { label: '🎓 עצמאי (0 AI)', bg: '#dcfce7', color: '#15803d' }
                      : skill.stage === 'quarantined'
                        ? { label: '⚠️ בהסגר', bg: '#fee2e2', color: '#b91c1c' }
                        : { label: `🧪 חניך (${skill.verifiedStreak}/5)`, bg: '#fef3c7', color: '#b45309' };

                  return (
                    <div
                      key={skill.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.7rem',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{skill.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          תבנית: &quot;{skill.normalizedPattern}&quot; • שימושים: {skill.totalUses}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: badge.bg,
                          color: badge.color,
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
