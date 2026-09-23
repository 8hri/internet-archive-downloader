# Internet Archive Downloader — Technical Design

## 1. Purpose

This document defines the technical architecture for a web application that provides a reliable download experience for legitimately downloadable Internet Archive content.

The application acts as a controlled HTTP client/proxy:

User
→ Web Application
→ Internet Archive
→ Web Application
→ User

The application does not bypass Internet Archive access controls.

---

## 2. Goals

### Primary Goals

- Accept Internet Archive URLs.
- Resolve item identifiers.
- Retrieve item metadata.
- Discover downloadable files.
- Classify files.
- Recommend useful files.
- Stream large downloads efficiently.
- Support HTTP Range behavior where upstream supports it.
- Provide clear errors and progress.
- Prevent SSRF and related attacks.

### Secondary Goals

- Multiple file selection.
- Download queue.
- Resume support.
- Optional ZIP creation.
- Metadata caching.
- Download history.

Secondary goals must not compromise the core streaming architecture.

---

## 3. Non-Goals

The system must not:

- bypass DRM
- bypass authentication
- bypass borrowing restrictions
- access private content without authorization
- circumvent access controls
- brute-force protected resources
- defeat technical protection mechanisms

The application only handles content that Internet Archive legitimately exposes to the requesting client.

---

## 4. High-Level Architecture

```text
┌───────────────────────────┐
│       Web Browser         │
│                           │
│ URL Input / File List     │
│ Download UI / Progress    │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│       API Layer           │
│                           │
│ Analyze / Download / etc. │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│      Domain Services      │
│                           │
│ URL Parser                │
│ Metadata Client           │
│ File Discovery            │
│ File Classifier           │
│ Recommendation Engine     │
│ Download Service          │
│ Security Validation       │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│    Internet Archive      │
│                           │
│ Metadata / File endpoints │
│ HTTP downloads            │
└───────────────────────────┘
```

The exact framework-specific directory layout should follow the existing repository architecture.

---

## 5. Core Domain Components

### 5.1 URL Parser

Responsibilities:

- validate Internet Archive URLs
- normalize URLs
- extract item identifier
- reject unsupported domains
- ignore irrelevant query/fragment components when safe

Input:

```text
https://archive.org/details/example
```

Output:

```text
example
```

The parser must be deterministic and independently testable.

---

### 5.2 Metadata Client

Responsibilities:

- communicate with Internet Archive metadata APIs
- retrieve item information
- retrieve file metadata
- normalize upstream responses into internal types
- handle upstream HTTP errors

It should not contain UI-specific logic.

---

### 5.3 File Discovery

Responsibilities:

- inspect metadata
- produce normalized file records
- identify downloadable/restricted files
- retain important upstream metadata

Conceptual model:

```ts
ArchiveFile {
  name
  format
  mimeType
  size
  md5
  mtime
  type
  downloadable
  restricted
}
```

The real type must follow the repository's contracts.

---

### 5.4 File Classifier

Classifies files into:

```text
video
audio
image
document
archive
other
```

Use reliable metadata first where available and file extension as a fallback.

---

### 5.5 Recommendation Engine

The recommendation engine calculates a score for each candidate.

Conceptual factors:

```text
primary media/document       + high score
recognized useful format     + positive score
metadata/support file        - high penalty
thumbnail                    - high penalty
checksum                     - high penalty
torrent                      - penalty
very small support file      - penalty
```

The exact scoring values are implementation details.

The result should be deterministic.

---

### 5.6 Download Service

Responsibilities:

- validate target
- establish upstream request
- stream response
- forward appropriate headers
- handle Range requests
- enforce timeout/concurrency rules
- expose structured download errors

It must never require the entire remote file to fit in memory.

---

### 5.7 Security Validator

Responsibilities:

- allowlist trusted hosts
- validate redirects
- prevent SSRF
- validate filenames
- prevent path traversal
- reject dangerous headers
- enforce request/resource limits

This should be centralized rather than duplicated across API routes.

---

## 6. Data Flow: Analysis

```text
1. User submits URL
        ↓
2. Server validates URL
        ↓
3. URL parser extracts identifier
        ↓
4. Metadata client requests item metadata
        ↓
5. File discovery normalizes files
        ↓
6. File classifier assigns categories
        ↓
7. Recommendation engine scores candidates
        ↓
8. API returns normalized result
        ↓
9. UI renders item and files
```

---

## 7. Data Flow: Download

```text
1. User selects file
        ↓
2. Server validates item/file relationship
        ↓
3. Server validates Internet Archive destination
        ↓
4. Download service requests upstream file
        ↓
5. Upstream response is validated
        ↓
6. Response headers are normalized
        ↓
7. Response body is streamed
        ↓
8. Browser receives download
```

The server must not trust a raw filename or URL supplied by the client.

The selected file should be resolved against previously retrieved/validated item metadata.

---

## 8. HTTP Range Architecture

When the client sends:

```http
Range: bytes=1000000-
```

the application should determine whether upstream Range requests are supported.

If supported:

```text
Client Range
     ↓
Download Service
     ↓
Internet Archive Range Request
     ↓
206 Partial Content
     ↓
Client
```

Relevant headers should be handled correctly.

If upstream does not support Range:

- do not fabricate `206`
- do not pretend resume is available
- return the appropriate behavior according to the application's download contract

---

## 9. Streaming Requirements

The system must use streaming APIs throughout the download path.

Avoid:

```text
Remote file
→ entire RAM buffer
→ response
```

Preferred:

```text
Remote stream
→ backend stream
→ client
```

Memory usage should remain approximately independent of file size.

Small internal buffers are acceptable.

---

## 10. Concurrency

Downloads must be bounded.

Conceptually:

```text
MAX_CONCURRENT_DOWNLOADS = 3
```

The value must be configurable.

A future queue may contain:

```text
queued
downloading
paused
completed
failed
cancelled
```

The first version does not need a persistent queue unless required by the existing architecture.

---

## 11. Retry Policy

Retries must be conservative.

Retry only failures that are plausibly transient, such as:

- connection reset
- temporary network failure
- selected 5xx responses

Do not blindly retry:

- 401
- 403
- restricted resources
- invalid identifiers
- 404
- malformed requests

Retries must have:

- maximum attempts
- backoff
- jitter where appropriate

Do not duplicate non-idempotent behavior.

---

## 12. Caching

Metadata may use short-lived caching.

Example:

```text
TTL = 10 minutes
```

Cache keys should include the normalized item identifier.

Do not cache restricted information beyond what is appropriate.

Do not use an unbounded cache.

Large media files should not be automatically persisted by the metadata cache.

---

## 13. File Selection and Validation

A client should not be allowed to download arbitrary:

```text
?url=https://...
```

Instead, the client should request a validated item/file combination.

Conceptually:

```text
item identifier
+
file identifier/name
        ↓
metadata lookup
        ↓
validated upstream file
        ↓
download
```

This prevents the download endpoint from becoming a generic proxy.

---

## 14. Filename Safety

Filenames received from Internet Archive must be treated as untrusted input.

Sanitize:

- path separators
- `..`
- control characters
- CR/LF
- invalid platform characters
- excessively long names

Do not execute or interpret filenames as shell commands.

Use safe `Content-Disposition` construction.

---

## 15. Error Model

The domain should expose structured errors.

Example:

```text
ArchiveError
├── InvalidUrl
├── UnsupportedUrl
├── InvalidIdentifier
├── ItemNotFound
├── MetadataUnavailable
├── FileNotFound
├── FileRestricted
├── AuthenticationRequired
├── UpstreamTimeout
├── UpstreamConnectionFailure
├── RangeUnsupported
├── DownloadInterrupted
└── DownloadFailed
```

The API layer maps these to appropriate HTTP responses.

The UI maps them to human-readable messages.

---

## 16. Suggested API Surface

The exact routes should follow the existing project conventions.

Conceptually:

```http
POST /api/archive/analyze
```

Analyze an item.

```http
GET /api/archive/download
```

Stream one validated file.

```http
POST /api/archive/download-selected
```

Optional endpoint for multi-file operations.

The API must validate all inputs.

---

## 17. UI Architecture

### Empty State

```text
Internet Archive Downloader

Paste an Internet Archive URL

[ URL input ]

[ Analyze ]
```

### Analysis State

```text
Analyzing Internet Archive item...
```

### Results

```text
Item title
Identifier

Recommended
────────────────────
PDF · 245 MB
[Download]

Other files
────────────────────
MP4 · 1.8 GB
[Download]

JPG · 2 MB
[Download]
```

### Download State

Show reliable progress data when available:

```text
1.2 GB / 4.8 GB
25%
8.4 MB/s
ETA 6:42
```

Never display fake progress.

---

## 18. Security Architecture

Security boundaries:

```text
Untrusted User Input
        ↓
Schema Validation
        ↓
URL Validation
        ↓
Host Allowlist
        ↓
Identifier/File Validation
        ↓
Upstream Request
```

Redirects must re-enter the validation boundary.

Never assume that a trusted initial URL makes every redirect trusted.

---

## 19. Testing Strategy

### Unit Tests

Pure logic:

- URL parser
- identifier extraction
- classifier
- recommendation scoring
- filename sanitizer
- security validators

### Service Tests

Mock upstream Internet Archive responses.

Test:

- valid metadata
- malformed metadata
- missing fields
- restricted files
- upstream errors

### Download Tests

Test:

- stream forwarding
- headers
- Range
- 206
- upstream failure
- timeout
- missing length

### Security Tests

Test malicious inputs explicitly.

### Integration Tests

Use a small set of real public Internet Archive items.

Keep live tests separate from deterministic unit tests.

---

## 20. Performance Requirements

The implementation should optimize for:

- streaming
- low memory usage
- bounded concurrency
- connection reuse where appropriate
- minimal metadata requests
- short-lived metadata caching

Success criteria for large files:

```text
File size increases
        ≠
Memory usage increases proportionally
```

The backend should not read an entire multi-GB file into memory.

---

## 21. Observability

Log structured events such as:

```text
archive.analysis.started
archive.analysis.completed
archive.analysis.failed
archive.download.started
archive.download.completed
archive.download.failed
archive.upstream.error
```

Useful fields:

- item identifier
- file name
- upstream status
- duration
- bytes transferred
- error category

Do not log:

- authorization headers
- secrets
- unnecessary response bodies
- sensitive user information

---

## 22. Future Extensions

The architecture should leave room for:

- persistent download queue
- pause/resume
- download history
- bandwidth limiting
- automatic retries
- ZIP streaming
- desktop/CLI client
- authenticated Internet Archive access through explicit user authorization
- multiple download workers

These are not required for the initial implementation unless explicitly requested.

---

## 23. Deployment Considerations

The deployment environment must support long-lived HTTP streams.

Review:

- reverse proxy timeouts
- maximum response duration
- request body limits
- connection limits
- container memory limits
- ephemeral disk limits
- outbound networking

Do not assume serverless execution is appropriate for arbitrarily large downloads.

If the selected deployment platform imposes hard streaming or execution limits, document them.

---

## 24. Verification Checklist

Before release:

- URL parsing verified
- metadata retrieval verified
- file discovery verified
- classification verified
- recommendation verified
- SSRF protection verified
- filename sanitization verified
- streaming verified
- Range behavior verified where supported
- restricted files handled
- large-file memory behavior reviewed
- concurrency bounded
- errors tested
- tests pass
- type checking passes
- lint passes
- documentation matches implementation

---

## 25. Design Principle

The application should be a reliable, secure, maintainable download service — not a scraper and not a generic proxy.

Prefer:

```text
Official metadata
+
Validated file selection
+
Secure upstream requests
+
Streaming
+
Correct HTTP semantics
```

over:

```text
HTML scraping
+
arbitrary URL fetching
+
full-file buffering
```

The implementation should remain simple enough to maintain while providing a substantially better download experience for legitimately downloadable Internet Archive files.
