const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');

const groupModal = 
      {expandedPartnerId === 'group' && (
        <PartnerControlPanel
          member={{ userId: 'group', name: 'קבוצת המרחב', status: 'active' }}
          space={space}
          viewMode="peer"
          onClose={() => setExpandedPartnerId(null)}
        />
      )}
;
c = c.replace(
  "</p>\n      </div>\n    </div>\n  );\n}\n",
  "</p>\n      </div>\n    </div>\n" + groupModal + "  );\n}\n"
);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', c, 'utf8');
