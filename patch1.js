const fs = require('fs');
let content = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');

// Add to AuthContextType
content = content.replace(
  'isLoaded: boolean;',
  'isLoaded: boolean;\n  linkPhoneNumberMock: (phone: string) => Promise<void>;\n  findUserByPhone: (phone: string) => Promise<UserProfile | null>;'
);

// Add to Default Context
content = content.replace(
  'isLoaded: false,',
  'isLoaded: false,\n    linkPhoneNumberMock: async () => {},\n    findUserByPhone: async () => null,'
);

// Add to Provider Exports
content = content.replace(
  'deleteUserDoc, isLoaded',
  'deleteUserDoc, isLoaded, linkPhoneNumberMock, findUserByPhone'
);

fs.writeFileSync('src/app/context/AuthContext.tsx', content);
console.log('Modified AuthContext structures');
