export function universalSearch<T>(items: T[], query: string, keys: (keyof T)[]): T[] {
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
}

/**
 * Generic sorting engine that sorts items by a time metric, with a fallback to alphabetical name if timestamps are equal.
 */
export function universalSort<T>(
  items: T[], 
  timeExtractor: (item: T) => number,
  nameExtractor?: (item: T) => string
): T[] {
  return [...items].sort((a, b) => {
    const timeA = timeExtractor(a);
    const timeB = timeExtractor(b);
    
    if (timeA !== timeB) return timeB - timeA;
    
    if (nameExtractor) {
      const nameA = nameExtractor(a) || '';
      const nameB = nameExtractor(b) || '';
      return nameA.localeCompare(nameB, 'he');
    }
    return 0;
  });
}
