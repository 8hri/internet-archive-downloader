export function safeFilename(value: string): string {
  const base = value.replaceAll('\\', '/').split('/').pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/\.\.+/g, '.').trim();
  return (cleaned || 'download').slice(0, 180);
}

export function contentDisposition(filename: string): string {
  const safe = safeFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
