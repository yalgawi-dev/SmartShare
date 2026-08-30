const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

const fixed = content.replace(
  /(\{\s*b\.balance\s*>\s*0\s*\?\s*'\+'\s*:\s*''\s*\}.*?<\/td>\s*)\<\/tr>/s,
  "$1)}</tr>"
);

fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", fixed, "utf-8");
console.log("Regex replace done");
