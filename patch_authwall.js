const fs = require('fs');
let file = 'src/components/widgets/Auth/AuthWall.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add countryCode state
content = content.replace("const [phone, setPhone] = useState('');", "const [phone, setPhone] = useState('');\n  const [countryCode, setCountryCode] = useState('+972');");

// 2. Update handleSendCode validation & formatting
const oldSendCode =   const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setErrorMsg('יש להזין מספר טלפון חוקי בן 10 ספרות.');
      return;
    }
    
    // Admin mock bypass
    if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
      setStep(2);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = \+972\\;;

const newSendCode =   const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\\D/g, '');
    
    if (countryCode === '+972') {
      if (cleanPhone.length < 9 || cleanPhone.length > 10) {
        setErrorMsg('יש להזין מספר טלפון חוקי בן 10 ספרות.');
        return;
      }
    } else {
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        setErrorMsg('יש להזין מספר טלפון חוקי לקידומת זו.');
        return;
      }
    }
    
    // Admin mock bypass
    if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
      setStep(2);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = \\\\;;

content = content.replace(oldSendCode, newSendCode);

// 3. Update the Input JSX
const oldInputJSX =               <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="auth-input"
                  placeholder="050-000-0000"
                  dir="ltr"
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                />
              </div>;

const newInputJSX =               <div className="phone-input-group" dir="ltr">
                <div className="country-select-wrapper">
                  <select 
                    className="country-select"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="+972">???? +972</option>
                    <option value="+1">???? +1</option>
                    <option value="+44">???? +44</option>
                    <option value="+33">???? +33</option>
                    <option value="+49">???? +49</option>
                  </select>
                  <div className="select-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="auth-input phone-input"
                  placeholder={countryCode === '+972' ? '050-000-0000' : 'Phone number'}
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                />
              </div>;

content = content.replace(oldInputJSX, newInputJSX);

// 4. Update the CSS
const cssInsert = 
        .phone-input-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .country-select-wrapper {
          position: relative;
          height: 56px;
        }

        .country-select {
          appearance: none;
          height: 100%;
          background: #F8FAFC;
          border: 2px solid #E2E8F0;
          border-radius: 16px;
          padding: 0 32px 0 16px;
          font-size: 16px;
          font-weight: 600;
          color: #0F172A;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .country-select:focus {
          border-color: var(--primary, #4F46E5);
          background: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }

        .select-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #64748B;
          display: flex;
        }

        .phone-input {
          flex: 1;
          padding: 0 16px !important;
        }
;

content = content.replace('.input-wrapper {', cssInsert + '\\n        .input-wrapper {');

// 5. Update OTP message text
content = content.replace('<b dir="ltr">{phone}</b>', '<b dir="ltr">{countryCode} {phone}</b>');

fs.writeFileSync(file, content, 'utf8');
