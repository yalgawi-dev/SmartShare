import React, { useState } from 'react';

const HIGHLIGHT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // orange
  '#a855f7', // purple
  '#ec4899', // pink
];

// Reorganized into sub-categories!
const PREDEFINED_CATEGORIES = [
  {
    id: 'health', label: 'בריאות', icon: '🏥',
    images: [
      { id: 'h1', url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=400&q=80', label: 'כללי' },
      { id: 'h2', url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=400&q=80', label: 'רופא / מרפאה' },
      { id: 'h3', url: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=400&q=80', label: 'תרופות / מרשמים' },
      { id: 'h4', url: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=400&q=80', label: 'שיניים' },
    ]
  },
  {
    id: 'car', label: 'רכבים', icon: '🚗',
    images: [
      { id: 'c1', url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=400&q=80', label: 'רכב כללי' },
      { id: 'c2', url: 'https://images.unsplash.com/photo-1600705353592-8ec2323ccb11?auto=format&fit=crop&w=400&q=80', label: 'ביטוחים' },
      { id: 'c3', url: 'https://images.unsplash.com/photo-1503376712351-564a4b49ec96?auto=format&fit=crop&w=400&q=80', label: 'מוסך וטיפולים' },
      { id: 'c4', url: 'https://images.unsplash.com/photo-1563259960-4497e2056bf4?auto=format&fit=crop&w=400&q=80', label: 'תאונה / אירוע' },
    ]
  },
  {
    id: 'home', label: 'בית ודיור', icon: '🏠',
    images: [
      { id: 'ho1', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=400&q=80', label: 'בית כללי' },
      { id: 'ho2', url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80', label: 'משכנתא / שכירות' },
      { id: 'ho3', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=400&q=80', label: 'תיקונים' },
    ]
  },
  {
    id: 'finance', label: 'פיננסים', icon: '💰',
    images: [
      { id: 'f1', url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=400&q=80', label: 'כסף כללי' },
      { id: 'f2', url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80', label: 'מסמכי בנק' },
      { id: 'f3', url: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=400&q=80', label: 'חשבונות / מיסים' },
    ]
  },
  {
    id: 'kids', label: 'ילדים וחינוך', icon: '🎒',
    images: [
      { id: 'k1', url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=400&q=80', label: 'ילדים כללי' },
      { id: 'k2', url: 'https://images.unsplash.com/photo-1473649085228-583485e6e4d7?auto=format&fit=crop&w=400&q=80', label: 'בית ספר' },
      { id: 'k3', url: 'https://images.unsplash.com/photo-1519340333755-56e9c1d04579?auto=format&fit=crop&w=400&q=80', label: 'חוגים' },
    ]
  },
  {
    id: 'general', label: 'כללי', icon: '📁',
    images: [
      { id: 'g1', url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=400&q=80', label: 'שונות' },
      { id: 'g2', url: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=400&q=80', label: 'חיות מחמד' },
      { id: 'g3', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=400&q=80', label: 'נסיעות' },
      { id: 'g4', url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=400&q=80', label: 'משפטי וחוזים' },
    ]
  }
];

interface ShelfCoverPickerProps {
  onSelect: (coverUrl: string, icon: string, highlightColor?: string) => void;
  onClose: () => void;
}

export function ShelfCoverPicker({ onSelect, onClose }: ShelfCoverPickerProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState<string>('#3b82f6');

  const selectedCategory = PREDEFINED_CATEGORIES.find(c => c.id === selectedCategoryId);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem 1.5rem 12rem 1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {selectedCategoryId && (
              <button onClick={() => setSelectedCategoryId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>←</button>
            )}
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>
              {selectedCategory ? selectedCategory.label : 'עיצוב מדף'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
        
        {!selectedCategoryId ? (
          <>
            <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem', marginTop: 0 }}>תמונת נושא:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {PREDEFINED_CATEGORIES.map(category => (
                <div 
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  style={{ borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', position: 'relative', background: '#f8fafc', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                >
                  <div style={{ height: '80px', backgroundImage: 'url(' + category.images[0].url + ')', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,255,255,0.9)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                    {category.icon}
                  </div>
                  <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#334155' }}>
                    {category.label}
                  </div>
                </div>
              ))}
              <div style={{ borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1rem' }}>
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📸</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textAlign: 'center' }}>תמונה פרטית (בקרוב)</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '16px' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.5rem', marginTop: 0 }}>קונטור זוהר להדגשה:</h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>בחר צבע שיעטוף את המדף ויבליט אותו ברשימה.</p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => onSelect('', '', undefined)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>∅</button>
                {HIGHLIGHT_COLORS.map(color => (
                  <button 
                    key={color} 
                    onClick={() => onSelect('', '', color)} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: color, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                  />
                ))}
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer', position: 'relative' }}>
                  <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} onBlur={() => onSelect('', '', customColor)} style={{ position: 'absolute', top: '-10px', left: '-10px', width: '50px', height: '50px', cursor: 'pointer' }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem' }}>
            {selectedCategory?.images.map(img => (
              <div 
                key={img.id}
                onClick={() => onSelect(img.url, selectedCategory.icon)}
                style={{ borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', position: 'relative', background: '#f8fafc', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
              >
                <div style={{ height: '80px', backgroundImage: 'url(' + img.url + ')', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#334155' }}>
                  {img.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
