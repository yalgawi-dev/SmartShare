const fs = require("fs");
const filePath = "src/app/context/SpacesContext.tsx";
let content = fs.readFileSync(filePath, "utf-8");

const target = `        const newMembersList = [...(space.members || []), newMember];
        
        // Atomically balance shares
        const { finalMembers, finalCreatorShare } = calculateBalancedShares(newMembersList, space.settings);
        
        return {
          ...space,
          members: finalMembers,
          settings: { ...space.settings, mySharePercentage: finalCreatorShare },
          invoices: updatedInvoices
        };
      });
    };`;

const replacement = `        const newMembersList = [...(space.members || []), newMember];
        
        let tempSettings = { ...space.settings };
        if (hasCustomShare) {
          tempSettings.mySharePercentage = Math.max(0, (tempSettings.mySharePercentage ?? 100) - customShare);
          tempSettings.isCustomShare = true;
        }

        // Atomically balance shares
        const { finalMembers, finalCreatorShare } = calculateBalancedShares(newMembersList, tempSettings);
        
        return {
          ...space,
          members: finalMembers,
          settings: { ...tempSettings, mySharePercentage: finalCreatorShare },
          invoices: updatedInvoices
        };
      });
    };`;

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, "utf-8");

