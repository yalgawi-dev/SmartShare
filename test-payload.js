const data = { url: '/space/123', tag: 'chat-123-group' };
const msg = {
  token: 'dummy',
  notification: { title: 'T', body: 'B' },
  data: data || {},
  webpush: {
    fcmOptions: { link: '/' },
    ...(data?.tag ? { notification: { tag: data.tag } } : {})
  },
  ...(data?.tag ? { android: { notification: { tag: data.tag } } } : {}),
  ...(data?.tag ? { apns: { headers: { 'apns-collapse-id': data.tag } } } : {})
};
console.log(JSON.stringify(msg, null, 2));
