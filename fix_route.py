import re

with open('src/app/api/ocr/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add vatAmount to prompt
content = re.sub(
    r'- "amount": (.*?)\n',
    r'- "amount": \1\n        - "vatAmount": The VAT amount extracted as a number (слен от"о).\n',
    content
)

# Add vatAmount to schema
content = re.sub(
    r'amount: { type: "NUMBER", (.*?) },\n',
    r'amount: { type: "NUMBER", \1 },\n              vatAmount: { type: "NUMBER", description: "The VAT amount (слен дот\"о)" },\n',
    content
)

with open('src/app/api/ocr/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)
