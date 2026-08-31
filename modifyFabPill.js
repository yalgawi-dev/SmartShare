const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

// Find start of Hidden File Input
const startIndex = content.indexOf("{/* Hidden File Input */}");
// Find start of Scanner Modal natively integrated
const endIndex = content.indexOf("{/* Scanner Modal natively integrated */}");

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `
      {/* Hidden File Input */}
      <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />

      {/* Floating Action Bar (Bottom Pill) - Apple/Modern Style */}
      {isMounted && createPortal(
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '100px',
          padding: '0.4rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          boxShadow: '0 12px 35px rgba(0,0,0,0.15)',
          zIndex: 99999,
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          
          <button 
            onClick={() => setIsAddingExpense(true)}
            style={{
              background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderRadius: '100px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>✍️</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '600' }}>ידני</span>
          </button>
          
          <div style={{ width: '1px', height: '30px', background: 'rgba(0,0,0,0.08)', margin: '0 0.25rem' }} />

          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderRadius: '100px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📎</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '600' }}>מסמך</span>
          </button>

          {space.features?.includes('scanner') && (
            <>
              <div style={{ width: '1px', height: '30px', background: 'rgba(0,0,0,0.08)', margin: '0 0.25rem' }} />
              <button 
                onClick={() => setIsScannerOpen(true)}
                style={{
                  background: 'var(--primary)', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '100px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', cursor: 'pointer',
                  color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>📸</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>סרוק</span>
              </button>
            </>
          )}

        </div>,
        document.body
      )}

      `;
  
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
  console.log("Updated Finance FAB to Floating Pill");
} else {
  console.log("Indices not found");
}
