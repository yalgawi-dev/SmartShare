const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/SortableTrayItem.tsx', 'utf8');

// Remove attributes and listeners from the wrapper div
code = code.replace(
  `      ref={setNodeRef} \n      style={style} \n      {...attributes} \n      {...listeners}`,
  `      ref={setNodeRef} \n      style={style}`
);

// Add the drag handle inside the inner div
code = code.replace(
  `          {status === 'active' && (\n            <div style={{ position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>\n              <span style={{ fontSize: '12px' }}>👁️</span>\n            </div>\n          )}`,
  `          {status === 'active' && (\n            <div style={{ position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>\n              <span style={{ fontSize: '12px' }}>👁️</span>\n            </div>\n          )}\n          <div \n            {...attributes}\n            {...listeners}\n            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '24px', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none' }}\n            onClick={(e) => e.stopPropagation()}\n          >\n            <span style={{ color: 'white', fontSize: '14px', lineHeight: 1 }}>:::</span>\n          </div>`
);

// We should also remove the pointerEvents intercept from the wrapper if any, but it's fine.
fs.writeFileSync('src/components/widgets/SortableTrayItem.tsx', code);
console.log('SortableTrayItem patched with drag handle');

// Patch SortableTray.tsx to remove TouchSensor delay
let trayCode = fs.readFileSync('src/components/widgets/SortableTray.tsx', 'utf8');
trayCode = trayCode.replace(
  `useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 15 } }),`,
  `useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 10 } }),`
);
fs.writeFileSync('src/components/widgets/SortableTray.tsx', trayCode);
console.log('SortableTray TouchSensor delay reduced');
