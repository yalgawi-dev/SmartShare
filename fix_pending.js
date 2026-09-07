
const fs = require("fs");

const files = [
  "src/app/space/[id]/page.tsx",
  "src/components/widgets/FinanceWidget.tsx",
  "src/components/widgets/Finance/FinanceSummary.tsx",
  "src/components/widgets/Partners/PartnersSettingsList.tsx",
  "src/components/widgets/Partners/PendingApprovalBanner.tsx",
  "src/components/widgets/Partners/CreatorDisputesBanner.tsx"
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let code = fs.readFileSync(f, "utf8");
    code = code.replace(
      /myMember\?\.status === .pending. \|\| myMember\?\.status === .extension_requested./g,
      "myMember?.status === \"pending\" || myMember?.status === \"extension_requested\" || myMember?.status === \"disputed\""
    );
    // Also bump version visually for feedback loop
    code = code.replace(/v3\.8/g, "v3.9");
    fs.writeFileSync(f, code, "utf8");
    console.log("Fixed " + f);
  }
});

