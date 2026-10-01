# Replacing the OCCT kernel

The default OCCT module is bundled locally with the signed application and is never downloaded. FacePrint also checks one deliberate, user-controlled override path at startup:

```text
~/Library/Application Support/FacePrint/kernel/occt-wasm.wasm
```

Create the `kernel` directory and place the replacement under that exact filename, then restart FacePrint. Removing the file restores the bundled module. FacePrint rejects non-regular, empty, or larger-than-64-MiB overrides; it never accepts a kernel path from a model or remote content and never overwrites the user's file.

Compatibility requires the WASM ABI expected by the JavaScript wrapper from `occt-wasm` 5.4.1. The corresponding source/build materials are tag `v5.4.1` at <https://github.com/andymai/occt-wasm/tree/v5.4.1>, commit `4b9d475efbece9ad3e925c3cdd7e21fde86dff54`. Its OCCT submodule is <https://github.com/andymai/OCCT/tree/c7f60ffe85f28c67358d1771454044f0521f2fdd>. That tag documents both the Rust/emsdk build and Docker build (`npm run docker:dist`). Use the tag's complete recursive source checkout; swapping an arbitrary OCCT build without its matching facade exports is not ABI-compatible.

The packaged release test injects the pinned module through this override service, imports STEP, verifies a 100 mm dimension, tiles the result, and renders it with PDF.js. `resources/licenses/OCCT-LGPL-2.1.txt` contains the applicable compiled-WASM license text. This documentation and replacement mechanism support compliance work but are not legal advice.
