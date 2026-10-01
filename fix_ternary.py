import re

with open('src/components/widgets/ScannerModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("            {/* Routing Choices */}\n            <div style={{ background: 'rgba(255,255,255,0.05)'", "            <div style={{ background: 'rgba(255,255,255,0.05)'")
content = content.replace("            {/* Routing Choices (No Finance) */}\n            <div style={{ background: 'rgba(255,255,255,0.05)'", "            <div style={{ background: 'rgba(255,255,255,0.05)'")
content = content.replace("            {/* Auto routing to receipt if no vault */}\n            <button onClick={() => handleDone('receipt')}", "            <button onClick={() => handleDone('receipt')}")

with open('src/components/widgets/ScannerModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed JSX comments in ternary.")
