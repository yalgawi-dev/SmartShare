const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace {mode !== 'forgot' && ( for the social buttons with { (mode === 'login' || mode === 'register') && (
const target = `{mode !== 'forgot' && (
          <>
            
            <button type="button" onClick={() => setMode('phone')}`;

const replacement = `{(mode === 'login' || mode === 'register') && (
          <>
            
            <button type="button" onClick={() => setMode('phone')}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched social buttons visibility");
} else {
  console.log("Could not find social buttons block");
}
