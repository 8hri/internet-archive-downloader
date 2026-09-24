const form = document.querySelector('#analyze-form');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const watch = document.querySelector('#watch');
const watchPlayer = document.querySelector('#watch-player');
const watchTitle = document.querySelector('#watch-title');
const watchStatus = document.querySelector('#watch-status');
const closeWatch = document.querySelector('#close-watch');
const formatBytes = (value) => { if (typeof value !== 'number') return 'Unknown size'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; let n = value, i = 0; while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; } return `${n.toFixed(i ? 1 : 0)} ${units[i]}`; };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (type) => ({ video: 'Video', audio: 'Audio', image: 'Image', document: 'Document', archive: 'Archive', other: 'Other' }[type] || 'Other');
form.addEventListener('submit', async (event) => { event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Analyzing item…'; results.textContent = ''; watch.hidden = true; try { const response = await fetch('/api/archive/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: new FormData(form).get('url') }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Analysis failed.'); render(data); status.textContent = ''; } catch (error) { status.textContent = error.message; } finally { button.disabled = false; } });
function render(item) {
  const files = item.files || [];
  const meaningful = files.filter((f) => !f.supportFile || f.downloadable);
  const recommended = meaningful.filter((f) => f.recommended);
  const others = meaningful.filter((f) => !f.recommended);
  const fileHtml = (f) => { const href = `/api/archive/download?identifier=${encodeURIComponent(item.identifier)}&file=${encodeURIComponent(f.name)}`; const streamHref = `/api/archive/stream?identifier=${encodeURIComponent(item.identifier)}&file=${encodeURIComponent(f.name)}`; const watchable = f.downloadable && f.type === 'video' && /\.(mp4|webm|ogg|ogv)$/i.test(f.name); return `<article class="file ${f.restricted ? 'restricted' : ''}"><input type="checkbox" aria-label="Select ${escapeHtml(f.name)}" ${f.downloadable ? '' : 'disabled'}><div class="file-main"><div class="name">${escapeHtml(f.name)}</div><div class="meta">${escapeHtml(f.format || label(f.type))} · ${formatBytes(f.size)}${f.restricted ? ' · Restricted by Internet Archive' : ''}</div></div>${watchable ? `<a href="${streamHref}" data-watch="${escapeHtml(f.name)}">▶ Watch Online</a>` : ''}${f.downloadable ? `<a href="${href}" download>Download</a>` : '<span class="muted">Unavailable</span>'}</article>`; };
  results.innerHTML = `<section class="item"><h2>${escapeHtml(item.title)}</h2><p class="muted">${escapeHtml(item.identifier)}</p>${item.description ? `<p>${escapeHtml(item.description).replace(/\s+/g, ' ').slice(0, 500)}</p>` : ''}<h3>${recommended.length ? 'Recommended' : 'Available downloads'}</h3>${recommended.map(fileHtml).join('') || '<p class="muted">No recommended file was identified.</p>'}<h3>Other files</h3>${others.map(fileHtml).join('') || '<p class="muted">No other files found.</p>'}<p><button type="button" id="download-selected">Download selected files</button></p></section>`;
  document.querySelector('#download-selected').addEventListener('click', () => { const selected = [...document.querySelectorAll('#results input[type="checkbox"]:checked')]; selected.forEach((box, index) => setTimeout(() => { const link = box.closest('.file').querySelector('a[download]'); if (link) link.click(); }, index * 500)); status.textContent = `${selected.length} file(s) queued for download. Progress is provided by your browser when available.`; });
  document.querySelectorAll('[data-watch]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); openPlayer(link.getAttribute('href'), link.getAttribute('data-watch')); }));
}
function openPlayer(source, name) { watchTitle.textContent = name; watchStatus.textContent = 'Loading video…'; watch.hidden = false; watchPlayer.src = source; watchPlayer.load(); watchPlayer.focus(); }
closeWatch.addEventListener('click', () => { watchPlayer.pause(); watchPlayer.removeAttribute('src'); watchPlayer.load(); watch.hidden = true; });
watchPlayer.addEventListener('error', () => { watchStatus.textContent = 'This video cannot be played in the browser or the stream was interrupted.'; });
