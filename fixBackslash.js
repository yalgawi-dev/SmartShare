const fs = require("fs");
let content = fs.readFileSync("src/app/admin/users/page.tsx", "utf-8");
content = content.replace("border: \\`1px solid \\${u.isAdmin ? '#f59e0b' : '#3B82F6'}\\`,", "border: u.isAdmin ? '1px solid #f59e0b' : '1px solid #3B82F6',");
fs.writeFileSync("src/app/admin/users/page.tsx", content, "utf-8");
console.log("Fixed backslashes!");
