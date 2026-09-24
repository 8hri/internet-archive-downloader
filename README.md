# Hermes — Internet Archive Downloader

A small TypeScript/Node service that analyzes public Internet Archive items and streams validated files without buffering complete downloads.

## Development

```sh
npm install
npm run dev
```

Open <http://localhost:3000>.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

## Configuration

- `PORT` — HTTP port, default `3000`
- `MAX_CONCURRENT_DOWNLOADS` — maximum active upstream downloads, default `3`
- `DOWNLOAD_IDLE_TIMEOUT` — upstream request timeout in milliseconds, default `120000`
- `MAX_REDIRECTS` — maximum validated Archive.org redirects, default `5`
- Metadata requests use a bounded 10-minute in-memory cache.

## Architecture

- `src/url-parser.ts` validates archive.org URLs and extracts identifiers.
- `src/metadata.ts` uses the official `https://archive.org/metadata/{identifier}` endpoint, normalizes file records, and caches metadata briefly.
- `src/classifier.ts` and `src/recommender.ts` are pure, deterministic domain logic.
- `src/download.ts` resolves item/file pairs from metadata, validates redirects against an Archive.org host allowlist, and pipes the upstream body directly to the client.
- `src/server.ts` contains thin HTTP route handling and static UI serving.

Downloads never accept an arbitrary upstream URL. Range requests are forwarded only after the file has been resolved from metadata.

## Watch Online

Browser-native video playback is available for downloadable, browser-compatible MP4, WebM, Ogg, and OGV files. The `Watch Online` action in the file list opens the native browser player and streams the selected file through the same validated Archive.org file resolver used by downloads.

The streaming endpoint supports normal and partial requests:

```text
GET /api/archive/stream?identifier=ITEM&file=NAME
HEAD /api/archive/stream?identifier=ITEM&file=NAME
```

Range requests are forwarded to Internet Archive. The service preserves `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`, `ETag`, and `Last-Modified` when supplied upstream. The response body is piped progressively and is never buffered in full.

An `.mp4`, `.webm`, `.ogg`, or `.ogv` extension does not guarantee playback: browser codec/container support, Internet Archive access restrictions, upstream Range behavior, and proxy limits still apply. This feature does not transcode media, add HLS/DASH, or bypass access controls.

## API

- `POST /api/archive/analyze` with `{ "url": "https://archive.org/details/ITEM" }`
- `GET /api/archive/download?identifier=ITEM&file=NAME`
- `GET /api/archive/stream?identifier=ITEM&file=NAME`
- `HEAD /api/archive/stream?identifier=ITEM&file=NAME`

Internet Archive restrictions are surfaced as `403` application errors. The service does not attempt authentication, DRM, borrowing, private-item, or other access-control bypasses.
