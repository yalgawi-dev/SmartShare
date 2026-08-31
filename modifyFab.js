const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

// 1. Add imports
content = content.replace(
  "import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';",
  "import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';\nimport ScannerModal from './ScannerModal';"
);

// 2. Add state and refs
const isMountedIndex = content.indexOf("const [isMounted, setIsMounted] = useState(false);");
const newStates = `
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setShowFabMenu(false);
      const reader = new FileReader();
      reader.onload = (ev) => {
         const url = ev.target?.result as string;
         setScannedImage(url);
         runOcrPipeline(url);
      };
      reader.readAsDataURL(file);
    }
  };
`;
content = content.substring(0, isMountedIndex) + newStates + content.substring(isMountedIndex);

// 3. Replace the old FAB
const fabRegex = /\{\/\* FAB - Floating Action Button for adding expense \*\/\}[\s\S]*?<\/button>/;
const newFab = `
      {/* Hidden File Input */}
      <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />

      {/* Floating Action Menu Overlay */}
      {showFabMenu && (
        <div 
          onClick={() => setShowFabMenu(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99998, backdropFilter: 'blur(2px)' }} 
        />
      )}

      {/* FAB Menu Items */}
      {showFabMenu && (
        <div style={{ position: 'fixed', bottom: '5.5rem', left: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', zIndex: 99999, alignItems: 'flex-start' }}>
          
          <button 
            onClick={() => { setShowFabMenu(false); fileInputRef.current?.click(); }}
            style={{ background: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: 'var(--shadow-lg)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)', animation: 'slideUp 0.2s ease-out 0.1s both' }}
          >
            <div style={{ background: '#3b82f6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📎</div>
            העלאת קובץ/תמונה
          </button>

          {space.features?.includes('scanner') && (
            <button 
              onClick={() => { setShowFabMenu(false); setIsScannerOpen(true); }}
              style={{ background: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: 'var(--shadow-lg)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)', animation: 'slideUp 0.2s ease-out 0.05s both' }}
            >
              <div style={{ background: '#8b5cf6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📸</div>
              צילום חשבונית
            </button>
          )}

          <button 
            onClick={() => { setShowFabMenu(false); setIsAddingExpense(true); }}
            style={{ background: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: 'var(--shadow-lg)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)', animation: 'slideUp 0.2s ease-out 0s both' }}
          >
            <div style={{ background: '#10b981', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✍️</div>
            הזנה ידנית
          </button>
          
        </div>
      )}

      {/* FAB - Main Floating Button */}
      <button 
        className="fab"
        onClick={() => setShowFabMenu(!showFabMenu)}
        style={{ 
          position: 'fixed', 
          bottom: '1.5rem', 
          left: '1.5rem', 
          width: '60px', 
          height: '60px',
          background: showFabMenu ? '#ef4444' : 'var(--primary)',
          color: 'white',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
          border: 'none',
          cursor: 'pointer',
          zIndex: 99999,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: showFabMenu ? 'rotate(45deg)' : 'rotate(0deg)'
        }} 
      >
        +
      </button>

      {/* Scanner Modal natively integrated */}
      {isMounted && isScannerOpen && createPortal(
        <ScannerModal 
          onClose={() => setIsScannerOpen(false)}
          onComplete={(imgUrl) => {
            setIsScannerOpen(false);
            setScannedImage(imgUrl);
            runOcrPipeline(imgUrl);
          }}
        />,
        document.body
      )}
`;

content = content.replace(fabRegex, newFab);

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("Updated Finance FAB & Scanner");
