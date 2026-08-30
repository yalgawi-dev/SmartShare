const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

const startRegex = /<div\s+onClick=\{\(\) => \{ setActiveTab\('transactions'\); setFilter\('pending'\); \}\}/;
const endRegex = /<\/div>\s*<\/div>\s*<div style=\{\{ marginBottom: '1\.5rem' \}\}>/;

const matchStart = content.match(startRegex);
const matchEnd = content.match(endRegex);

if (matchStart && matchEnd) {
    const startIdx = matchStart.index;
    // The end tag is </div>\n      </div>
    // Let's just find the last </div> before <div style={{ marginBottom: '1.5rem' }}>
    const split1 = content.substring(0, startIdx);
    const split2 = content.substring(startIdx);
    
    const secondPartEndMatch = split2.match(endRegex);
    
    if (secondPartEndMatch) {
        // we want to insert {hasPartners && (<> at startIdx, and </>)} right before the last </div> that ends the wrapper
        // actually just wrap both div elements in {hasPartners && (<> ... </>)}
        
        // Find the index of the container end:
        const containerEndIdx = startIdx + secondPartEndMatch.index; 
        // secondPartEndMatch.index points to "</div>\n      </div>\n\n      <div style={{ marginBottom: '1.5rem' }}>"
        
        let newContent = content.substring(0, startIdx) + 
                         "{hasPartners && (<>\n" + 
                         content.substring(startIdx, containerEndIdx) + 
                         "</>)}\n" + 
                         content.substring(containerEndIdx);
                         
        fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", newContent, "utf-8");
        console.log("Regex replace worked!");
    }
} else {
    console.log("No match.", !!matchStart, !!matchEnd);
}
