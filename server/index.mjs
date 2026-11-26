import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase, database } from './database.ts';
import { POST as auth } from './auth/route.ts';
import { GET as getCouple, POST as editCouple } from './couple/route.ts';
import { GET as photo } from './couple/photo/route.ts';

const isDev = process.argv.includes('--dev');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5173);
const publicOrigin = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : null;
const staticRoot = new URL('../dist/', import.meta.url);
if (!isDev && !existsSync(new URL('index.html', staticRoot))) {
  console.error('Сначала соберите сайт командой npm run build.');
  process.exit(1);
}

const routes = new Map([
  ['POST /api/auth', auth],
  ['GET /api/couple', getCouple],
  ['POST /api/couple', editCouple],
  ['GET /api/couple/photo', photo],
]);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};

class PayloadTooLarge extends Error {}
async function requestBody(stream) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream.iterator({destroyOnReturn: false})) {
    size += chunk.length;
    if (size > 500_000) {
      stream.resume();
      throw new PayloadTooLarge();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

try {
  await initializeDatabase();
} catch (error) {
  console.error('Не удалось подготовить MySQL:', error.message);
  await database.close();
  process.exit(1);
}

const dev = isDev ? await (await import('vite')).createServer({
  server: {middlewareMode: true, hmr: false, allowedHosts: publicOrigin ? [new URL(publicOrigin).hostname] : []},
}) : null;

async function respondToApi(incoming, outgoing, url) {
  const handler = routes.get(incoming.method + ' ' + url.pathname);
  const headers = new Headers(incoming.headers);
  const peer = incoming.socket.remoteAddress || 'local';
  const trustedProxy = process.env.TRUST_LOCAL_PROXY === '1' && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
  headers.set('CF-Connecting-IP', trustedProxy ? headers.get('X-Real-IP') || peer : peer);
  const request = new Request(url, {
    method: incoming.method,
    headers,
    body: incoming.method === 'POST' && handler ? await requestBody(incoming) : undefined,
  });
  const response = handler
    ? await handler(request)
    : Response.json({error:'Действие не найдено.'},{status:404});
  outgoing.writeHead(response.status, {...Object.fromEntries(response.headers), 'Cache-Control': 'no-store'});
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(outgoing, url, method) {
  const file = new URL('.' + (url.pathname === '/' ? '/index.html' : url.pathname), staticRoot);
  if (!file.href.startsWith(staticRoot.href)) {
    outgoing.writeHead(404).end();
    return;
  }
  const path = fileURLToPath(file);
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) {
    outgoing.writeHead(404).end();
    return;
  }
  outgoing.writeHead(200, {
    'Content-Type': mime[extname(path)] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (method === 'HEAD') outgoing.end();
  else createReadStream(path).pipe(outgoing);
}

const server = createServer(async (incoming, outgoing) => {
  outgoing.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const target = incoming.url || '/';
    if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
      outgoing.writeHead(400).end();
      return;
    }
    const url = new URL(target, publicOrigin || 'http://' + incoming.headers.host);
    if (url.pathname.startsWith('/api/')) await respondToApi(incoming, outgoing, url);
    else if (dev) dev.middlewares(incoming, outgoing);
    else if (incoming.method === 'GET' || incoming.method === 'HEAD') await serveStatic(outgoing, url, incoming.method);
    else outgoing.writeHead(405).end();
  } catch (error) {
    if (!(error instanceof PayloadTooLarge)) console.error(error);
    if (outgoing.headersSent) outgoing.destroy();
    else outgoing.writeHead(error instanceof PayloadTooLarge ? 413 : 500, {'Content-Type':'application/json; charset=utf-8'})
      .end(JSON.stringify({error: error instanceof PayloadTooLarge ? 'Файл слишком большой.' : 'Сервер временно недоступен.'}));
  }
});

server.listen(port, host, () => console.log('Рядом: ' + (publicOrigin || 'http://' + host + ':' + port)));
