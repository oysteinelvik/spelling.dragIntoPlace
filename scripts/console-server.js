'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { uploadAll } = require('./mcp-upload');

const ROOT = path.resolve(__dirname, '..');
const CONSOLE_DIR = path.join(ROOT, 'tools', 'console');
const LANG_DIR = path.join(ROOT, 'lang');
const PORT = Number(process.env.CONSOLE_PORT) || 4300;

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const sseClients = new Set();
function broadcast(line) {
  console.log(line);
  const chunk = `data: ${line.replace(/\n/g, '\\n')}\n\n`;
  for (const client of sseClients) client.write(chunk);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

function serveStatic(res, baseDir, requestPath) {
  const resolved = path.normalize(path.join(baseDir, requestPath));
  if (!resolved.startsWith(baseDir)) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(resolved, (error, stats) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    sendFile(res, stats.isDirectory() ? path.join(resolved, 'index.html') : resolved);
  });
}

function runScript(scriptFile, onDone) {
  const child = spawn(process.execPath, [path.join(__dirname, scriptFile)], { cwd: ROOT });
  child.stdout.on('data', (buf) => buf.toString().split(/\r?\n/).filter(Boolean).forEach(broadcast));
  child.stderr.on('data', (buf) => buf.toString().split(/\r?\n/).filter(Boolean).forEach((line) => broadcast(`ERROR: ${line}`)));
  child.on('close', (code) => onDone(code === 0));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/logs') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (url.pathname === '/api/languages') {
    const languages = fs.existsSync(LANG_DIR)
      ? fs.readdirSync(LANG_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      : [];
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ languages }));
    return;
  }

  if (url.pathname === '/api/rebuild' && req.method === 'POST') {
    broadcast('--- Rebuilding content from spreadsheet ---');
    runScript('build-content.js', (ok) => {
      broadcast(ok ? '--- Rebuild finished ---' : '--- Rebuild failed ---');
    });
    res.writeHead(202).end('started');
    return;
  }

  if (url.pathname === '/api/package' && req.method === 'POST') {
    broadcast('--- Building packages ---');
    (async () => {
      const { buildPackages } = require('./build-packages');
      try {
        const built = buildPackages(broadcast);
        await uploadAll(built, broadcast);
      } catch (error) {
        broadcast(`ERROR: ${error.message}`);
      }
      broadcast('--- Package & upload finished ---');
    })();
    res.writeHead(202).end('started');
    return;
  }

  if (url.pathname.startsWith('/game/')) {
    serveStatic(res, ROOT, url.pathname.replace(/^\/game/, '') || '/index.html');
    return;
  }

  if (url.pathname === '/' || url.pathname === '') { sendFile(res, path.join(CONSOLE_DIR, 'index.html')); return; }
  serveStatic(res, CONSOLE_DIR, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Drag Into Place console: http://localhost:${PORT}`);
});
