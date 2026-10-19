/** Production server: the built page from dist/ (or STATIC_DIR) and the API, on PORT (default 3000). */
import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createApi } from './api.ts';

try {
  process.loadEnvFile();
} catch {
  // no .env: the environment alone
}

// The built page: dist/, or STATIC_DIR (relative to the repo) to serve another build.
const staticDir = process.env.STATIC_DIR || 'dist';
const root = join(import.meta.dirname, '..', staticDir);
const api = createApi(process.env, join(import.meta.dirname, '..'), staticDir);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.woff': 'font/woff',
};

/**
 * This server's public address, for the link-preview tags (previews need absolute URLs): the Host the visitor
 * used, and https when a proxy (a tunnel) says so, or PUBLIC_ORIGIN when set. Anything odd in the header falls back
 * to a relative URL.
 */
const publicOrigin = process.env.PUBLIC_ORIGIN && URL.canParse(process.env.PUBLIC_ORIGIN) ? new URL(process.env.PUBLIC_ORIGIN).origin : '';

function origin(req: IncomingMessage): string {
  if (publicOrigin) return publicOrigin;
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return '';
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https' ? 'https' : 'http';
  return `${proto}://${host}`;
}

// Behind a proxy (the apps.sabater.io Worker), only requests carrying its secret are served, so the server's own
// address cannot be used to skip the proxy. The health check stays open for the host.
const proxySecret = process.env.PROXY_SECRET ?? '';
const fromProxy = (req: IncomingMessage): boolean => {
  const got = Buffer.from(String(req.headers['x-proxy-secret'] ?? ''));
  const want = Buffer.from(proxySecret);
  return got.length === want.length && timingSafeEqual(got, want);
};

createServer(async (req, res) => {
  try {
    if (proxySecret && req.url !== '/api/health' && !fromProxy(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' }).end('{"error":"use the public site"}');
      return;
    }
    if (await api(req, res)) return;
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    // An absolute path normalizes inside itself, so the file stays under dist/.
    let file = join(root, normalize(path));
    try {
      if (!(await stat(file)).isFile()) file = join(root, 'index.html');
    } catch {
      file = join(root, 'index.html');
    }
    let body: Buffer | string = await readFile(file);
    if (file.endsWith('index.html')) {
      let html = body.toString('utf8');
      // A share link previews its own game, and a match invite its room: their own image and words.
      const p = api.preview(path);
      if (p) {
        const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        html = html
          .replace(/(property="og:title" content=")[^"]*/, `$1${attr(p.title)}`)
          .replace(/(property="og:description" content=")[^"]*/, `$1${attr(p.description)}`)
          .replace(/(property="og:image" content=")[^"]*/, `$1__ORIGIN__${p.image}`)
          .replace(/(property="og:url" content=")[^"]*/, `$1__ORIGIN__${path}`)
          .replace(/<title>[^<]*<\/title>/, `<title>${attr(p.title)}</title>`);
      }
      body = html.replaceAll('__ORIGIN__', origin(req));
    }
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(Number(process.env.PORT ?? 3000), () => console.log(`jev-cards on http://localhost:${process.env.PORT ?? 3000}`));
