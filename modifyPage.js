const fs = require('fs');
let lines = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf-8').split('\n');

// 1. Add imports
lines.splice(13, 0, "import { FloatingActionBar } from '../../../components/widgets/FloatingActionBar';");
lines.splice(14, 0, "import ScannerModal from '../../../components/widgets/ScannerModal';");

// 2. Add states
let stateIdx = lines.findIndex(l => l.includes('const [toastMessage, setToastMessage] = useState'));
lines.splice(stateIdx + 1, 0, "  const [isAddingExpense, setIsAddingExpense] = useState(false);");
lines.splice(stateIdx + 2, 0, "  const [isScannerOpen, setIsScannerOpen] = useState(false);");

// 3. Add handleFileUpload (if Finance is active, pass to FinanceWidget? Wait! We removed handleFileUpload from FinanceWidget. We need to implement it in page.tsx or keep it in FinanceWidget.
// Actually, `FinanceWidget` still has `addInvoice`. It's better if `page.tsx` just tells `FinanceWidget` to add it?
// Or we just pass `fileInputRef.current.click()` from FAB and let page.tsx handle it. But page.tsx doesn't have `addInvoice` directly.
// Wait, in `FinanceWidget`, we removed `handleFileUpload` which reads the file and calls `addInvoice`!
// I should restore `handleFileUpload` inside `FinanceWidget` and let `FinanceWidget` expose it, OR pass it as a prop.
// Easiest is: if the user clicks "Add Document", `FloatingActionBar` calls `onAddDocument`. Then `page.tsx` needs a reference to `FinanceWidget`? No, React is declarative.
// Let's check how `FinanceWidget` handles file upload originally.
