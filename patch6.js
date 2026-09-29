const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');
c = c.replace("import { useState, useEffect } from 'react';", "import { useState, useEffect, useMemo } from 'react';\nimport NotificationCenterWidget from '../components/widgets/NotificationCenterWidget';");
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
