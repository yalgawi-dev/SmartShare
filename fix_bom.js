const fs = require('fs');
const content = `export function universalSearch<T>(items: T[], query: string, keys: (keyof T)[]): T[] {
  if (!query || !query.trim()) return items;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return items.filter(item => {
    if (!item) return false;
    return keys.some(key => {
      const val = item[key];
      if (typeof val === 'string') {
        return val.toLowerCase().includes(lowerQuery);
      }
      return false;
    });
  });
}`;
fs.writeFileSync('src/utils/searchEngine.ts', content, 'utf8');
