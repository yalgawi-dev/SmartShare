const fs = require('fs');

let pageTx = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

pageTx = pageTx.replace(`      <PushNotificationReminder userId={user?.id} />\n`, '');

const oldBanners = `<PendingInvoicesBanner 
          space={space} 
          onScrollToFinance={() => {
            financeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Let the FinanceWidget know we want to jump to pending tab
            financeRef.current?.setFilter('pending_me');
          }} 
        />
        <WelcomeGate spaceId={id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />
        <CreatorDisputesBanner space={space} />
        <PendingApprovalBanner spaceId={space.id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />`;

const newBanners = `<WelcomeGate spaceId={id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />
        
        {/* Dynamic Alerts Carousel */}
        <div className="hide-scrollbars" style={{ 
          display: 'flex', 
          overflowX: 'auto', 
          gap: '1rem', 
          scrollSnapType: 'x mandatory', 
          scrollbarWidth: 'none', 
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '0.5rem'
        }}>
          <PushNotificationReminder userId={user?.id} />
          <PendingInvoicesBanner 
            space={space} 
            onScrollToFinance={() => {
              financeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              financeRef.current?.setFilter('pending_me');
            }} 
          />
          <CreatorDisputesBanner space={space} />
          <PendingApprovalBanner spaceId={space.id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />
        </div>`;

pageTx = pageTx.replace(oldBanners, newBanners);
fs.writeFileSync('src/app/space/[id]/page.tsx', pageTx);
console.log("Patched page layout");
