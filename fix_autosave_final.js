const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

// 1. Fix the inputs: remove `.toFixed(1)` which breaks typing!
text = text.replace(/value=\{Number\(myShare\)\.toFixed\(1\)\}/g, "value={myShare.toString()}");
text = text.replace(/value=\{Number\(partnerShares\[m\.userId\] \|\| 0\)\.toFixed\(1\)\}/g, "value={(partnerShares[m.userId] || 0).toString()}");
text = text.replace(/value=\{expHours\}/g, "value={expHours.toString()}");

// 2. Replace handleSave with the useEffect hook
const handleSaveRegex = /const handleSave = \(\) => \{[\s\S]*?onClose\(\);\s*\n\s*\};/;
const autoSaveHook = `
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (Math.abs(total - 100) < 0.1) {
      if (updateSharesBulk) {
        updateSharesBulk(space.id, myShare, partnerShares);
        if (updateSpaceSettings) {
          updateSpaceSettings(space.id, { pendingExpirationHours: expHours });
        }
        setSaved(true);
        const t = setTimeout(() => setSaved(false), 2000);
        return () => clearTimeout(t);
      }
    }
  }, [myShare, partnerShares, expHours, total, space.id, updateSharesBulk, updateSpaceSettings]);
`;
text = text.replace(handleSaveRegex, autoSaveHook);

// 3. Remove the Save Button
const buttonsRegex = /<div style=\{\{ display: 'flex', gap: '0\.75rem' \}\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/;

const newButtonsBase64 = "        PGRpdiBzdHlsZT={{IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMC43NXJlbScsIG1hcmdpblRvcDogJzFyZW0nLCBhbGlnbkl0ZW1zOiAnY2VudGVyJyB9fT4KICAgICAgICAgIDxidXR0b24gCiAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUF1dG9CYWxhbmNlfQogICAgICAgICAgICBzdHlsZT={{IGZsZXg6IDEsIHBhZGRpbmc6ICcwLjc1cmVtJywgYmFja2dyb3VuZDogJ3ZhcigtLWJnLW1haW4pJywgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJywgYm9yZGVyOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1saWdodCknLCBib3JkZXJSYWRpdXM6ICcxMnB4JywgZm9udFdlaWdodDogJ2JvbGQnLCBjdXJzb3I6ICdwb2ludGVyJyB9fQogICAgICAgICAgPgogICAgICAgICAgICAieWTXmdefINep15XXlAogICAgICAgICAgPC9idXR0b24+CiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZsZXg6IDEsIHRleHRBbGlnbjogJ2NlbnRlcicsIGZvbnRTaXplOiAnMC45cmVtJywgY29sb3I6IE1hdGguYWJzKHRvdGFsIC0gMTAwKSA+IDAuMSA/ICd2YXIoLS1kYW5nZXIpJyA6ICd2YXIoLS1zdWNjZXNzKScsIGZvbnRXZWlnaHQ6ICdib2xkJyB9fT4KICAgICAgICAgICAge01hdGguYWJzKHRvdGFsIC0gMTAwKSA+IDAuMSA/ICfXl9eV15HXlCDXnNeU15LXmdefINecLTEwMCUnIDogKHNhdmVkID8gJ+KchSDXoNep157XqCDXkNeV15jXldef15jXmdeXJyA6ICfXnteQ15XXltefIDEwMCUnKX0KICAgICAgICAgIDwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvZGl2PgogICk7Cn0=";

const newButtons = Buffer.from(newButtonsBase64, "base64").toString("utf8");

text = text.replace(buttonsRegex, newButtons);

fs.writeFileSync(file, text, "utf8");
console.log("FIXED AUTOSAVE");

