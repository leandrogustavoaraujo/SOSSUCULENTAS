import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/analyze.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png' };

try {
  const env = await fs.readFile(path.join(root, '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch { /* Local environment file is optional. */ }

const server = http.createServer(async (req, res) => {
  if (req.url?.split('?')[0] === '/api/analyze') return handler(req, res);
  const urlPath = decodeURIComponent(req.url?.split('?')[0] || '/');
  const pathname = urlPath === '/' ? '/index.html' : urlPath;
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root + path.sep) || target.includes(`${path.sep}.env`) || target.includes(`${path.sep}api${path.sep}`)) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const content = await fs.readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`SOS Suculentas: http://localhost:${port}`));
