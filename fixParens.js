const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

content = content.replace("{hasPartners ? <React.Fragment>", "{hasPartners ? (\n<React.Fragment>");
content = content.replace("</React.Fragment> : null}", "</React.Fragment>\n) : null}");

fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
