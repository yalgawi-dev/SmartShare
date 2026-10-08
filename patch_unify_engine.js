const fs = require('fs');

let widget = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');
widget = widget.replace(
  "const [isScanning, setIsScanning] = useState(false);",
  "const [retroInvoiceToEdit, setRetroInvoiceToEdit] = useState<any>(null);\n  const [isScanning, setIsScanning] = useState(false);"
);
widget = widget.replace(
  "const runOcrPipeline = async (imgUrl: string, allPages?: string[]) => {",
  "const runOcrPipeline = async (imgUrl: string, allPages?: string[], retroInvoice?: any) => {\n    if (retroInvoice) setRetroInvoiceToEdit(retroInvoice); else setRetroInvoiceToEdit(null);"
);
widget = widget.replace(
  "processScan: (url: string, allPages?: string[]) => {\n      runOcrPipeline(url, allPages);\n    },",
  "processScan: (url: string, allPages?: string[], retroInvoice?: any) => {\n      runOcrPipeline(url, allPages, retroInvoice);\n    },"
);
widget = widget.replace(
  "const exists = space.invoices.find((inv: any) => isDuplicateInvoice(inv, data));",
  "const exists = space.invoices.find((inv: any) => (retroInvoice ? inv.id !== retroInvoice.id : true) && isDuplicateInvoice(inv, data));"
);
widget = widget.replace(
  "setReviewingInboxItemId(null);",
  "setReviewingInboxItemId(null);\n    setRetroInvoiceToEdit(null);"
);
const addInvoiceStr = "addInvoice(space.id, newInvoice);";
const replaceAddInvoice = `if (retroInvoiceToEdit) {
      updateInvoice(space.id, retroInvoiceToEdit.id, newInvoice, payerName, "צורפה חשבונית דרך הסורק ועודכנו פרטים");
      setRetroInvoiceToEdit(null);
      if(setIsAddingExpense) setIsAddingExpense(false);
    } else {
      addInvoice(space.id, newInvoice);
    }`;
widget = widget.replace(addInvoiceStr, replaceAddInvoice);
widget = widget.replace(
  "<FinanceAddExpenseForm ",
  "<FinanceAddExpenseForm \n          retroInvoiceToEdit={retroInvoiceToEdit}"
);
widget = widget.replace(
  "<FinanceTransactions ",
  "<FinanceTransactions \n            processRetroScan={(url, allPages, retroInv) => { if (retroInv) setRetroInvoiceToEdit(retroInv); runOcrPipeline(url, allPages, retroInv); }}\n"
);
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', widget);


let form = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');
form = form.replace("ocrData: any;", "ocrData: any;\n  retroInvoiceToEdit?: any;");
form = form.replace("ocrData,", "ocrData,\n  retroInvoiceToEdit,");
const initFormValues = `const [formValues, setFormValues] = React.useState({
    supplier: ocrData?.vendor || retroInvoiceToEdit?.supplier || '',
      clientName: ocrData?.clientName || retroInvoiceToEdit?.clientName || '',
    amount: ocrData?.amount ? String(ocrData.amount).replace(/[^\\d.]/g, '') : (retroInvoiceToEdit?.amount ? String(retroInvoiceToEdit.amount) : ''),
    vatAmount: ocrData?.vatAmount ? String(ocrData.vatAmount).replace(/[^\\d.]/g, '') : '',
    date: ocrData?.date || retroInvoiceToEdit?.date || new Date().toISOString().split('T')[0]
  });

  React.useEffect(() => {
    if (ocrData || retroInvoiceToEdit) {
      setFormValues({
        supplier: ocrData?.vendor || retroInvoiceToEdit?.supplier || '',
          clientName: ocrData?.clientName || retroInvoiceToEdit?.clientName || '',
        amount: ocrData?.amount ? String(ocrData.amount).replace(/[^\\d.]/g, '') : (retroInvoiceToEdit?.amount ? String(retroInvoiceToEdit.amount) : ''),
        vatAmount: ocrData?.vatAmount ? String(ocrData.vatAmount).replace(/[^\\d.]/g, '') : '',
        date: ocrData?.date || retroInvoiceToEdit?.date || new Date().toISOString().split('T')[0]
      });
    }
  }, [ocrData, retroInvoiceToEdit]);`;
form = form.replace(/const \[formValues, setFormValues\] = React\.useState\(\{[\s\S]*?\}\);[\s\S]*?React\.useEffect\(\(\) => \{[\s\S]*?\}, \[ocrData\]\);/, initFormValues);
form = form.replace(">הוסף הוצאה<", ">{retroInvoiceToEdit ? 'שמור וצרף חשבונית' : 'הוסף הוצאה'}<");
form = form.replace(">הוסף הכנסה<", ">{retroInvoiceToEdit ? 'שמור וצרף חשבונית' : 'הוסף הכנסה'}<");
form = form.replace(">הוסף העברה<", ">{retroInvoiceToEdit ? 'שמור וצרף מסמך' : 'הוסף העברה'}<");
fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', form);


let tx = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');
tx = tx.replace("expandedInvoiceId: string | null;", "expandedInvoiceId: string | null;\n  processRetroScan?: (url: string, allPages?: string[], retroInv?: any) => void;");
tx = tx.replace("expandedInvoiceId,\n  setExpandedInvoiceId,", "expandedInvoiceId,\n  setExpandedInvoiceId,\n  processRetroScan,");
const newHandleRetro = `const handleRetroScanComplete = async (url: string, singleImg?: string, allPages?: string[]) => {
    const inv = retroScanInvoice;
    if (inv && processRetroScan) {
      processRetroScan(url, allPages, inv);
    }
    setRetroScanInvoice(null);
  };`;
tx = tx.replace(/const handleRetroScanComplete = async \([\s\S]*?finally \{[\s\S]*?\}[\s\S]*?\};/, newHandleRetro);
tx = tx.replace(/\{retroScanWarning && \([\s\S]*?\}\)/g, "");
tx = tx.replace(/const \[retroScanWarning, setRetroScanWarning\] = useState<any>\(null\);\n/g, "");
tx = tx.replace(/const \[uploadingRetroId, setUploadingRetroId\] = useState<string \| null>\(null\);\n/g, "");
fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', tx);
