const fs = require("fs");
let content = fs.readFileSync("src/hooks/useCamera.ts", "utf-8");

const oldToggleRegex = /const toggleTorch = async \(\) => \{[\s\S]*?else \{\s*alert\([^)]+\);\s*\}\s*\};/m;

const newToggleTorch = `const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    
    try {
      // Always try applying it first, regardless of what getCapabilities says.
      // Some browsers hide the capability but still apply it.
      await track.applyConstraints({
        advanced: [{ fillLightMode: torchOn ? 'off' : 'flash' }]
      }).catch(() => {}); // ignore error for fillLightMode
      
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.warn("Direct torch application failed, checking capabilities...", err);
      
      try {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if ((capabilities as any).torch) {
          await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
          setTorchOn(!torchOn);
        } else {
          alert("הפלאש כנראה לא נתמך בדפדפן או במכשיר הזה.");
        }
      } catch (innerErr) {
        alert("לא ניתן להפעיל פלאש במכשיר זה.");
      }
    }
  };`;

content = content.replace(oldToggleRegex, newToggleTorch);
fs.writeFileSync("src/hooks/useCamera.ts", content, "utf-8");
console.log("Updated useCamera.ts torch logic with regex");
