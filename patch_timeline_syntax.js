const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

// I inserted this:
//   return (
//      <div style={{
//        {/* Hidden file input for direct timeline uploads */}
//        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleLocalUpload} />
//        {/* Hidden file input for direct timeline uploads */}
//        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleLocalUpload} />

// I need to extract these inputs and put them BEFORE the `<div style={{` using a Fragment!
const regex = /return \(\s*<div style=\{\{\s*(?:\{\/\* Hidden file input for direct timeline uploads \*\/\}\s*<input[^>]+>\s*)+/g;

tx = tx.replace(regex, `return (
    <>
      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleLocalUpload} />
      <div style={{`);

// Let's also make sure to add `</>` at the very end of the return
const lastClosingDivRegex = /<\/div>\s*\)\s*;\s*}\s*$/;
tx = tx.replace(lastClosingDivRegex, `</div>\n    </>\n  );\n}\n`);

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
