const fs = require('fs');
const file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add onSnapshot to imports
if (!content.includes('onSnapshot')) {
  content = content.replace('getDocs, deleteDoc } from \'firebase/firestore\';', 'getDocs, deleteDoc, onSnapshot } from \'firebase/firestore\';');
}

// Replace fetchAllUsers
// Doing regex or split because of CRLF issues
const startStr = "const fetchAllUsers = async () => {";
const endStr = "}, [user?.isAdmin]);";

let startIndex = content.indexOf(startStr);
let endIndex = content.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  // back up slightly to get the comment
  startIndex = content.lastIndexOf("// Load all users", startIndex);
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex + endStr.length);
  
  const replacement = `// Load all users for the CRM (admin view) - now in REAL-TIME
  useEffect(() => {
    if (user?.isAdmin) {
      const unsubscribeUsers = onSnapshot(collection(db, 'users'), (usersSnap) => {
        setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserProfile));
      }, (e) => {
        console.error("Failed to fetch CRM users real-time", e);
      });
      return () => unsubscribeUsers();
    }
  }, [user?.isAdmin]);`;
  
  fs.writeFileSync(file, before + replacement + after, 'utf8');
  console.log("Done");
} else {
  console.log("Could not find start or end strings");
}
