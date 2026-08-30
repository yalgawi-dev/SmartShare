const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

content = content.replace(/\{hasPartners && <>\n/g, "{hasPartners && (\n<React.Fragment>\n");
content = content.replace(/<\/>\n\}\n/g, "</React.Fragment>\n)}\n");

// Just to be sure, I'll do a robust replace
let updated = false;

if (content.includes("</>\n}")) {
  content = content.replace("</>\n}", "</React.Fragment>\n)}");
  updated = true;
}

if (content.includes("{hasPartners && (<>")) {
  content = content.replace("{hasPartners && (<>", "{hasPartners && (<React.Fragment>");
  updated = true;
}
if (content.includes("</>)}")) {
  content = content.replace("</>)}", "</React.Fragment>)}");
  updated = true;
}

fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
console.log("Replaced fragment syntaxes.");
