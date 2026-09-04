const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

const idx1 = text.indexOf("style={{ background: 'rgba(239, 68, 68, 0.1)'");
if (idx1 !== -1) {
    const end1 = text.indexOf("</button>", idx1) + 9;
    text = text.substring(0, text.lastIndexOf("<button", idx1)) + text.substring(end1);
}

const idx2 = text.indexOf("style={{ background: 'rgba(59, 130, 246, 0.1)'");
if (idx2 !== -1) {
    const end2 = text.indexOf("</button>", idx2) + 9;
    text = text.substring(0, text.lastIndexOf("<button", idx2)) + text.substring(end2);
}

fs.writeFileSync(file, text, "utf8");
console.log("REMOVED BUTTONS!");

