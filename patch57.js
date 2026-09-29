const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
const search = "    </div>\n  );\n}";
const replacement =       {expandedPartnerId === 'group' && (
        <PartnerControlPanel
          member={{ userId: 'group', name: 'קבוצת המרחב', status: 'active' }}
          space={space}
          viewMode="peer"
          onClose={() => setExpandedPartnerId(null)}
        />
      )}
    </div>
  );
};
c = c.replace(search, replacement);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', c, 'utf8');
