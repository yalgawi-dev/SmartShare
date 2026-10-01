'use client';

import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useAuth } from '../../../app/context/AuthContext';
import { Space } from '../../../app/context/SpacesContext';

export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[]) => void;
}

interface DocumentsWidgetProps {
  space: Space;
  activePartnersCount: number;
}

interface DocumentShelf {
  id: string;
  name: string;
  allowedPartners: string[]; // empty means public
  createdAt: string;
}

interface SpaceDocument {
  id: string;
  shelfId: string;
  partitionName?: string;
  url: string;
  title: string;
  type: 'document' | 'image' | 'pdf';
  addedBy: string;
  createdAt: string;
}

export const DocumentsWidget = forwardRef<DocumentsWidgetRef, DocumentsWidgetProps>(({ space, activePartnersCount }, ref) => {
  const { user } = useAuth();
  
  // Local state for shelves and documents (mocked for now, will connect to Firebase later)
  const [shelves, setShelves] = useState<DocumentShelf[]>([]);
  const [documents, setDocuments] = useState<SpaceDocument[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');

  useImperativeHandle(ref, () => ({
    addDocument: (url, type, allPages) => {
      // Create default shelf if none exists
      let targetShelf = shelves[0];
      if (!targetShelf) {
        targetShelf = {
          id: 'shelf_' + Date.now(),
          name: 'כללי',
          allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : [],
          createdAt: new Date().toISOString()
        };
        setShelves([targetShelf]);
      }
      
      const newDoc: SpaceDocument = {
        id: 'doc_' + Date.now(),
        shelfId: targetShelf.id,
        url,
        title: 'מסמך חדש',
        type,
        addedBy: user?.id || '',
        createdAt: new Date().toISOString()
      };
      
      setDocuments(prev => [...prev, newDoc]);
      alert('המסמך נשמר בהצלחה למחסן המסמכים!');
    }
  }));

  const filteredShelves = shelves.filter(s => s.name.includes(searchQuery) || documents.some(d => d.shelfId === s.id && d.title.includes(searchQuery)));

  if (shelves.length === 0) {
    return (
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗂️</div>
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>ברוכים הבאים למחסן המסמכים</h2>
        <p style={{ color: '#64748b', maxWidth: '400px', lineHeight: '1.6' }}>
          אחסון, ניהול ושיתוף חכם של כל המסמכים החשובים שלכם. כאן תוכלו ליצור מדפים חכמים לביטוחים, רשיונות, וחוזים - ולשמור הכל בצורה מסודרת ומאובטחת.
        </p>
        <p style={{ color: '#64748b', maxWidth: '400px', lineHeight: '1.6', marginTop: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', fontSize: '0.9rem' }}>
          <strong>פרטיות מעל הכל:</strong> אם אתם לבד במרחב כרגע, כל מסמך שתעלו יוגדר אוטומטית כאישי, כך שגם אם תצרפו שותפים בהמשך - הם לא יראו אותו ללא אישורכם!
        </p>
        <button 
          onClick={() => {
            setShelves([{
              id: 'shelf_' + Date.now(),
              name: 'כללי',
              allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : [],
              createdAt: new Date().toISOString()
            }]);
          }}
          style={{ marginTop: '2rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
          צור מדף ראשון
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.3rem' }}>מחסן מסמכים</h2>
        <button style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>
          + מדף חדש
        </button>
      </div>

      <input 
        type="text" 
        placeholder="חיפוש מסמכים או מדפים..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem', outline: 'none' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {filteredShelves.map(shelf => {
          const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
          const isPrivate = shelf.allowedPartners.length > 0;
          return (
            <div key={shelf.id} style={{ background: '#ffffff', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>🗂️</span> {shelf.name}
                </h3>
                {isPrivate && (
                  <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>
                    🔒 אישי
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                {shelfDocs.length === 0 ? (
                  <div style={{ color: '#cbd5e1', fontSize: '0.9rem', padding: '1rem 0' }}>המדף ריק. הוסיפו מסמכים.</div>
                ) : (
                  shelfDocs.map(doc => (
                    <div key={doc.id} style={{ width: '120px', flexShrink: 0, background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div style={{ height: '140px', background: '#e2e8f0', backgroundImage: 'url(' + doc.url + ')', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      <div style={{ padding: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.title}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

DocumentsWidget.displayName = 'DocumentsWidget';
