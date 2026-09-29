const fs = require('fs');
let file = 'src/components/widgets/Auth/AuthWall.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('import { COUNTRIES }')) {
  content = content.replace("import { auth } from '@/lib/firebase';", "import { auth } from '@/lib/firebase';\\nimport { COUNTRIES } from '@/utils/countries';");
}

// 2. Replace the hardcoded <select> with a mapped one
const oldSelect = \<select 
                    className="country-select"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="+972">???? +972</option>
                    <option value="+1">???? +1</option>
                    <option value="+44">???? +44</option>
                    <option value="+33">???? +33</option>
                    <option value="+49">???? +49</option>
                  </select>\;

const newSelect = \<select 
                    className="country-select"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {COUNTRIES.map(c => (
                      <option key={\\-\\} value={c.dialCode}>
                        {c.flag} {c.dialCode} ({c.iso2})
                      </option>
                    ))}
                  </select>\;

content = content.replace(oldSelect, newSelect);

fs.writeFileSync(file, content, 'utf8');
