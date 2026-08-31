const http = require('http');
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url.startsWith('/?bones=')) {
    const bones = decodeURIComponent(req.url.split('bones=')[1]);
    console.log("RECEIVED BONES:\n" + bones);
    res.end('ok');
    server.close();
    process.exit(0);
  } else {
    res.end('ok');
  }
});
server.listen(9999, () => {
  console.log("Listening on 9999...");
});
setTimeout(() => {
  console.log("Timed out waiting for bones");
  process.exit(1);
}, 25000);
