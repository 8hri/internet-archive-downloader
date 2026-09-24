import { Readable } from 'node:stream';
import { AppError, asAppError } from './errors.js';
import { contentDisposition, safeFilename } from './filename.js';
import { archiveDownloadUrl } from './url-parser.js';
import { validateTrustedUrl } from './security.js';
import { resolveFile } from './metadata.js';
import type { ArchiveFile } from './types.js';

let active = 0;
let waiting: Array<() => void> = [];
const maxConcurrent = () => Math.max(1, Number(process.env.MAX_CONCURRENT_DOWNLOADS ?? 3));
async function acquire(): Promise<void> { if (active < maxConcurrent()) { active++; return; } await new Promise<void>((resolve) => waiting.push(resolve)); active++; }
function release(): void { active--; waiting.shift()?.(); }

const forwarded = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
export function isBrowserPlayableVideo(file: ArchiveFile): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.downloadable && !file.restricted && (file.type === 'video' || file.mimeType?.toLowerCase().startsWith('video/') === true) && ['mp4', 'webm', 'ogg', 'ogv'].includes(ext);
}

interface ProxyOptions { videoOnly?: boolean; allowRangeFallback?: boolean; inline?: boolean; propagate416?: boolean; headOnly?: boolean }
async function proxyArchiveFile(identifier: string, fileName: string, clientRange: string | undefined, response: import('node:http').ServerResponse, options: ProxyOptions): Promise<void> {
  const { file } = await resolveFile(identifier, fileName);
  if (!file.downloadable) throw new AppError(file.restricted ? 'FILE_RESTRICTED' : 'FILE_NOT_FOUND', file.restricted ? 'This file is restricted by Internet Archive.' : 'The file is unavailable.', file.restricted ? 403 : 404);
  if (options.videoOnly && !isBrowserPlayableVideo(file)) throw new AppError('BAD_REQUEST', 'This file is not a browser-playable Internet Archive video.', 415);
  let upstream: Response;
  await acquire();
  try {
    const target = validateTrustedUrl(archiveDownloadUrl(identifier, fileName));
    const headers: Record<string, string> = { accept: options.videoOnly ? 'video/*,application/octet-stream;q=0.9,*/*;q=0.1' : '*/*' };
    if (clientRange && /^(?:bytes=\d*-\d*(?:,\s*bytes=\d*-\d*)*)$/.test(clientRange)) headers.range = clientRange;
    let destination = target;
    const maxRedirects = Math.max(0, Number(process.env.MAX_REDIRECTS ?? 5));
    for (let redirects = 0; ; redirects++) {
      try { upstream = await fetch(destination, { method: options.headOnly ? 'HEAD' : 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(Number(process.env.DOWNLOAD_IDLE_TIMEOUT ?? 120000)) }); }
      catch (error) { throw asAppError(error); }
      if (upstream.status < 300 || upstream.status >= 400) break;
      if (![301, 302, 307, 308].includes(upstream.status) || redirects >= maxRedirects) throw new AppError('DOWNLOAD_FAILED', 'Internet Archive returned an unsupported or excessive redirect.', 502);
      const location = upstream.headers.get('location');
      if (!location) throw new AppError('DOWNLOAD_FAILED', 'Internet Archive returned an invalid redirect.', 502);
      destination = validateTrustedUrl(new URL(location, destination));
    }
    if (upstream.status === 401 || upstream.status === 403) throw new AppError('AUTHENTICATION_REQUIRED', 'This file requires Internet Archive authorization.', 403);
    if (upstream.status === 404) throw new AppError('FILE_NOT_FOUND', 'The file was not found at Internet Archive.', 404);
    if (upstream.status === 416 && options.propagate416) {
      response.statusCode = 416;
      const range = upstream.headers.get('content-range'); if (range) response.setHeader('Content-Range', range);
      response.end(); return;
    }
    if (!upstream.ok && upstream.status !== 206) throw new AppError('DOWNLOAD_FAILED', 'Internet Archive could not provide the file.', 502);
    if (clientRange && upstream.status === 200 && !options.allowRangeFallback) throw new AppError('RANGE_NOT_SUPPORTED', 'This file does not support partial downloads.', 416);
    response.statusCode = upstream.status;
    for (const name of forwarded) { const value = upstream.headers.get(name); if (value) response.setHeader(name, value); }
    if (upstream.status === 206) response.setHeader('Accept-Ranges', 'bytes');
    if (options.inline) {
      const safe = safeFilename(fileName);
      response.setHeader('Content-Disposition', `inline; filename="${safe.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"`);
    } else response.setHeader('Content-Disposition', contentDisposition(fileName));
    if (!upstream.body) {
      if (options.headOnly) { response.end(); return; }
      throw new AppError('DOWNLOAD_FAILED', 'Internet Archive returned an empty response.', 502);
    }
    response.flushHeaders();
    if (options.headOnly) { response.end(); return; }
    await new Promise<void>((resolve, reject) => {
      const stream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream);
      stream.on('error', reject);
      response.on('close', () => { if (!response.writableEnded) stream.destroy(); });
      stream.on('end', resolve); stream.pipe(response);
    });
  } finally { release(); }
}

export function streamDownload(identifier: string, fileName: string, clientRange: string | undefined, response: import('node:http').ServerResponse): Promise<void> {
  return proxyArchiveFile(identifier, fileName, clientRange, response, {});
}

export function streamVideo(identifier: string, fileName: string, clientRange: string | undefined, response: import('node:http').ServerResponse, headOnly = false): Promise<void> {
  return proxyArchiveFile(identifier, fileName, clientRange, response, { videoOnly: true, allowRangeFallback: true, inline: true, propagate416: true, headOnly });
}
