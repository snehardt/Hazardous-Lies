import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Server } from 'socket.io';
import { attachRooms } from './rooms.mjs';
const root = resolve('.');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const relative = path.slice(root.length + 1).replaceAll('\\', '/');
    if (!['index.html', 'style.css'].includes(relative) && !relative.startsWith('dist/') && !relative.startsWith('assets/')) { res.writeHead(404).end(); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found. Run npm run build first.'); }
});
attachRooms(new Server(server, { maxHttpBufferSize: 250000 }));
const port = Number(process.env.PORT || 5173), host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => console.log(`Hazardous Lies → http://localhost:${port} (listening on ${host}:${port})`));
