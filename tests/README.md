# Tests

```sh
./tests/run.sh                  # every suite in tests/suites/
./tests/run.sh pixels redact    # named suites only
CHROME=google-chrome ./tests/run.sh
```

Needs `python3` and a headless Chromium (`chromium-browser` by default; override
with `CHROME=...`). `PORT` (default 8734) and `BUDGET` (virtual-time budget in ms,
default 60000) can also be overridden. No npm, no build step.

`run.sh` serves the repo over a throwaway `python3 -m http.server` (not `file://`,
which hides script errors and blocks dcmjs), injects `tests/dicom-forge.js` plus
one suite into a copy of `index.html` (`.testrun.html` in the repo root, so
relative paths to `vendor/`, `app.css` and `js/*.js` still resolve), dumps the DOM
and reads back the `PASS ::` / `FAIL ::` lines. A suite that reports nothing is
shown with the first boot error, if any. Exit status is non-zero on any failure.

## Fixtures and the oracle

There are no recorded `.dcm` files. `tests/dicom-forge.js` builds real Part-10
byte streams in the browser at run time (preamble, file meta, dataset,
encapsulated fragments) and hands them to the app through
`DicomMessage.readFile`, the same entry point as a dropped file. It includes its
own PackBits/RLE and JPEG Lossless encoders.

Each case also carries a **reference image computed independently from the same
sample values** (the forge's own windowing, rescale and photometric
interpretation). A case passes only when the app's decoder agrees with that
reference, so a decoder that is wrong in a self-consistent way still fails.

Exception: JPEG 2000 and JPEG-LS have no browser encoder, so five codestreams are
embedded in `dicom-forge.js` as base64 and regenerated out of band by
`tests/fixtures/make-codec-fixtures.mjs` (needs npm + network; `run.sh` never
runs it). They are encoded by the same OpenJPEG/CharLS code that decodes them, so
a symmetric codec bug would cancel out; what they still catch is the wiring
(interleave, byte order, bit depth, sign, planar config, photometric, frame
offsets), because the reference image is still computed from first principles.

The corpus covers 8/12/16-bit greyscale (signed and unsigned), MONOCHROME1,
Hounsfield/PET rescale, missing window, RGB (both planar configs), YBR_FULL,
YBR_FULL_422, PALETTE COLOR, multi-frame, Implicit VR LE, Explicit VR BE,
baseline JPEG, JPEG Lossless, RLE, JPEG 2000, JPEG-LS, split fragments, and
deliberately malformed or unsupported files (truncated, MPEG-2, HTJ2K, ...).

`tests/gallery.html` draws the corpus with its reference images. Each card can
download the `.dcm` or open it in the app via `#case=<id>`, so a bad rendering is
a shareable URL.

**The forge is also a product dependency.** The empty state's *Load a sample*
buttons load `Forge.samples()` from this directory (`#sample=<id>` links too), so
`tests/` must not be pruned from a deployment, and `Forge.samples()` must stay
byte-for-byte deterministic (fixed UIDs, no `Math.random`).

## Suites

| Suite | Covers |
| --- | --- |
| `boot` | Library scripts (`vendor/dcmjs.min.js`, `deid-profile.js`, `dicom-dictionary.js`) sit below the page markup (not in `<head>`), without `defer`, before `js/dictionary.js`. |
| `loading` | `handleFiles` read-ahead: bounded by count and bytes, order and per-file failure handling unchanged. A load where nothing parses keeps the open study, edits and undo history, toasts on any tab and points images at Create; the return value is the parsed count. |
| `folder` | Folder/study drops: `DICM` sniff, entry-tree walk, `DataTransfer` snapshot, drop routing, `loadStudy` filtering (DICOMDIR, junk, large-folder prompt). Opening over unsaved work: drops and the file picker ask first, the card drop asks once, `beforeunload` holds only a dirty page, `handleFiles` never asks. |
| `pixels` | `decodeDicomPixels()` alone: greyscale via `rawFloats` min/max, colour pixel for pixel. |
| `viewer` | Rendered canvases (Overview `renderOverview`, editor `drawPreview`) against the reference and each other. |
| `render` | Tag-table rebuilds: debounced search, synchronous `renderTable`, UID-prefix scan only when data changes; UID Pattern Apply asks first, never rewrites standard `1.2.840.10008.*` UIDs and leaves no undo step that would split the study. |
| `phone` | 390x844 in an iframe: `.app` no wider than the screen; tabs and Info on screen on every tab, Download and Search on Edit; tabs on their own row. Create not clipped in ru (longest labels) at 320, 660 and 701px. Edit at 390/360px (and 360 ru, 390 ja): every Value input on screen, Description at least 78px; at 320px the 640px table stays, Value at least 80px; compare keeps its 640px table; Redact, Open files/folder and UID Apply on screen down to 320px. |
| `sequences` | Tag table as a tree: open, search, filter, export and edit nested elements, addressed by path. |
| `series` | Series/instance sort order, wheel paging that keeps W/L and zoom, cine, out-of-order decode guard. |
| `edits` | Per-file working copies; exports carry each file's own identity; saving does not mutate the loaded dataset. |
| `imgedit` | Rotate/flip written to stored pixels: exact permutation plus correct geometry tags. |
| `compare` | Side-by-side comparison as a second column of the editor table. |
| `deid` | PS3.15 optional profiles via the real Anonymize button; `(0012,0064)` codes and multi-valued `(0012,0063)`. |
| `redact` | Burned-in pixel redaction per photometric/codec, in memory and in the exported file; screen-to-image mapping; codec refusals. |
| `samples` | Demo samples decode to their references, are deterministic, and pass the Conformance card cleanly. |
| `zip` | Download All / Extract produce one ZIP holding every file, checked by an independent reader; 32-bit limits refused. |
| `selftest` | The `#selftest` report's summariser, attribution and suite list (does not run the other suites). |

## In-browser self-test

`index.html#selftest` loads every suite into the live page (setting
`window.SELFTEST` first so none self-starts), runs them, and shows a per-encoding
support report for that browser. It must live in the app page (`js/selftest.js`)
because suites reach app globals like `DicomMessage` and `files` that are
`const` bindings visible only to classic scripts on the same page.

A browser cannot list a directory, so **`SELFTEST_SUITES` in `js/selftest.js`
must name every file in `tests/suites/` except `selftest` itself.** The
`selftest` suite checks this whenever the server exposes a directory index (as
`run.sh`'s does).

## Adding a suite

1. Create `tests/suites/<name>.js`; `run.sh` picks it up automatically:

   ```js
   // One comment block saying what this suite holds in place and what its oracle is.
   (window.SUITES || (window.SUITES = {})).<name> = async () => {
     const out = [];
     const ok = (name, cond, extra) =>
       out.push(`${cond ? 'PASS' : 'FAIL'} :: ${name}${extra ? ' :: ' + extra : ''}`);
     // ... build cases with Forge, drive the app, call ok(...)
     return out;
   };
   ```

   End it with the same standalone fallback the existing suites use (copy it
   from one of them): when `!window.SELFTEST`, run on `load` and write the lines
   into `<pre id="TESTOUT">`, which is what `run.sh` scrapes.
2. Add `<name>` to `SELFTEST_SUITES` in `js/selftest.js` (order there is
   parse → decode → display → edit → export).
3. Rules:
   - **Leave the app as you found it** (search box, stubbed globals, dialogs).
     `run.sh` gives each suite a fresh page; `#selftest` runs them all in one.
   - **Name assertions `<case id>: what it checks`**; the self-test report uses
     that prefix to attribute failures to a file and transfer syntax.
   - **Compare UI text through `t()`**, never against English literals; visitors
     run `#selftest` in other languages.
   - Check against the forge's reference or hand-worked values, never against
     the app's own output.
