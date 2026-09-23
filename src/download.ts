import { Readable } from 'node:stream';
import { AppError, asAppError } from './errors.js';
import { contentDisposition } from './filename.js';
import { archiveDownloadUrl } from './url-parser.js';
import { validateTrustedUrl } from './security.js';
import { resolveFile } from './metadata.js';

let active = 0;
let waiting: Array<() => void> = [];
const maxConcurrent = () => Math.max(1, Number(process.env.MAX_CONCURRENT_DOWNLOADS ?? 3));
async function acquire(): Promise<void> { if (active < maxConcurrent()) { active++; return; } await new Promise<void>((resolve) => waiting.push(resolve)); active++; }
function release(): void { active--; waiting.shift()?.(); }

const forwarded = ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'];
export async function streamDownload(identifier: string, fileName: string, clientRange: string | undefined, response: import('node:http').ServerResponse): Promise<void> {
  const { file } = await resolveFile(identifier, fileName);
  if (!file.downloadable) throw new AppError(file.restricted ? 'FILE_RESTRICTED' : 'FILE_NOT_FOUND', file.restricted ? 'This file is restricted by Internet Archive.' : 'The file is unavailable.', file.restricted ? 403 : 404);
  let upstream: Response;
  await acquire();
  try {
    const target = validateTrustedUrl(archiveDownloadUrl(identifier, fileName));
    const headers: Record<string, string> = { accept: '*/*' };
    if (clientRange && /^(?:bytes=\d*-\d*(?:,\s*bytes=\d*-\d*)*)$/.test(clientRange)) headers.range = clientRange;
    let destination = target;
    const maxRedirects = Math.max(0, Number(process.env.MAX_REDIRECTS ?? 5));
    for (let redirects = 0; ; redirects++) {
      try { upstream = await fetch(destination, { headers, redirect: 'manual', signal: AbortSignal.timeout(Number(process.env.DOWNLOAD_IDLE_TIMEOUT ?? 120000)) }); }
      catch (error) { throw asAppError(error); }
      if (upstream.status < 300 || upstream.status >= 400) break;
      if (![301, 302, 307, 308].includes(upstream.status) || redirects >= maxRedirects) throw new AppError('DOWNLOAD_FAILED', 'Internet Archive returned an unsupported or excessive redirect.', 502);
      const location = upstream.headers.get('location');
      if (!location) throw new AppError('DOWNLOAD_FAILED', 'Internet Archive returned an invalid redirect.', 502);
      destination = validateTrustedUrl(new URL(location, destination));
    }
    if (upstream.status === 401 || upstream.status === 403) throw new AppError('AUTHENTICATION_REQUIRED', 'This file requires Internet Archive authorization.', 403);
    if (upstream.status === 404) throw new AppError('FILE_NOT_FOUND', 'The file was not found at Internet Archive.', 404);
    if (!upstream.ok && upstream.status !== 206) throw new AppError('DOWNLOAD_FAILED', 'Internet Archive could not provide the file.', 502);
    if (clientRange && upstream.status === 200) throw new AppError('RANGE_NOT_SUPPORTED', 'This file does not support partial downloads.', 416);
    response.statusCode = upstream.status;
    for (const name of forwarded) { const value = upstream.headers.get(name); if (value) response.setHeader(name, value); }
    if (upstream.status === 206) response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Disposition', contentDisposition(fileName));
    if (!upstream.body) throw new AppError('DOWNLOAD_FAILED', 'Internet Archive returned an empty response.', 502);
    response.flushHeaders();
    await new Promise<void>((resolve, reject) => {
      const stream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream);
      stream.on('error', reject); response.on('close', () => { if (!response.writableEnded) stream.destroy(); });
      stream.on('end', resolve); stream.pipe(response);
    });
  } finally { release(); }
}
