const fs = require('fs');

let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add selectedCategory state to ScannerModal
const stateRegex = /const \[cvLoaded, setCvLoaded\] = useState\(false\);/;
if (!content.includes('selectedCategory')) {
    content = content.replace(stateRegex, "const [cvLoaded, setCvLoaded] = useState(false);\n  const [selectedCategory, setSelectedCategory] = useState<'receipt' | 'document' | 'image'>('receipt');\n  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);");
}

// 2. We need to initialize selectedCategory based on hasFinance and hasVault when the component mounts, but doing it in state init is tricky without props.
// We can just add a useEffect.
const useEffectRegex = /const \[scannedPages, setScannedPages\] = useState<ScannedPage\[\]>\(\[\]\);/;
if (!content.includes('useEffect(() => { if (hasFinance)')) {
    content = content.replace(useEffectRegex, `const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  
  useEffect(() => {
    if (hasFinance) setSelectedCategory('receipt');
    else if (hasVault) setSelectedCategory('document');
    else setSelectedCategory('image');
  }, [hasFinance, hasVault]);`);
}

// 3. Update handleDone to use selectedCategory
const handleDoneRegex = /const handleDone = \(routingType\?: 'receipt' \| 'document' \| 'image'\) => \{[\s\S]*?onComplete\(primary, currentImg, allPageUrls\.length > 1 \? allPageUrls : undefined, finalRouting as any\);\s*\};/;
const newHandleDone = `const handleDone = () => {
    const currentImg = imageCache[mode];
    if (!currentImg) return;
    const allPageUrls = [...scannedPages.map(p => p.imageUrl), currentImg];
    const primary = allPageUrls[0];
    onComplete(primary, currentImg, allPageUrls.length > 1 ? allPageUrls : undefined, selectedCategory);
  };
  
  const handleCategorySelect = (cat: 'receipt' | 'document' | 'image') => {
    setSelectedCategory(cat);
    if (cat === 'receipt' || cat === 'document') {
      handleFilterSwitch('smart_plus');
    } else if (cat === 'image') {
      handleFilterSwitch('pure_color');
    }
  };`;

content = content.replace(handleDoneRegex, newHandleDone);

// 4. Completely replace the Review step UI bottom section
const oldReviewBottom = /\{\/\* Filter buttons \*\/\}.*?\{\/\* Routing Buttons \*\/\}.*?<\/div>\s*\)\s*:\s*hasVault && !hasFinance \? \([\s\S]*?\)\s*:\s*\([\s\S]*?\)\}/s;
// Let's use a safer replacement block by just replacing the whole review tools wrapper.
const reviewStart = /\{\/\* Filter buttons \*\/\}/;
const reviewEndRegex = /\{\/\* Routing Buttons \*\/\}[\s\S]*?<\/div>[\s\S]*?\) : \([\s\S]*?<\/button>\s*\)\}/;
// Actually, let's just find where `step === 'review'` starts its bottom buttons.
