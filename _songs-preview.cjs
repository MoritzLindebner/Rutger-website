const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { covers } = require('./_songs-sphere.js');

const host = process.argv[2] || '127.0.0.1';
const localAddresses = Object.values(os.networkInterfaces()).flat().filter(entry => entry.family === 'IPv4').map(entry => entry.address);
if (!localAddresses.includes(host)) throw new Error('Use an explicit IPv4 address assigned to this computer.');

const files = new Map([
  ['/', ['_songs-sphere.html', 'text/html; charset=utf-8']],
  ['/_songs-sphere.html', ['_songs-sphere.html', 'text/html; charset=utf-8']],
  ['/_songs-sphere.js', ['_songs-sphere.js', 'text/javascript; charset=utf-8']],
  ...covers.map(([name]) => [`/covers/${name}`, [`covers/${name}`, 'image/webp']]),
]);

http.createServer((request, response) => {
  const file = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404);
    response.end();
    return;
  }
  fs.readFile(path.join(__dirname, file[0]), (error, data) => {
    if (error) { response.writeHead(500); response.end(); return; }
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  });
}).listen(4176, host, () => {
  console.log(`Songs preview: http://${host}:4176`);
});
