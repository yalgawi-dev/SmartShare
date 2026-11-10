'use client';

import React, { useState, useEffect } from 'react';
import { 
  getSavedSharedLinks, 
  updateSavedSharedLinkLabel, 
  removeSavedSharedLink, 
  SavedSharedLinkItem 
} from '@/utils/savedSharedLinksUtils';

export default function SavedSharedLinksHub() {
  const [links, setLinks] = useState<SavedSharedLinkItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const refreshLinks = () => {
    setLinks(getSavedSharedLinks());
  };

  useEffect(() => {
    refreshLinks();
    const handleUpdate = () => refreshLinks();
    window.addEventListener('myspace:saved_links_updated', handleUpdate);
    return () => {
      window.removeEventListener('myspace:saved_links_updated', handleUpdate);
    };
  }, []);

  const handleStartEdit = (link: SavedSharedLinkItem) => {
    setEditingToken(link.token);
    setEditingText(link.customLabel || link.name);
  };

  const handleSaveEdit = (token: string) => {
    updateSavedSharedLinkLabel(token, editingText);
    setEditingToken(null);
  };

  if (links.length === 0) return null;

  return (
    <>
      {/* Floating Action Button on Main Dashboard */}
      <div style={{
        position: 'fixed',
        bottom: '88px',
        left: '20px',
        zIndex: 9990
      }}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '26px',
            padding: '0.65rem 1.15rem',
            fontSize: '0.86rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(79, 70, 229, 0.4)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.2s ease'
          }}
          title="פתח קישורים ששותפו איתך"
        >
          <span style={{ fontSize: '1.1rem' }}>🔗</span>
          <span>קישורים שקיבלתי</span>
          <span style={{
            background: '#ffffff',
            color: '#4338ca',
            borderRadius: '10px',
            padding: '1px 6px',
            fontSize: '0.72rem',
            fontWeight: 900
          }}>
            {links.length}
          </span>
        </button>
      </div>

      {/* Modal / Drawer for Saved Links */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: 'rtl'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '22px',
              width: '100%',
              maxWidth: '460px',
              maxHeight: '82vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.25rem',
              gap: '1rem'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🔗</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                    קישורים ששותפו איתי
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                    כל התיקיות והמסמכים שנשלחו אליך ונשמרו במקום אחד
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Links List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {links.map(item => {
                const isEditing = editingToken === item.token;
                const displayName = item.customLabel || item.name;

                return (
                  <div
                    key={item.token}
                    style={{
                      background: '#f8fafc',
                      borderRadius: '16px',
                      border: '1.5px solid #e2e8f0',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>
                          {item.itemType === 'folder' ? '📁' : (item.fileType === 'pdf' ? '📕' : '📄')}
                        </span>
                        
                        <div style={{ minWidth: 0, flex: 1 }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <input 
                                type="text" 
                                value={editingText}
                                onChange={e => setEditingText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit(item.token)}
                                autoFocus
                                style={{
                                  flex: 1,
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '8px',
                                  border: '1.5px solid #4f46e5',
                                  fontSize: '0.82rem',
                                  outline: 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.token)}
                                style={{
                                  background: '#4f46e5',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '0.35rem 0.6rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                שמור
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                קישור ל{displayName}
                              </h4>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b', padding: '1px' }}
                                title="ערוך כינוי אישי"
                              >
                                ✏️
                              </button>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px', fontSize: '0.7rem', color: '#64748b' }}>
                            <span>מתוך: {item.spaceTitle || 'מרחב משותף'}</span>
                            <span>•</span>
                            <span>נפתח לאחרונה: {new Date(item.lastOpenedAt).toLocaleDateString('he-IL')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`האם להסיר את הקישור ל"${displayName}" מהרשימה האישית שלך?`)) {
                            removeSavedSharedLink(item.token);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '3px'
                        }}
                        title="הסר מרשימת הקישורים השמורים"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Direct Launch Action */}
                    <a
                      href={item.url}
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                        color: '#ffffff',
                        textDecoration: 'none',
                        padding: '0.55rem',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)'
                      }}
                    >
                      <span>פתח עכשיו</span>
                      <span>↗</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
