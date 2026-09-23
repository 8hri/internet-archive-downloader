import { AppError } from './errors.js';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const HOSTS = new Set(['archive.org', 'www.archive.org']);

export function parseArchiveUrl(input: unknown): string {
  if (typeof input !== 'string' || input.length > 2048) throw new AppError('INVALID_URL', 'Enter a valid Internet Archive URL.');
  if (/(?:^|\/)(?:\.\.|%2e%2e)(?:[\/?#]|$)/i.test(input.trim())) throw new AppError('INVALID_URL', 'Path traversal is not allowed.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new AppError('INVALID_URL', 'Enter a valid Internet Archive URL.'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new AppError('UNSUPPORTED_URL', 'Only HTTP(S) Internet Archive URLs are supported.');
  if (!HOSTS.has(url.hostname.toLowerCase())) throw new AppError('UNSUPPORTED_URL', 'Only archive.org URLs are supported.');
  if (url.username || url.password) throw new AppError('UNSUPPORTED_URL', 'Authenticated Internet Archive URLs are not supported.');
  let parts: string[];
  try { parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part)); } catch { throw new AppError('INVALID_URL', 'Enter a valid Internet Archive URL.'); }
  if (parts.length < 2 || !['details', 'download', 'metadata'].includes(parts[0])) throw new AppError('UNSUPPORTED_URL', 'Use an Internet Archive details, download, or metadata URL.');
  if (!IDENTIFIER.test(parts[1])) throw new AppError('INVALID_IDENTIFIER', 'The Internet Archive item identifier is invalid.');
  return parts[1];
}

export function archiveDownloadUrl(identifier: string, fileName: string): URL {
  if (!IDENTIFIER.test(identifier)) throw new AppError('INVALID_IDENTIFIER', 'The Internet Archive item identifier is invalid.');
  const encodedName = fileName.split('/').map(encodeURIComponent).join('/');
  return new URL(`https://archive.org/download/${encodeURIComponent(identifier)}/${encodedName}`);
}
