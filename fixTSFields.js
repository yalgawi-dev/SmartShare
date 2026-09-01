const fs = require('fs');

let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(/const unifiedBalances = new Map<string, { name: string, paid: number, expected: number, balance: number, userId: string, isMember: boolean, transfersSent: number, transfersReceived: number, p: number }>\(\);/, `const unifiedBalances = new Map<string, { name: string, paid: number, expected: number, balance: number, userId: string, isMember: boolean, transfersSent: number, transfersReceived: number, p: number, rawP?: number, isCreator?: boolean }>();`);

c = c.replace(`        userId: matchedId, 
        isMember: false, 
        transfersSent: 0, transfersReceived: 0,
        p: 0
      });`, `        userId: matchedId, 
        isMember: false, 
        transfersSent: 0, transfersReceived: 0,
        p: 0, rawP: 0, isCreator: false
      });`);

c = c.replace(`    }
    // If it's a store credit`, `    } else {
      if (matchedId === creatorId && !isCreatorMe && inv.payerName) {
        unifiedBalances.get(matchedId)!.name = inv.payerName;
      }
    }
    // If it's a store credit`);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed TS fields');
