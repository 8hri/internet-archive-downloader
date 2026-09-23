import { AppError } from './errors.js';

export function validateTrustedUrl(value: URL): URL {
  const host = value.hostname.toLowerCase();
  if (value.protocol !== 'https:' || (host !== 'archive.org' && !host.endsWith('.archive.org'))) {
    throw new AppError('UNSUPPORTED_URL', 'The upstream destination is not an approved Internet Archive host.', 400);
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) throw new AppError('UNSUPPORTED_URL', 'The upstream destination is not approved.', 400);
  return value;
}
