import type { ArchiveFile } from './types.js';

export function scoreFile(file: ArchiveFile): number {
  if (file.restricted || !file.downloadable || file.supportFile) return -1000;
  let score = 0;
  if (file.type === 'video' || file.type === 'document' || file.type === 'audio') score += 100;
  if (file.type === 'image' || file.type === 'archive' || file.type === 'other') score += 20;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'm4v', 'mkv', 'webm', 'pdf', 'epub', 'm4a', 'mp3', 'flac'].includes(ext)) score += 25;
  if (/thumb|cover|itemimage|sample|preview/.test(file.name.toLowerCase())) score -= 60;
  if (file.size !== undefined && file.size < 1024) score -= 50;
  if (file.size !== undefined && file.size > 1024 * 1024) score += 10;
  return score;
}

export function recommendFiles(files: ArchiveFile[]): ArchiveFile[] {
  return files.map((file) => ({ ...file, recommended: false })).sort((a, b) => scoreFile(b) - scoreFile(a) || a.name.localeCompare(b.name));
}
