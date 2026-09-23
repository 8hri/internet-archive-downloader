import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asAppError, AppError } from './errors.js';
import { fetchAnalysis } from './metadata.js';
import { parseArchiveUrl } from './url-parser.js';
import { streamDownload } from './download.js';

const root = join(process.cwd(), 'public');
const port = Number(process.env.PORT ?? 3000);
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function json(res: ServerResponse, status: number, value: unknown): void { const body = JSON.stringify(value); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) }); res.end(body); }
async function body(req: IncomingMessage): Promise<unknown> { let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 32_768) throw new AppError('BAD_REQUEST', 'Request body is too large.'); } return data ? JSON.parse(data) : {}; }

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) { const content = await readFile(join(root, 'index.html')); res.writeHead(200, { 'content-type': mime['.html'], 'x-content-type-options': 'nosniff' }); res.end(content); return; }
  if (req.method === 'GET' && url.pathname === '/app.js') { const content = await readFile(join(root, 'app.js')); res.writeHead(200, { 'content-type': mime['.js'], 'x-content-type-options': 'nosniff' }); res.end(content); return; }
  if (req.method === 'POST' && url.pathname === '/api/archive/analyze') { const input = await body(req) as { url?: unknown }; json(res, 200, await fetchAnalysis(parseArchiveUrl(input.url))); return; }
  if (req.method === 'GET' && url.pathname === '/api/archive/download') { await streamDownload(url.searchParams.get('identifier') ?? '', url.searchParams.get('file') ?? '', req.headers.range, res); return; }
  throw new AppError('BAD_REQUEST', 'Route not found.', 404);
}

createServer((req, res) => { void route(req, res).catch((error) => { const app = asAppError(error); if (!res.headersSent) json(res, app.status, { error: { code: app.code, message: app.message } }); else res.destroy(); }); }).listen(port, () => console.log(JSON.stringify({ event: 'server.started', port })));
