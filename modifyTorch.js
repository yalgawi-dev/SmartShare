const fs = require("fs");
let content = fs.readFileSync("src/hooks/useCamera.ts", "utf-8");

const oldToggleTorch = `  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as any;
    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn } as any]
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.error("Torch failed", err);
      }
    } else {
      alert("הפלאש אינו נתמך במכשיר זה.");
    }
  };`;

const newToggleTorch = `  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    
    try {
      // Always try applying it first, regardless of what getCapabilities says.
      // Some browsers hide the capability but still apply it.
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

content = content.replace(oldToggleTorch, newToggleTorch);
fs.writeFileSync("src/hooks/useCamera.ts", content, "utf-8");
console.log("Updated useCamera.ts torch logic");
