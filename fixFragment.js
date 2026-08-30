const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

content = content.replace("{hasPartners && (<>\n", "{hasPartners && <>\n");
content = content.replace("</>)}\n", "</>\n}\n"); // wait, {hasPartners && <> ... </>}

// Let's just fix it completely using exact replace
content = content.replace("{hasPartners && (<>", "{hasPartners && (<>"); // Wait, the previous replacement added newline.
const badStart = "{hasPartners && (<>";
const goodStart = "{hasPartners && ( <React.Fragment>";

const badEnd = "</>)}";
const goodEnd = "</React.Fragment> )}";

content = content.replace(badStart, goodStart);
content = content.replace(badEnd, goodEnd);
fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
