const fs = require("fs");
const b = fs.readFileSync("src/app/context/SpacesContext.tsx", "utf8");
const lines = b.split("\n");
const start = lines.findIndex(l => l.includes("const removeMember ="));
console.log(lines.slice(start, start + 30).join("\n"));

