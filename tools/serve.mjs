#!/usr/bin/env node
// Minimal static server with correct MIME types for ES modules
// (python http.server serves .js as text/plain on Windows).
//   node tools/serve.mjs [port] [dir]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] || 8018);
const dir = process.argv[3] || 'app';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (path.endsWith('/') || !path) path += 'index.html';
    let file = await readFile(join(dir, path));
    // ?pump=1 replaces rAF with a timer pump so the game keeps animating in
    // occluded/背景ed test tabs (dev helper only, no effect on normal play).
    // ?trap=1 additionally records any exception thrown by a frame callback,
    // which is how a dead animation loop gets diagnosed.
    if (path.endsWith('index.html') && url.searchParams.get('pump')) {
      const shim = `<script>(function(){
        const q = [];
        window.requestAnimationFrame = (cb) => (q.push(cb), q.length);
        const errs = [];
        window.__rafErrs = errs;
        const note = (e) => {
          if (errs.length < 30) errs.push(String((e && e.stack) || e).split('\\n').slice(0, 5).join(' | '));
          try { localStorage.setItem('__raf_errs', JSON.stringify(errs)); } catch (x) {}
        };
        addEventListener('error', note);
        addEventListener('unhandledrejection', (e) => note(e.reason));
        const pump = () => {
          const batch = q.splice(0);
          const t = performance.now();
          batch.forEach((cb) => { try { cb(t); } catch (e) { note(e); } });
        };
        // MessageChannel tasks escape background-tab timer throttling.
        const ch = new MessageChannel();
        let last = 0;
        ch.port1.onmessage = () => {
          const now = performance.now();
          if (now - last >= 55) { last = now; pump(); }
          ch.port2.postMessage(0);
        };
        ch.port2.postMessage(0);
      })();</script>`;
      const html = file.toString('utf8').replace('<head>', '<head>' + shim);
      file = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(file);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`serving ${dir}/ on http://localhost:${port}/`));
