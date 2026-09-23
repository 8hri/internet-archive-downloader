import { AppError } from './errors.js';
import { validateTrustedUrl } from './security.js';
import { classifyFile, isSupportFile } from './classifier.js';
import { recommendFiles } from './recommender.js';
import type { AnalysisResult, ArchiveItem, ArchiveFile } from './types.js';

interface RawMetadata { files?: unknown; metadata?: Record<string, unknown> }
interface RawFile { name?: unknown; format?: unknown; size?: unknown; md5?: unknown; mtime?: unknown; source?: unknown; mime?: unknown; private?: unknown; restricted?: unknown; access_restricted?: unknown; access_restricted_item?: unknown }
interface CacheEntry { value: AnalysisResult; expires: number }
const cache = new Map<string, CacheEntry>();
const CACHE_LIMIT = 100;

function text(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value : undefined; }
function number(value: unknown): number | undefined { const n = typeof value === 'number' ? value : Number(value); return Number.isFinite(n) && n >= 0 ? n : undefined; }

export async function fetchAnalysis(identifier: string, timeoutMs = 10000): Promise<AnalysisResult> {
  const cached = cache.get(identifier);
  if (cached && cached.expires > Date.now()) return cached.value;
  const url = validateTrustedUrl(new URL(`https://archive.org/metadata/${encodeURIComponent(identifier)}`));
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' }, redirect: 'error' });
  } catch (error) { throw new AppError('METADATA_REQUEST_FAILED', 'Internet Archive metadata could not be retrieved.', 502, error); }
  if (response.status === 404) throw new AppError('ITEM_NOT_FOUND', 'The Internet Archive item was not found.', 404);
  if (response.status === 401 || response.status === 403) throw new AppError('AUTHENTICATION_REQUIRED', 'This item requires Internet Archive authorization.', 403);
  if (!response.ok) throw new AppError('METADATA_REQUEST_FAILED', 'Internet Archive metadata could not be retrieved.', 502);
  let raw: RawMetadata;
  try { raw = await response.json() as RawMetadata; } catch (error) { throw new AppError('METADATA_REQUEST_FAILED', 'Internet Archive returned malformed metadata.', 502, error); }
  if (!raw || !Array.isArray(raw.files)) throw new AppError('FILE_LIST_FAILED', 'Internet Archive did not provide a file list.', 502);
  const meta = raw.metadata ?? {};
  const restrictedItem = Boolean(meta['access-restricted-item'] || meta['access-restricted'] || meta.private);
  const files: ArchiveFile[] = raw.files.flatMap((entry): ArchiveFile[] => {
    if (!entry || typeof entry !== 'object') return [];
    const f = entry as RawFile;
    const name = text(f.name);
    if (!name || name.length > 1024 || name.includes('\0')) return [];
    const restricted = restrictedItem || Boolean(f.private || f.restricted || f.access_restricted || f.access_restricted_item);
    const format = text(f.format);
    const mimeType = text(f.mime);
    const type = classifyFile(name, mimeType, format);
    return [{ name, format, mimeType, size: number(f.size), md5: text(f.md5), mtime: text(f.mtime), source: text(f.source), type, downloadable: !restricted && number(f.size) !== undefined, restricted, recommended: false, supportFile: isSupportFile(name, format, text(f.source)) }];
  });
  const item: AnalysisResult = { identifier, title: text(meta.title) ?? identifier, description: text(meta.description), creator: text(meta.creator), date: text(meta.date), files: recommendFiles(files) };
  const first = item.files.find((file) => file.recommended || (!file.supportFile && !file.restricted && file.downloadable));
  if (first) first.recommended = true;
  item.recommendedFile = first?.name;
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(identifier, { value: item, expires: Date.now() + 10 * 60_000 });
  return item;
}

export async function resolveFile(identifier: string, fileName: string): Promise<{ item: ArchiveItem; file: ArchiveFile }> {
  const item = await fetchAnalysis(identifier);
  const file = item.files.find((candidate) => candidate.name === fileName);
  if (!file) throw new AppError('FILE_NOT_FOUND', 'That file is not available for this item.', 404);
  return { item, file };
}
