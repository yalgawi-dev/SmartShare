
const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk("./src");
let count = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, "utf8");
  if (content.includes("v3.7")) {
    content = content.replace(/v3\.7/g, "v3.8");
    fs.writeFileSync(f, content, "utf8");
    console.log("Updated " + f);
    count++;
  }
});
console.log("Total files updated: " + count);

