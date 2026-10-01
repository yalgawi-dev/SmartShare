import React from 'react';

export const PREDEFINED_COVERS = [
  { id: 'health', label: 'בריאות', url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=400&q=80', icon: '🏥' },
  { id: 'car', label: 'רכבים', url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=400&q=80', icon: '🚗' },
  { id: 'home', label: 'בית ודיור', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=400&q=80', icon: '🏠' },
  { id: 'finance', label: 'פיננסים', url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=400&q=80', icon: '💰' },
  { id: 'travel', label: 'נסיעות וחופשות', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=400&q=80', icon: '✈️' },
  { id: 'kids', label: 'ילדים וחינוך', url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=400&q=80', icon: '🎒' },
  { id: 'pets', label: 'חיות מחמד', url: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=400&q=80', icon: '🐾' },
  { id: 'legal', label: 'משפטי וחוזים', url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=400&q=80', icon: '⚖️' },
  { id: 'general', label: 'כללי', url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=400&q=80', icon: '📁' },
];

interface ShelfCoverPickerProps {
  onSelect: (coverUrl: string, icon: string) => void;
  onClose: () => void;
}

export function ShelfCoverPicker({ onSelect, onClose }: ShelfCoverPickerProps) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>בחר נושא / תמונה למדף</h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem' }}>
          {PREDEFINED_COVERS.map(cover => (
            <div 
              key={cover.id}
              onClick={() => onSelect(cover.url, cover.icon)}
              style={{ borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', position: 'relative', background: '#f8fafc', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            >
              <div style={{ height: '80px', backgroundImage: `url(${cover.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,255,255,0.9)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                {cover.icon}
              </div>
              <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#334155' }}>
                {cover.label}
              </div>
            </div>
          ))}
          
          <div style={{ borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1rem' }}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📸</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textAlign: 'center' }}>תמונה פרטית (בקרוב)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
