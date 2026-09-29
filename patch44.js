const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');

const groupModal = "\n      {expandedPartnerId === 'group' && (\n        <PartnerControlPanel\n          member={{ userId: 'group', name: 'קבוצת המרחב', status: 'active' }}\n          space={space}\n          viewMode=\"peer\"\n          onClose={() => setExpandedPartnerId(null)}\n        />\n      )}\n";

c = c.replace(
  "</p>\n      </div>\n    </div>\n  );\n}\n",
  "</p>\n      </div>\n    </div>\n" + groupModal + "  );\n}\n"
);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', c, 'utf8');
