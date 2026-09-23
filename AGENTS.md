# AGENTS.md

## 1. Project Overview

This repository contains a production-quality web application for downloading legitimately downloadable content from Internet Archive (`archive.org`).

The application accepts an Internet Archive URL, analyzes the referenced item, discovers available files, classifies them, recommends useful files, and streams selected files to the user's browser.

The application must respect Internet Archive access controls. It must never bypass DRM, authentication, borrowing restrictions, private-item restrictions, or other access controls.

---

## 2. Non-Negotiable Rules

1. Read this file and `design.md` before making architectural changes.
2. Inspect the existing repository before implementing anything.
3. Preserve existing project conventions and contracts.
4. Prefer official Internet Archive APIs/metadata endpoints over HTML scraping.
5. Never allow arbitrary user-supplied URLs to become backend fetch targets.
6. Downloads must be streamed; large files must not be fully buffered in memory.
7. Do not bypass Internet Archive restrictions.
8. Do not claim functionality is complete unless it has been implemented and verified.
9. Run the project's existing verification commands after changes.
10. Do not silently replace existing infrastructure, configuration, or contracts.

---

## 3. Source of Truth

When making changes, use this priority order:

1. Existing source-code contracts/types.
2. Existing project architecture and conventions.
3. `design.md`.
4. This file.
5. Feature-specific implementation requirements.

If two requirements conflict, stop and resolve the conflict explicitly rather than silently choosing one.

---

## 4. Required Workflow

Before implementation:

1. Inspect repository structure.
2. Read `AGENTS.md`.
3. Read `design.md`.
4. Identify framework/runtime/package manager.
5. Identify existing API, validation, logging, error, testing, and configuration conventions.
6. Identify existing domain/service boundaries.
7. Research current official Internet Archive behavior.
8. Produce a concise implementation plan.

Then implement incrementally.

After implementation:

1. Run type checking.
2. Run linting.
3. Run unit tests.
4. Run integration tests where available.
5. Run project-specific verification.
6. Review security-sensitive code.
7. Report actual results and known limitations.

---

## 5. Internet Archive Integration

Use official Internet Archive mechanisms wherever possible.

The application should support common Internet Archive item URLs such as:

- `/details/{identifier}`
- `/download/{identifier}/...`
- `/metadata/{identifier}`

Do not build the core system around scraping `/details/...` HTML.

The implementation must verify current behavior for:

- item metadata
- file lists
- formats
- MIME types
- file sizes
- checksums
- download URLs
- redirects
- HTTP Range support
- restricted/private files
- authentication requirements

If actual Internet Archive behavior differs from assumptions in the documentation, implement the verified behavior and update documentation.

---

## 6. Security Requirements

### SSRF

Only trusted Internet Archive hosts may be fetched.

Validate URLs server-side.

If redirects are followed, validate redirect destinations too.

Protect against:

- SSRF
- DNS rebinding
- path traversal
- malicious filenames
- header injection
- arbitrary local file access
- command injection
- resource exhaustion

### Restricted Content

Never attempt to bypass:

- DRM
- authentication
- borrow restrictions
- private items
- access controls
- undocumented protections

A restricted file should result in a clear application-level error.

---

## 7. Download Requirements

Downloads must use streaming.

Do not use full-file buffering patterns such as:

```ts
await response.arrayBuffer()
```

for potentially large files.

The desired flow is:

Internet Archive
    ↓
Upstream HTTP stream
    ↓
Backend download service
    ↓
Client HTTP stream
    ↓
User

Support HTTP Range requests when upstream behavior makes this possible.

Correctly handle relevant headers such as:

- `Content-Type`
- `Content-Length`
- `Content-Disposition`
- `Accept-Ranges`
- `Content-Range`
- `ETag`
- `Last-Modified`

Do not fabricate Range support.

---

## 8. File Classification

Files should be classified using reliable metadata and extensions where appropriate.

Supported high-level categories include:

- video
- audio
- image
- document
- archive
- other

The classification logic must be isolated and unit-tested.

---

## 9. Recommendation Engine

The application may recommend a primary file, but must not hide legitimate alternatives merely because they are not recommended.

Recommendation scoring should favor:

- primary user-facing media
- useful document formats
- useful media formats

and penalize or hide from the primary view:

- internal metadata
- checksums
- manifests
- thumbnails
- torrents
- other obvious support files

The scoring logic must be deterministic and testable.

---

## 10. API Rules

API handlers should remain thin.

Business logic belongs in domain/services.

Do not put metadata parsing, recommendation scoring, security validation, and download streaming logic directly into a single route handler.

Keep responsibilities separated into appropriate modules.

---

## 11. Error Handling

Use structured application errors.

Technical errors may be logged server-side, but raw stack traces must never be shown to users.

Expected categories include:

- invalid URL
- unsupported URL
- invalid identifier
- item not found
- metadata failure
- file discovery failure
- restricted file
- authentication required
- upstream timeout
- upstream connection failure
- range unsupported
- interrupted download
- download failure
- rate limiting

User-facing messages should be concise and actionable.

---

## 12. Configuration

Use the existing project configuration system.

Potential configuration values include:

- upstream request timeout
- metadata timeout
- download idle timeout
- maximum concurrent downloads
- metadata cache TTL
- redirect limit
- retry policy

Do not introduce a second configuration system.

---

## 13. Testing Requirements

Critical logic must have automated tests.

At minimum test:

### URL Parsing
- valid details URL
- valid download URL
- metadata URL
- query strings
- fragments
- invalid URLs
- unrelated domains

### Classification
- PDF
- EPUB
- MP4
- MKV
- JPG
- PNG
- MP3
- ZIP
- unknown files

### Recommendation
- mixed file sets
- metadata-heavy items
- multiple legitimate formats

### Security
- SSRF
- unauthorized redirects
- path traversal
- unsafe filenames
- header injection

### Download
- streaming
- upstream failure
- timeout
- Range
- partial content
- missing Content-Length

Most tests should use mocks/fixtures. Live Internet Archive tests should be limited and isolated.

---

## 14. Code Quality

Prefer:

- small focused modules
- explicit types
- schema validation at boundaries
- dependency injection where useful
- deterministic pure functions
- clear error types
- testable services

Avoid:

- giant route handlers
- hidden global state
- duplicated Archive.org logic
- arbitrary `any`
- unnecessary dependencies
- premature abstraction

---

## 15. Dependency Policy

Before adding a dependency:

1. Check whether the project already has equivalent functionality.
2. Prefer standard-library/runtime APIs when sufficient.
3. Prefer mature, actively maintained libraries.
4. Avoid dependencies that solve only trivial problems.
5. Explain significant new dependencies in the final report.

---

## 16. Documentation

Keep documentation synchronized with implementation.

If behavior changes, update `design.md` or the appropriate project documentation.

Document verified Internet Archive limitations rather than assumptions.

---

## 17. Definition of Done

A feature is not done until:

- implementation exists
- types compile
- relevant tests pass
- project verification passes
- security-sensitive paths have been reviewed
- documentation is updated where necessary
- known limitations are documented

Never mark a feature complete based solely on compilation.
