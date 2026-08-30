
const fs = require("fs");
let content = fs.readFileSync("src/app/context/SpacesContext.tsx", "utf-8");
content = content.replace("details: string; // Human readable explanation", "details: string; // Human readable explanation\n  invoiceId?: string;");
fs.writeFileSync("src/app/context/SpacesContext.tsx", content, "utf-8");

