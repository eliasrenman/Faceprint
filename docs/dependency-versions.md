# Dependency versions

Versions used by the tested package on 2026-10-01:

| Component | Version or revision | Role |
|---|---|---|
| Wails | 2.16.0 | desktop shell and bindings |
| Go | 1.26.8 | application toolchain |
| Svelte | 5.57.1 | UI |
| Vite | 7.3.6 | frontend build |
| TypeScript | 5.9.3 | frontend type checking |
| Babylon.js core | 9.29.0 | viewport |
| occt-wasm | 5.4.1, tag commit `4b9d475efbece9ad3e925c3cdd7e21fde86dff54` | STEP/B-Rep kernel wrapper |
| OCCT inside WASM | fork commit `c7f60ffe85f28c67358d1771454044f0521f2fdd` (OCCT 8.0.1) | geometry kernel |
| bundled OCCT WASM SHA-256 | `214a7e20e960c243be6fb9f3a271df9e87cc804e54688fa2aa0c3f9ce6986c53` | release asset identity |
| pdf-lib | 1.17.1 | source vector PDF |
| PDF.js (`pdfjs-dist`) | 6.3.289 | actual-output preview |
| pdftilecut owner fork | `5f288f69661cbf13e5a4db859ca265b80498b8d0` | physical tiling |
| pdfcpu | 0.16.0 | output page-box inspection |
| QPDF | 9.0.2 | statically linked tiler dependency |
| zlib | 1.2.11 | statically linked tiler dependency |
| libjpeg-turbo | 2.0.3 | statically linked tiler dependency |

`package-lock.json`, `go.sum`, and `go.work.sum` lock the complete resolved graphs. `go.mod` replaces the canonical pdftilecut module with the exact owner-fork pseudo-version; `go.work` selects the sibling checkout for native-source builds. With `GOWORK=off`, Go resolves the exact fork revision, but the upstream module archive does not currently include its native submodule headers/archives, so release packaging intentionally uses the checked-out source and the platform-specific native dependency scripts.

The tested host was macOS 26.6.2 arm64 with Xcode 26.2, Node 22.15.0, and npm 10.9.4. The produced app was 45 MiB before adding documentation assets. Its executable linked only Apple system libraries/frameworks; QPDF, zlib, and JPEG were static.
