const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceTransactions.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('touchStart')) {
  content = content.replace(
    'const [editForm, setEditForm] = useState({ amount: \'\', supplier: \'\', date: \'\' });',
    const [editForm, setEditForm] = useState({ amount: '', supplier: '', date: '' });

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      const tabs = ["all"];
      const hasArchive = invoices.some((i: any) => i.isActive === false);
      const hasPendingMe = activePartnersCount > 0 || invoices.some((i: any) => i.status === "pending" && i.payerId !== user?.id && i.payerId !== "me");
      const hasPendingPartners = activePartnersCount > 0 || invoices.some((i: any) => i.status === "pending" && (i.payerId === user?.id || i.payerId === "me"));
      if (hasArchive) tabs.push("archive");
      if (hasPendingMe) tabs.push("pending_me");
      if (hasPendingPartners) tabs.push("pending_partners");
      
      const currentIndex = tabs.indexOf(filter);
      if (isRightSwipe && currentIndex < tabs.length - 1) {
        setFilter(tabs[currentIndex + 1]);
      } else if (isLeftSwipe && currentIndex > 0) {
        setFilter(tabs[currentIndex - 1]);
      }
    }
  };
  );

  content = content.replace(
    'return (\n    <div>',
    eturn (\n    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndHandler}>
  );
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Swipe logic added to FinanceTransactions');
}
