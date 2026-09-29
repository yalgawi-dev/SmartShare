const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceTransactions.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add searchQuery state
content = content.replace(/const \[memberFilter, setMemberFilter\] = useState<string>\('all'\);/, 
  "const [memberFilter, setMemberFilter] = useState<string>('all');\n  const [searchQuery, setSearchQuery] = useState<string>('');"
);

// 2. Replace finallyFiltered logic
const oldFinallyFilteredRegex = /const finallyFiltered = filteredInvoices\.filter\(\(inv: any\) => \{[\s\S]*?return false;\r?\n    \}\);/;
const newFinallyFiltered = const finallyFiltered = filteredInvoices.filter((inv: any) => {
      let matchesType = false;
      if (typeFilter === 'transfer') matchesType = inv.type === 'transfer';
      else if (typeFilter === 'income') matchesType = inv.type === 'income';
      else matchesType = inv.type !== 'transfer' && inv.type !== 'income';
      
      if (!matchesType) return false;

      // Text Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vendor = (inv.supplier || '').toLowerCase();
        const note = (inv.note || '').toLowerCase();
        const category = (inv.category || '').toLowerCase();
        if (!vendor.includes(q) && !note.includes(q) && !category.includes(q)) {
          return false;
        }
      }

      if (memberFilter === 'all') return true;

      const effectivePayer = inv.payerId === 'me' ? (space?.creatorId || 'me') : inv.payerId;
      
      if (filter === 'pending_partners') {
        // Pending Partners: We want invoices where the SELECTED PARTNER has NOT approved yet
        if (effectivePayer === memberFilter) return false; // The payer themselves don't owe approval
        if ((inv.approvedBy || []).includes(memberFilter)) return false; // Already approved
        if ((inv.excludedMembers || []).includes(memberFilter)) return false; // Excluded
        return true;
      } else if (filter === 'dispute') {
        // Dispute: show disputes related to the selected member (either they rejected it, or they are the payer)
        if (effectivePayer === memberFilter) return true;
        if (inv.rejectedById === memberFilter) return true;
        const filterUser = allUsers.find(u => u.id === memberFilter);
        if (!inv.rejectedById && inv.rejectedBy && filterUser && inv.rejectedBy.trim() === filterUser.name.trim()) return true;
        return false;
      } else {
        // Active/Archive: show invoices paid by the selected member
        if (effectivePayer !== memberFilter) return false;
      }

      return true;
    });;
content = content.replace(oldFinallyFilteredRegex, newFinallyFiltered);

// 3. Replace memberFilter dropdown in render
const oldDropdownRegex = /\{activePartnersCount > 0 && \(\s*<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1\.5rem' \}\}>\s*<span style=\{\{ fontSize: '0\.9rem', color: 'var\(--text-secondary\)' \}\}>סינון לפי שותף משלם:<\/span>[\s\S]*?<\/div>\s*\)\}/;

const newDropdownAndSearch =       <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.8rem' }}>
          <span style={{ marginRight: '0.5rem', color: 'var(--text-secondary)' }}>🔍</span>
          <input 
            type="text" 
            placeholder="חיפוש לפי ספק, הערה או קטגוריה..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', color: 'var(--text-main)', width: '100%' }}
          />
        </div>

        {/* Member Filter (hidden in pending_me) */}
        {activePartnersCount > 0 && filter !== 'pending_me' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {filter === 'pending_partners' ? 'ממתין לאישור של:' : filter === 'dispute' ? 'סונן לפי מסרב/משלם:' : 'הוצאות ששולמו ע"י:'}
            </span>
            <select 
              value={memberFilter} 
              onChange={(e) => setMemberFilter(e.target.value)}
              style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', background: 'var(--bg-main)', fontSize: '0.85rem' }}
            >
              <option value="all">כל השותפים</option>
              {allUsers
                .filter(u => filter === 'pending_partners' ? u.id !== myEffectiveId : true)
                .map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>;

content = content.replace(oldDropdownRegex, newDropdownAndSearch);

fs.writeFileSync(file, content, 'utf8');
