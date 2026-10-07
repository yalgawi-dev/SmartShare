const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// First remove the bad one
content = content.replace(/  useEffect\(\(\) => \{\s*if \(defaultMode === 'upload' && step === 'scanning'\) \{\s*setTimeout\(\(\) => \{\s*galleryInputRef\.current\?\.click\(\);\s*\}, 100\);\s*\}\s*\}, \[defaultMode, step\]\);\r?\n?/, '');

// Now add it properly after `const [step, setStep] = ...;`
content = content.replace(
  /const \[step, setStep\] = useState<'scanning' \| 'cropping' \| 'review'>\('scanning'\);/,
  "const [step, setStep] = useState<'scanning' | 'cropping' | 'review'>('scanning');\n  useEffect(() => {\n    if (defaultMode === 'upload' && step === 'scanning') {\n      setTimeout(() => {\n        galleryInputRef.current?.click();\n      }, 100);\n    }\n  }, [defaultMode, step]);"
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
