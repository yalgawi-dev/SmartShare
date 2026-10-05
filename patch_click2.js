const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const target = "setPreviewType('pending');\r\n                             setPreviewIndex(pendingImports.findIndex(p => p === item.url));";
const target2 = "setPreviewType('pending');\n                             setPreviewIndex(pendingImports.findIndex(p => p === item.url));";
const target3 = "setPreviewType('pending');\n                              setPreviewIndex(pendingImports.findIndex(p => p === item.url));";
const target4 = "setPreviewType('pending');\r\n                              setPreviewIndex(pendingImports.findIndex(p => p === item.url));";

const replacement = "saveCurrentStateToTrays();\n                             setPendingImports(prev => prev.filter(p => p !== item.url));\n                             processImportUrl(item.url);";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  console.log("Matched target 1");
} else if (code.includes(target2)) {
  code = code.replace(target2, replacement);
  console.log("Matched target 2");
} else if (code.includes(target3)) {
  code = code.replace(target3, replacement);
  console.log("Matched target 3");
} else if (code.includes(target4)) {
  code = code.replace(target4, replacement);
  console.log("Matched target 4");
} else {
  console.log("Could not find the target string!");
}

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
