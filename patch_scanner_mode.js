const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

content = content.replace('maxBytes?: number;', "maxBytes?: number;\n  defaultMode?: 'camera' | 'upload';");
content = content.replace(
  'export default function ScannerModal({ onClose, onComplete, hasVault, hasFinance, maxBytes }: ScannerModalProps) {', 
  'export default function ScannerModal({ onClose, onComplete, hasVault, hasFinance, maxBytes, defaultMode = \'camera\' }: ScannerModalProps) {'
);

// We need a ref for the input and an effect to trigger it.
content = content.replace(
  'const isClosingRef = useRef(false);',
  "const galleryInputRef = useRef<HTMLInputElement>(null);\n  const isClosingRef = useRef(false);"
);

content = content.replace(
  'const [cvLoaded, setCvLoaded] = useState(false);',
  "const [cvLoaded, setCvLoaded] = useState(false);\n  useEffect(() => {\n    if (defaultMode === 'upload' && step === 'scanning') {\n      setTimeout(() => {\n        galleryInputRef.current?.click();\n      }, 100);\n    }\n  }, [defaultMode, step]);"
);

// Add the ref to the input
content = content.replace(
  '<input type="file" accept="image/*,application/pdf" multiple onChange={handleGalleryImport} style={{ display: \'none\' }} />',
  '<input ref={galleryInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleGalleryImport} style={{ display: \'none\' }} />'
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
