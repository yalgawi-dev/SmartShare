const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');

const marker = "const [activeTab, setActiveTab] = useState<'summary' | 'transactions'>('summary');";
const injection = `
  useImperativeHandle(ref, () => ({
    processScan: (url: string) => {
      runOcrPipeline(url);
    }
  }));
`;

c = c.replace(marker, marker + injection);
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', c);
console.log('Added useImperativeHandle back');
