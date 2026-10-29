import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handler as scanHandler } from '../netlify/functions/scan.js';
import { handler as leadHandler } from '../netlify/functions/lead.js';
import { HandlerEvent } from '@netlify/functions';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8888;
const PUBLIC_DIR = path.resolve('public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Handle Netlify Functions
  if (pathname === '/.netlify/functions/scan' || pathname === '/api/scan') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const event: HandlerEvent = {
          rawUrl: req.url || '',
          rawQuery: url.search.substring(1),
          path: pathname,
          httpMethod: req.method || 'GET',
          headers: req.headers as Record<string, string>,
          multiValueHeaders: {},
          queryStringParameters: Object.fromEntries(url.searchParams),
          multiValueQueryStringParameters: null,
          body,
          isBase64Encoded: false
        };

        const result: any = await scanHandler(event, {} as any);
        res.writeHead(result.statusCode || 200, result.headers || { 'Content-Type': 'application/json' });
        res.end(result.body || '');
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/.netlify/functions/lead' || pathname === '/api/lead') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const event: HandlerEvent = {
          rawUrl: req.url || '',
          rawQuery: url.search.substring(1),
          path: pathname,
          httpMethod: req.method || 'GET',
          headers: req.headers as Record<string, string>,
          multiValueHeaders: {},
          queryStringParameters: Object.fromEntries(url.searchParams),
          multiValueQueryStringParameters: null,
          body,
          isBase64Encoded: false
        };

        const result: any = await leadHandler(event, {} as any);
        res.writeHead(result.statusCode || 200, result.headers || { 'Content-Type': 'application/json' });
        res.end(result.body || '');
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve Static Assets from public/
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) && fs.existsSync(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Telza AI Readiness Local Server Running!`);
  console.log(`👉 Open in your browser: http://localhost:${PORT}`);
  console.log(`   - Public UI:          http://localhost:${PORT}`);
  console.log(`   - About Scanner:      http://localhost:${PORT}/about-scanner.html`);
  console.log(`   - Privacy Notice:     http://localhost:${PORT}/privacy.html`);
  console.log(`   - Report Template:    http://localhost:${PORT}/report (or view toolkit/report_template.html)`);
  console.log(`======================================================\n`);
});
