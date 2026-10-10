const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

// 1. Add prop to interface
tx = tx.replace(
  "onRemoveComment: (eventId: string, commentId: string) => void;\n}",
  "onRemoveComment: (eventId: string, commentId: string) => void;\n  onUploadAndLink?: (eventId: string, url: string) => Promise<void>;\n}"
);

// 2. Add prop to component destructuring
tx = tx.replace(
  "onAddComment, onRemoveComment }: ShelfTimelineProps)",
  "onAddComment, onRemoveComment, onUploadAndLink }: ShelfTimelineProps)"
);

// 3. Add state and handler
const stateInsertion = `  const [newEventTitle, setNewEventTitle] = useState('');`;
const newStateInsertion = `  const [newEventTitle, setNewEventTitle] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && showDocSelector?.eventId && onUploadAndLink) {
      setIsUploadingLocal(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
         const url = ev.target?.result as string;
         try {
            await onUploadAndLink(showDocSelector.eventId, url);
         } catch(e) {}
         setIsUploadingLocal(false);
         setShowDocSelector(null); // Close modal on success!
      };
      reader.readAsDataURL(file);
    }
  };`;
tx = tx.replace(stateInsertion, newStateInsertion);
if (!tx.includes('React.useRef')) {
  // If React isn't imported as React, just use useRef since it's imported from 'react'
  tx = tx.replace('React.useRef<HTMLInputElement>', 'useRef<HTMLInputElement>');
}

// 4. Insert the hidden input somewhere in the render tree. 
// Right inside the main return wrapper is good.
tx = tx.replace(
  "return (\n    <div style={{",
  "return (\n    <div style={{\n      {/* Hidden file input for direct timeline uploads */}\n      <input type=\"file\" accept=\"image/*,application/pdf\" style={{ display: 'none' }} ref={fileInputRef} onChange={handleLocalUpload} />"
);

// Oh wait, jsx doesn't let you put children straight in a div attribute list.
// The replace was:
// return (
//     <div style={{
// Let's replace the first `return (\n    <div ` with `<input...` inside the div.
const mainDivMatch = /return \(\s*<div[^>]*>/;
const match = tx.match(mainDivMatch);
if (match) {
   tx = tx.replace(mainDivMatch, match[0] + "\n      {/* Hidden file input for direct timeline uploads */}\n      <input type=\"file\" accept=\"image/*,application/pdf\" style={{ display: 'none' }} ref={fileInputRef} onChange={handleLocalUpload} />\n");
}

// 5. Add the Upload button in the modal.
// We look for:
// <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', paddingBottom: '1rem' }}>
const oldGridStart = `<div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', paddingBottom: '1rem' }}>`;
const newGridStart = `
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
               <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploadingLocal}
                  style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', opacity: isUploadingLocal ? 0.7 : 1 }}>
                  <span style={{ fontSize: '1.2rem' }}>📤</span> {isUploadingLocal ? 'מעלה מסמך...' : 'העלה מסמך חדש'}
               </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', paddingBottom: '1rem' }}>`;
tx = tx.replace(oldGridStart, newGridStart);

// 6. Fix the empty text
const oldEmptyText = `המחסן ריק.<br />אנא הוסף מסמכים למדף קודם (באמצעות כפתור המצלמה הכחול).`;
const newEmptyText = `המחסן ריק. לחץ על הכפתור למעלה כדי להעלות מסמך חדש.`;
tx = tx.replace(oldEmptyText, newEmptyText);

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
