const fs = require("fs");
let content = fs.readFileSync("src/hooks/useCamera.ts", "utf-8");

const oldToggleRegex = /const toggleTorch = async \(\) => \{[\s\S]*?const stopCamera = \(\) => \{/m;

const newToggleTorch = `const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    
    const verifyTorch = () => {
      const settings = track.getSettings();
      // If we wanted it ON, but settings say it's OFF or undefined, it failed silently
      if (!torchOn && !settings.torch) {
        throw new Error("Silently failed hardware application");
      }
    };
    
    try {
      // 1. Try standard WebRTC torch
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      verifyTorch();
      setTorchOn(!torchOn);
    } catch (err: any) {
      console.warn("Standard torch failed:", err);
      try {
        // 2. Try ImageCapture fillLightMode as fallback (some older devices/browsers)
        await track.applyConstraints({
          advanced: [{ fillLightMode: torchOn ? 'off' : 'flash' } as any]
        });
        // We can't easily verify fillLightMode via getSettings, so we assume success if it didn't throw
        setTorchOn(!torchOn);
      } catch (fallbackErr: any) {
        console.error("All torch attempts failed:", fallbackErr);
        alert("שגיאת פלאש: החומרה או העדשה הנוכחית חוסמת את הפעלת הפלאש (חלק מהעדשות הרחבות לא מכילות פלאש). נסה ללחוץ על 'החלף מצלמה' כדי לעבור לעדשה הראשית.");
      }
    }
  };

  const stopCamera = () => {`;

content = content.replace(oldToggleRegex, newToggleTorch);

fs.writeFileSync("src/hooks/useCamera.ts", content, "utf-8");
console.log("Updated toggleTorch for silent failure detection");
