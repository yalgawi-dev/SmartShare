const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceAddExpenseForm.tsx", "utf-8");

// Remove ScannerModal import
content = content.replace("import ScannerModal from '../ScannerModal';\n", "");

// Remove the scan button:
const scanBtnRegex = /\{\!scannedImage && \([\s\S]*?<\/button>\s*\)\}/g;
content = content.replace(scanBtnRegex, "");

// Remove the ScannerModal render block:
const scannerModalRegex = /\{isScanning && \(\s*<ScannerModal[\s\S]*?\/>\s*\)\}/g;
content = content.replace(scannerModalRegex, "");

fs.writeFileSync("src/components/widgets/Finance/FinanceAddExpenseForm.tsx", content, "utf-8");
console.log("Removed Scanner from FinanceAddExpenseForm");
