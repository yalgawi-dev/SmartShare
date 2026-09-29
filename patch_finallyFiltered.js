const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceTransactions.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const finallyFiltered = filteredInvoices\.filter\(\(inv: any\) => \{[\s\S]*?return false;\r?\n  \}\);/;

const newFinallyFiltered = const finallyFiltered = filteredInvoices.filter((inv: any) => {
    let matchesType = false;
    if (typeFilter === 'transfer') matchesType = inv.type === 'transfer';
    else if (typeFilter === 'income') matchesType = inv.type === 'income';
    else matchesType = inv.type !== 'transfer' && inv.type !== 'income';
    
    if (!matchesType) return false;

    // Text Search Filter
    if (searchQuery && searchQuery.trim()) {
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

content = content.replace(regex, newFinallyFiltered);
fs.writeFileSync(file, content, 'utf8');
