import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArchiveUrl } from '../src/url-parser.js';
import { classifyFile, isSupportFile } from '../src/classifier.js';
import { safeFilename, contentDisposition } from '../src/filename.js';
import { recommendFiles, scoreFile } from '../src/recommender.js';
import { validateTrustedUrl } from '../src/security.js';
import { isBrowserPlayableVideo } from '../src/download.js';
import type { ArchiveFile } from '../src/types.js';

test('parses supported Internet Archive URLs and rejects unrelated hosts', () => {
  assert.equal(parseArchiveUrl('https://archive.org/details/example/file.pdf?x=1#fragment'), 'example');
  assert.equal(parseArchiveUrl('https://archive.org/download/example/file.pdf'), 'example');
  assert.equal(parseArchiveUrl('https://archive.org/metadata/example'), 'example');
  assert.throws(() => parseArchiveUrl('https://evil.example/details/example'));
  assert.throws(() => parseArchiveUrl('https://archive.org/details/../secret'));
});
test('classifies formats and marks support files', () => {
  assert.equal(classifyFile('book.pdf'), 'document');
  assert.equal(classifyFile('movie.mkv'), 'video');
  assert.equal(classifyFile('song.MP3'), 'audio');
  assert.equal(classifyFile('photo.png'), 'image');
  assert.equal(classifyFile('files.zip'), 'archive');
  assert.equal(classifyFile('thing.bin'), 'other');
  assert.equal(isSupportFile('item_files.xml'), true);
  assert.equal(isSupportFile('item_archive.torrent'), true);
});
test('recommends user-facing content and does not hide legitimate alternatives', () => {
  const base = { downloadable: true, restricted: false, supportFile: false, recommended: false };
  const files: ArchiveFile[] = [
    { ...base, name: 'cover.jpg', type: 'image', size: 2000 },
    { ...base, name: 'book.pdf', type: 'document', size: 5_000_000 },
    { ...base, name: 'metadata.xml', type: 'other', size: 1000, supportFile: true }
  ];
  const ranked = recommendFiles(files);
  assert.equal(ranked[0].name, 'book.pdf');
  assert.ok(ranked.some((f) => f.name === 'cover.jpg'));
  assert.ok(scoreFile(ranked[0]) > 0);
});
test('identifies browser-playable video files without enabling arbitrary formats', () => {
  const base = { downloadable: true, restricted: false, supportFile: false, recommended: false, format: 'MPEG4', size: 1000 };
  assert.equal(isBrowserPlayableVideo({ ...base, name: 'movie.mp4', type: 'video' }), true);
  assert.equal(isBrowserPlayableVideo({ ...base, name: 'movie.webm', type: 'video' }), true);
  assert.equal(isBrowserPlayableVideo({ ...base, name: 'movie.ogv', type: 'video' }), true);
  assert.equal(isBrowserPlayableVideo({ ...base, name: 'notes.pdf', type: 'document' }), false);
  assert.equal(isBrowserPlayableVideo({ ...base, name: 'movie.mkv', type: 'video' }), false);
  assert.equal(isBrowserPlayableVideo({ ...base, name: 'movie.mp4', type: 'video', restricted: true }), false);
});
test('sanitizes filenames and header values', () => {
  assert.equal(safeFilename('../../evil\r\nname?.txt'), 'evil__name_.txt');
  assert.match(contentDisposition('résumé "x".pdf'), /^attachment; filename=/);
  assert.throws(() => validateTrustedUrl(new URL('https://localhost/archive')));
  assert.doesNotThrow(() => validateTrustedUrl(new URL('https://ia800000.us.archive.org/file')));
});
