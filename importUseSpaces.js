const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');
c = c.replace(
  "import React, { useState } from 'react';",
  "import React, { useState } from 'react';\nimport { useSpaces } from '@/app/context/SpacesContext';"
);
fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Imported useSpaces');
