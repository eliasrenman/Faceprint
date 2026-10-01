# Implementation status

This file distinguishes executed checks from intended behavior as of 2026-10-01.

## Phase 0 — passed on the tested host

The packaged macOS arm64 app loaded the local OCCT WASM in its real WKWebView, imported the asymmetric STEP fixture, extracted a 100 × 50 mm planar face, called the real owner-fork Go library backed by static QPDF, and rendered the returned PDF with the matching local PDF.js worker. The automated result also compared the frontend bytes with the backend SHA-256 digest. The kernel replacement route was exercised by the final package script.

## Phase 1 — implemented; manual interaction coverage remains

Open/drop, centered Babylon view, orbit/pan/zoom/reset, per-face hover/picking, drag-versus-click suppression, planar feedback, and worker/GPU cleanup are implemented. The curved-cylinder fixture verifies kernel surface classification, but native UI pointer behavior has not been automated in WKWebView.

## Phase 2 — usable baseline; advanced geometry gate is incomplete

Output uses selected B-Rep wires rather than viewport triangles. Exact lines and adaptively sampled B-Rep curves target 0.005 mm curve deviation within a declared 0.01 mm total budget; open/unsupported boundaries fail instead of being silently closed. Inner loops and verified circular-hole centers are retained. Millimetre and inch-authored 100 × 50 mm fixtures normalize to the same dimensions, and a far translated/rotated fixture preserves placement.

Still unverified for release claims: an independent rounded-corner accuracy check, a planar spline fixture, reversed-face mirroring from both viewing sides, split-circle/seam edge cases, and assemblies/repeated instances. The current STEP path should therefore be described as a tested single-body planar-face baseline, not universal STEP support.

## Phase 3 — passed automated integration tests

The real tiler regression table passes for A4/A3/A2 portrait/landscape and independent template rotation. Auto orientation selects five A4 portrait pages for 900 × 297 mm. The 5 mm positive-margin case produces ten pages; options explicitly disable marks. Before tiling, the source canvas is padded to the resolved printable sheet grid so the selected face is centered by default; the setup panel also provides bounded X/Y movement relative to that center. Output page boxes are inspected in millimetres and no app-side production tiler exists.

## Phase 4 — implemented; native-dialog automation remains

The preview renders exact cached bytes with thumbnails, selection, and zoom. Generation is debounced and revisioned; Save is disabled for stale output. The backend keeps one bounded immutable copy and atomically saves it without regeneration. Cache/digest and atomic-write behavior have unit coverage. The actual macOS Save dialog, cancellation, failure presentation, and Unicode destination have not been UI-automated, though Unicode-safe path handling is used.

## Phase 5 — local package passed; distribution is not complete

`FacePrint.app` builds for macOS arm64, is self-contained with respect to QPDF/jpeg/zlib, uses local UI/WASM/PDF.js/font assets, passes the packaged test, and is ad-hoc signed. It was tested on macOS 26.6.2 arm64 only. A GitHub Actions job and MSYS2 packaging path are configured for a Windows amd64 build, but its first hosted run and a Windows packaged-WebView check remain to be recorded here. Clean-machine macOS 14.2 validation, physical print measurement, Developer ID signing/notarization, and installer work also remain. No claim is made for those items.

STL, direct printing, modeling, and assemblies are deferred by scope.
