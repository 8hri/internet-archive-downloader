import type { FileType } from './types.js';

const TYPE_EXTENSIONS: Record<FileType, string[]> = {
  video: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v', 'mpeg', 'mpg', 'ogv'],
  audio: ['mp3', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'aac'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tif', 'tiff', 'bmp', 'svg'],
  document: ['pdf', 'epub', 'mobi', 'azw', 'azw3', 'djvu', 'txt', 'doc', 'docx'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  other: []
};

export function classifyFile(name: string, mimeType?: string, format?: string): FileType {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || mime === 'application/epub+zip' || mime.startsWith('text/')) return 'document';
  if (mime === 'application/zip' || mime === 'application/x-7z-compressed' || mime === 'application/x-rar-compressed') return 'archive';
  const value = `${format ?? ''} ${name}`.toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  for (const type of ['video', 'audio', 'image', 'document', 'archive'] as FileType[]) {
    if (TYPE_EXTENSIONS[type].includes(ext) || TYPE_EXTENSIONS[type].some((candidate) => value.includes(candidate))) return type;
  }
  return 'other';
}

export function isSupportFile(name: string, format?: string, source?: string): boolean {
  const value = `${name} ${format ?? ''} ${source ?? ''}`.toLowerCase();
  return /(?:^|[._-])(?:__ia_thumb|thumb|thumbnail|metadata|meta|files|reviews|checksum|md5|manifest|torrent|sqlite|ocr)(?:[._-]|$)/.test(value)
    || /\.(?:xml|sqlite|torrent|meta|db|json)$/i.test(name);
}
