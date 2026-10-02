const { NextResponse } = require('next/server');
// Mock the API route structure
function buildMessage(data) {
  const msg = {
    token: 'dummy',
    notification: { title: 'T', body: 'B' },
    data: data || {},
    webpush: {
      fcmOptions: {
        link: (data && data.url) ? data.url : '/'
      },
      ...(data?.tag ? { notification: { tag: data.tag } } : {})
    },
    ...(data?.tag ? { android: { notification: { tag: data.tag } } } : {}),
    ...(data?.tag ? { apns: { headers: { 'apns-collapse-id': data.tag } } } : {})
  };
  return msg;
}
console.log(JSON.stringify(buildMessage({ url: '/space/123', tag: 'test' }), null, 2));
console.log(JSON.stringify(buildMessage({ url: '/space/123' }), null, 2));
