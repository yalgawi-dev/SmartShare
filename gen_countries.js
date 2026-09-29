const fs = require('fs');
const { allCountries } = require('country-telephone-data');

function getFlagEmoji(countryCode) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const formattedCountries = allCountries
  .filter(c => c.dialCode && c.iso2)
  .map(c => {
    let name = c.name;
    const bracketIndex = name.indexOf(' (');
    if (bracketIndex !== -1) name = name.substring(0, bracketIndex);
    return {
      name,
      iso2: c.iso2.toUpperCase(),
      dialCode: '+' + c.dialCode,
      flag: getFlagEmoji(c.iso2)
    };
  })
  .sort((a, b) => {
    if (a.iso2 === 'IL') return -1;
    if (b.iso2 === 'IL') return 1;
    if (a.iso2 === 'US') return -1;
    if (b.iso2 === 'US') return 1;
    if (a.iso2 === 'GB') return -1;
    if (b.iso2 === 'GB') return 1;
    return a.name.localeCompare(b.name);
  });

// Also deduplicate items with the exact same dialCode + iso2 if any
const uniqueCountries = [];
const seen = new Set();
for (const c of formattedCountries) {
  const key = c.iso2 + c.dialCode;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueCountries.push(c);
  }
}

const output = `export interface CountryData {
  name: string;
  iso2: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: CountryData[] = ${JSON.stringify(uniqueCountries, null, 2)};
`;

fs.writeFileSync('c:/yehuda/project/app/SmartShare/src/utils/countries.ts', output, 'utf8');
