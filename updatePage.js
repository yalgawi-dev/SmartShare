const fs = require('fs');
let c = fs.readFileSync('src/app/page.tsx', 'utf-8');

c = c.replace("'use client';", "'use client';\nimport { useState, useEffect } from 'react';");

const targetState = "const { user, isLoaded, loginWithGoogle } = useAuth();";
const stateCode = `const { user, isLoaded, loginWithGoogle } = useAuth();
  const [guestTokens, setGuestTokens] = useState<string[]>([]);
  useEffect(() => {
    setGuestTokens(JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]'));
  }, []);`;
c = c.replace(targetState, stateCode);

const targetFilter = `const isMember = s.members?.some(m => m.userId === myId);`;
const filterCode = `const isMember = s.members?.some((m: any) => m.userId === myId || guestTokens.includes(m.userId));`;
c = c.replace(targetFilter, filterCode);

fs.writeFileSync('src/app/page.tsx', c);
console.log('Modified page.tsx');
