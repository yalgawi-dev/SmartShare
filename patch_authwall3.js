const fs = require('fs');
let file = 'src/components/widgets/Auth/AuthWall.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Destructure user and updateProfile
content = content.replace("const { loginWithPhone, isLoaded } = useAuth();", "const { loginWithPhone, isLoaded, user, updateProfile } = useAuth();");

// 2. Add state
content = content.replace("const [phone, setPhone] = useState('');", "const [phone, setPhone] = useState('');\n  const [name, setName] = useState('');");

// 3. Add useEffect to jump to step 3
const newEffect = 
  useEffect(() => {
    if (user && user.phone && !user.realName) {
      setStep(3);
    }
  }, [user]);
;
content = content.replace("const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);", "const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);\n" + newEffect);

// 4. Add handleSaveName
const saveNameFn = 
  const handleSaveName = async () => {
    if (!name.trim()) {
      setErrorMsg('יש להזין שם מלא.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateProfile({ realName: name.trim(), nickname: name.trim().split(' ')[0] });
    } catch (e) {
      setErrorMsg('שגיאה בשמירת השם.');
    }
    setIsSubmitting(false);
  };
;
content = content.replace("const handleVerify = async () => {", saveNameFn + "\n  const handleVerify = async () => {");

// 5. Add step 3 to JSX
const step3JSX = 
        {step === 3 ? (
          <div className="auth-form">
            <div className="input-group">
              <label>איך קוראים לך?</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setErrorMsg(''); }}
                  className="auth-input"
                  placeholder="שם מלא"
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                />
              </div>
            </div>
            {errorMsg && <div className="auth-error">{errorMsg}</div>}
            <button
              onClick={handleSaveName}
              disabled={isSubmitting || !name.trim()}
              className="auth-btn auth-btn-primary"
            >
              {isSubmitting ? <div className="spinner-small"></div> : 'שמור והמשך'}
            </button>
          </div>
        ) : step === 1 ? (;

content = content.replace("{step === 1 ? (", step3JSX);

fs.writeFileSync(file, content, 'utf8');
