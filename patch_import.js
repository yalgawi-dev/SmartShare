const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

tx = tx.replace(/import \{ useState, useEffect, useMemo \} from 'react';/g, "import { useState, useEffect, useMemo, useRef } from 'react';");
fs.writeFileSync('src/app/page.tsx', tx);
