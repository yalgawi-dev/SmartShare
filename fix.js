const fs = require('fs');
let txt = fs.readFileSync('src/app/api/send-notification/route.ts', 'utf8');

const search = `            webpush: {
              fcmOptions: {
                link: (data && data.url) ? data.url : '/'
              },
              notification: data?.tag ? { tag: data.tag } : undefined
            },
            android: data?.tag ? { notification: { tag: data.tag } } : undefined,
            apns: data?.tag ? { headers: { 'apns-collapse-id': data.tag } } : undefined
          });`;

const replace = `            webpush: {
              fcmOptions: {
                link: (data && data.url) ? data.url : '/'
              },
              ...(data?.tag ? { notification: { tag: data.tag } } : {})
            },
            ...(data?.tag ? { android: { notification: { tag: data.tag } } } : {}),
            ...(data?.tag ? { apns: { headers: { 'apns-collapse-id': data.tag } } } : {})
          });`;

txt = txt.replace(search, replace);
fs.writeFileSync('src/app/api/send-notification/route.ts', txt);
console.log('Fixed undefined in payload');
