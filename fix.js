const fs = require('fs');
let txt = fs.readFileSync('src/app/api/send-notification/route.ts', 'utf8');

const search = `            webpush: {
              fcmOptions: {
                link: (data && data.url) ? data.url : '/'
              },
              ...(data?.tag ? { notification: { tag: data.tag } } : {})
            }`;

const replace = `            webpush: {
              fcmOptions: {
                link: (data && data.url) ? data.url : '/'
              },
              ...(data?.tag ? { notification: { title, body, tag: data.tag } } : {})
            }`;

txt = txt.replace(search, replace);
fs.writeFileSync('src/app/api/send-notification/route.ts', txt);
console.log('Fixed webpush notification override');
