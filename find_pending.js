const fs = require("fs");
const b = fs.readFileSync("src/app/context/SpacesContext.tsx", "utf8");
const lines = b.split("\n");
lines.forEach((l, i) => { if (l.includes("status: 'pending'")) console.log(lines.slice(i-10, i+10).join("\n")); });

