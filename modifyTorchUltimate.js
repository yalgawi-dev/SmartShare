const fs = require("fs");
let content = fs.readFileSync("src/hooks/useCamera.ts", "utf-8");

const oldToggleRegex = /const toggleTorch = async \(\) => \{[\s\S]*?const stopCamera = \(\) => \{/m;

const newToggleTorch = `const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    
    try {
      // 1. Try standard WebRTC torch
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      setTorchOn(!torchOn);
    } catch (err: any) {
      console.warn("Standard torch failed:", err);
      try {
        // 2. Try ImageCapture fillLightMode as fallback (some older devices/browsers)
        await track.applyConstraints({
          advanced: [{ fillLightMode: torchOn ? 'off' : 'flash' } as any]
        });
        setTorchOn(!torchOn);
      } catch (fallbackErr: any) {
        console.error("All torch attempts failed:", fallbackErr);
        alert("שגיאת פלאש: העדשה הנוכחית לא תומכת בהדלקת פלאש דרך הדפדפן (או שאין לה פלאש פיזי). נסה ללחוץ על כפתור החלפת מצלמה כדי לעבור לעדשה הראשית.");
      }
    }
  };

  const stopCamera = () => {`;

content = content.replace(oldToggleRegex, newToggleTorch);

fs.writeFileSync("src/hooks/useCamera.ts", content, "utf-8");
console.log("Updated toggleTorch for robust fallback");
