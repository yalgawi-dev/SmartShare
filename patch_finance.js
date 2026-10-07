const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

// Fix 1: Toast timeout
const buggyToast = `      setToastMsg('החשבוניות נשלחו לעיבוד רקע בהצלחה!');`;
const fixedToast = `      setToastMsg('החשבוניות נשלחו לעיבוד רקע בהצלחה!');
      setTimeout(() => setToastMsg(null), 3500);`;
content = content.replace(buggyToast, fixedToast);

// Fix 2: Keep FinanceInbox mounted
const oldInboxRender = `          {activeTab === 'inbox' && (
            <FinanceInbox`;
const newInboxRender = `          <div style={{ display: activeTab === 'inbox' ? 'block' : 'none' }}>
            <FinanceInbox`;
content = content.replace(oldInboxRender, newInboxRender);

const oldInboxEnd = `            />
          )}`;
const newInboxEnd = `            />
          </div>`;
content = content.replace(oldInboxEnd, newInboxEnd);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
