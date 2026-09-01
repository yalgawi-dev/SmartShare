const fs = require('fs');

const fixProfile = (path) => {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf-8');
  // replace profile?.name with (user?.realName || user?.nickname)
  content = content.replace(/profile\?\.name/g, "(user?.realName || user?.nickname)");
  // If there's any other profile. it might break
  content = content.replace(/profile\?\.avatarUrl/g, "user?.photoURL");
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Fixed profile in ' + path);
};

fixProfile('src/components/widgets/GalleryWidget.tsx');
fixProfile('src/components/widgets/GuestbookWidget.tsx');
fixProfile('src/components/widgets/TopGuestsWidget.tsx');
