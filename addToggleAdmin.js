
const fs = require("fs");
let content = fs.readFileSync("src/app/context/AuthContext.tsx", "utf-8");

content = content.replace(
  "blockUser: (userId: string, block: boolean) => void; // Admin action",
  "blockUser: (userId: string, block: boolean) => void; // Admin action\n  toggleAdmin: (userId: string, makeAdmin: boolean) => void;"
);

content = content.replace(
  "blockUser: () => {},",
  "blockUser: () => {},\n  toggleAdmin: () => {},"
);

const blockUserImpl = `  const blockUser = async (userId: string, block: boolean) => {
    if (!user?.isAdmin) return;
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: block } : u));
    
    try {
      await updateDoc(doc(db, "users", userId), { isBlocked: block });
    } catch (e) {
      console.error("Failed to block user in Firestore", e);
    }
  };`;

const toggleAdminImpl = `  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (!user?.isAdmin) return;
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin: makeAdmin } : u));
    try {
      await updateDoc(doc(db, "users", userId), { isAdmin: makeAdmin });
    } catch (e) {
      console.error("Failed to toggle admin in Firestore", e);
    }
  };`;

content = content.replace(blockUserImpl, blockUserImpl + "\n\n" + toggleAdminImpl);
content = content.replace(
  "blockUser, isLoaded",
  "blockUser, toggleAdmin, isLoaded"
);

fs.writeFileSync("src/app/context/AuthContext.tsx", content, "utf-8");
console.log("Added toggleAdmin");

