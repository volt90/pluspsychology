// Local preview serves only the gallery directory. No private repository files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../gallery');
const port = Number(process.env.GALLERY_PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res) => {
  let pathname;
  try {pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);} catch {res.writeHead(400).end(); return;}
  if (pathname === '/' || pathname === '/gallery') {res.writeHead(302, {Location:'/gallery/'}).end(); return;}
  if (!pathname.startsWith('/gallery/')) {res.writeHead(404).end('Not found'); return;}
  const filename = path.resolve(root, '.' + pathname.slice('/gallery'.length), pathname.endsWith('/') ? 'index.html' : '');
  if (!filename.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
  fs.stat(filename, (error, stat) => {
    if(error || !stat.isFile()) {res.writeHead(404).end('Not found'); return;}
    res.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(filename).pipe(res);
  });
}).listen(port, '127.0.0.1', () => process.stdout.write(`Gallery preview: http://127.0.0.1:${port}/gallery/\n`));
