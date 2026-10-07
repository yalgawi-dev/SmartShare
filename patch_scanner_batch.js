const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// Replace finalRouting in handleDone
content = content.replace(
  "let finalRouting = routingType || (hasFinance && !hasVault ? 'receipt' : 'document');",
  "let finalRouting = routingType || defaultCategory || (hasFinance && !hasVault ? 'receipt' : 'document');\n    \n    // Batch OCR Logic for Invoices\n    if (finalRouting === 'receipt' && allPageUrls.length > 1) {\n      if (!isClosingRef.current) {\n        isClosingRef.current = true;\n        window.history.back();\n      }\n      setTimeout(() => {\n        onComplete(allPageUrls[0], undefined, allPageUrls, 'receipt_batch');\n        setIsProcessing(false);\n      }, 50);\n      return;\n    }"
);

// We also replace it in executeExport just in case it ever gets there
content = content.replace(
  "let finalRouting = exportOptions.routingType || (hasFinance && !hasVault ? 'receipt' : 'document');",
  "let finalRouting = exportOptions.routingType || defaultCategory || (hasFinance && !hasVault ? 'receipt' : 'document');"
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
