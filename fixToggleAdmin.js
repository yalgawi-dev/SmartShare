
const fs = require("fs");
let content = fs.readFileSync("src/app/context/AuthContext.tsx", "utf-8");

const toggleAdminImpl = `  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (!user?.isAdmin) return;
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin: makeAdmin } : u));
    try {
      await updateDoc(doc(db, "users", userId), { isAdmin: makeAdmin });
    } catch (e) {
      console.error("Failed to toggle admin in Firestore", e);
    }
  };`;

content = content.replace("const blockUser = async (userId: string, block: boolean) => {", toggleAdminImpl + "\n\n  const blockUser = async (userId: string, block: boolean) => {");

fs.writeFileSync("src/app/context/AuthContext.tsx", content, "utf-8");
console.log("fixed toggleAdmin");

