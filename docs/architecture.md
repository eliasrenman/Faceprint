# Architecture

FacePrint is split into four testable boundaries:

1. `frontend/src/cad/worker.ts` owns the single OCCT WASM kernel and all B-Rep handles. It assigns session-local model/face IDs, transfers independent face meshes to Babylon for picking, rejects non-planar selections, walks the selected face's outer and inner wires, and emits double-precision `Face2D` millimetre data. Screen triangles never enter print output.
2. `frontend/src/pdf/template-layout.ts` resolves the paper orientation and pads the source canvas to whole printable sheets. The face is centered across that sheet grid by default, with bounded X/Y offsets that cannot move it outside the canvas. `frontend/src/pdf/source-pdf.ts` then converts `Face2D` into that vector PDF at exactly `72 / 25.4` points per millimetre. It sets all page boxes, rotation zero, 0.15 mm strokes, and `PrintScaling=None`.
3. `internal/tiling` is the only package importing `pdftilecut`. It validates app options, writes explicit margin units, disables marks, and serializes native calls. `internal/pdfinfo` independently measures the returned page count and physical boxes.
4. The Wails `App` service validates bridge sizes, retains one immutable tiled PDF in a bounded cache, and saves that exact cached copy atomically after a native dialog. PDF.js renders the bytes and digest returned by the cache.

Opening another model invalidates selection and preview state. The CAD worker releases its prior kernel objects; Babylon disposes prior scene meshes; frontend revision counters prevent an older tiling completion from becoming saveable after settings change. A native call already in progress cannot be interrupted, but its stale result is ignored.

Normal runtime data remains local. The app has no remote navigation, telemetry, accounts, upload path, or CDN assets. Limits are 100 MiB per STEP input, 64 MiB per PDF payload/output, 500 output pages, 5,000 faces, and 250,000 boundary points.
