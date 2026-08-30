const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

const badSyntax = `                        {b.balance > 0 ? '+' : ''}₪{b.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                    </tr>`;

const goodSyntax = `                        {b.balance > 0 ? '+' : ''}₪{b.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      )}
                    </tr>`;

if (content.includes(badSyntax)) {
    content = content.replace(badSyntax, goodSyntax);
    fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
    console.log("Fixed missing )} syntax.");
} else {
    console.log("Could not find bad syntax snippet.");
}
