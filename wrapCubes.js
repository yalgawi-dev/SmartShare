const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

const cubesStart = `        <div 
          onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}`;
const cubesEnd = `        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>`;

const cubesStartRepl = `{hasPartners && (
        <div 
          onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}`;

const cubesEndRepl = `        </div>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>`;

if (content.includes(cubesStart) && content.includes(cubesEnd)) {
    content = content.replace(cubesStart, cubesStartRepl);
    content = content.replace(cubesEnd, cubesEndRepl);
    fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
    console.log("Cubes wrapped!");
} else {
    console.log("Could not find cubes start/end");
}
