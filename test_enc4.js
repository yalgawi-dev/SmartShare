const fs = require("fs");
const b = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8");
if (b.includes("getRemainingTimeText(m.joinedAt")) {
    console.log("REPLACED SUCCESSFULLY!");
} else {
    console.log("NOT REPLACED!");
}

