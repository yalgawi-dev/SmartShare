const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

const importReplacement = "import React, { useState, useEffect } from 'react';";
tx = tx.replace(/import React, \{ useState \} from 'react';/, importReplacement);

const hookCode = `  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleAddStation = () => setShowAddModal(true);
    window.addEventListener('smartshare:add_station', handleAddStation);
    return () => window.removeEventListener('smartshare:add_station', handleAddStation);
  }, []);`;
tx = tx.replace(/  const \[expandedEvents, setExpandedEvents\] = useState<Record<string, boolean>>\(\{\}\);/, hookCode);

const buttonToRemove = `<button onClick={() => setShowAddModal(true)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
          <span>+</span> הוסף תחנה
        </button>`;
tx = tx.replace(buttonToRemove, "");

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
console.log("Patched ShelfTimeline");
