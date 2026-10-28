# Third-party code bundled with the DICOM tag editor

Everything this editor needs is in this tree. It loads no script, style, font,
map or module from anywhere but its own origin — no CDN, no network, no account.
That is what lets the tool run on an air-gapped hospital network, and it is why
the licences of everything here travel with the files rather than living in a
lockfile somewhere.

**The rule for this directory is absolute:** no reference under `vendor/` may
resolve off-origin. Not a `<script src>`, not an `@import`, not a web font, not
a worker URL, not a source map. The one place an off-origin URL is *written* is
the tesseract.js bundles: three jsDelivr defaults that never resolve, because
`js/ocr.js` always overrides all three and `tests/realtime.py` fails any request
that leaves the origin (see "The off-origin rule, for these bundles
specifically" below). A grep for `https://` in those two files finds them;
that is expected.

The identical tree is bundled inside Carino DICOM, which serves this editor from
its dashboard; the two are kept byte-identical on purpose.

## What is here, and under what licence

| File | Package | Version | Licence | Text |
| --- | --- | --- | --- | --- |
| `dcmjs.min.js` | [dcmjs](https://github.com/dcmjs-org/dcmjs) | 0.29.8 | MIT | `LICENSE-dcmjs.txt` |
| `lossless-min.js` | [jpeg-lossless-decoder-js](https://github.com/rii-mango/JPEGLosslessDecoderJS) | 2.1.2 | MIT | `LICENSE-jpeg-lossless-decoder-js.txt` |
| `openjpegwasm_decode.js` | [@cornerstonejs/codec-openjpeg](https://github.com/cornerstonejs/codecs) | 1.3.0 | MIT | `LICENSE-codec-openjpeg.txt` |
| `openjpegwasm_decode.wasm` | [@cornerstonejs/codec-openjpeg](https://github.com/cornerstonejs/codecs) | 1.3.0 | MIT | `LICENSE-codec-openjpeg.txt` |
| `charlswasm_decode.js` | [@cornerstonejs/codec-charls](https://github.com/cornerstonejs/codecs) | 1.2.3 | MIT | `LICENSE-codec-charls.txt` |
| `charlswasm_decode.wasm` | [@cornerstonejs/codec-charls](https://github.com/cornerstonejs/codecs) | 1.2.3 | MIT | `LICENSE-codec-charls.txt` |
| `html2canvas.min.js` | [html2canvas](https://github.com/niklasvh/html2canvas) | 1.4.1 | MIT | `LICENSE-html2canvas.txt` |

The two `*wasm_decode.*` pairs are the JPEG 2000 and JPEG-LS decoders, loaded
lazily and only when a file of that transfer syntax is opened. The
**decode-only** builds are deliberate: the full builds carry encoders this
editor never calls, and cost 112 KB and 72 KB more of WebAssembly for nothing.
Do not rename the four files — `locateFile` is what resolves the `.wasm` beside
its loader, and keeping upstream's names is what keeps a refresh diffable.

`html2canvas.min.js` draws the printed reports (tag dump, Overview, Compare)
page by page, so `js/render.js` can write them into a PDF and download it
instead of opening the print dialog. Pages are pictures of the browser's own
layout, which is what keeps Japanese, Cyrillic and every patient-name script
right without shipping a font. It is the package's own `dist/html2canvas.min.js`,
unmodified, loaded only when a report is made. tslib's helpers are compiled into
it; their 0BSD notice is the second comment in the file and stays there.

Those MIT notices cover the emscripten wrappers only. The C libraries compiled
*into* the `.wasm` are separate works under separate terms, and shipping a
binary is exactly what triggers their notice clause:

| Compiled inside the `.wasm` | Licence | Text |
| --- | --- | --- |
| [OpenJPEG](https://github.com/uclouvain/openjpeg) (inside `openjpegwasm_decode.wasm`) | BSD 2-Clause | `LICENSE-openjpeg.txt` |
| [CharLS](https://github.com/team-charls/charls) (inside `charlswasm_decode.wasm`) | BSD 3-Clause | `LICENSE-charls.txt` |

`dcmjs.min.js` is the jsDelivr build of `dcmjs@0.29.8/build/dcmjs.js`, which is
a bundle: three of its dependencies are compiled into the file we ship, so their
licences travel with it and are reproduced here too.

| Bundled inside `dcmjs.min.js` | Licence | Text |
| --- | --- | --- |
| [pako](https://github.com/nodeca/pako) 2.0.4 | MIT (with zlib-licensed portions) | `LICENSE-pako.txt` |
| [loglevelnext](https://github.com/shellscape/loglevelnext) 3.x | MPL-2.0 | `LICENSE-loglevelnext.txt` |
| [core-js](https://github.com/zloirock/core-js) (via `@babel/runtime-corejs3`) | MIT | `LICENSE-core-js.txt` |

The one that needs a word of explanation is loglevelnext, because MPL-2.0 next
to AGPL-3.0 is the kind of pairing that looks wrong at a glance. It is fine, and
specifically: none of loglevelnext's source files carries the Exhibit B
"Incompatible With Secondary Licenses" notice, so MPL-2.0 §3.3 permits its
distribution as part of a Larger Work under a Secondary License, and the GNU
AGPL v3 is named as a Secondary License in §1.13. The MPL still governs those
files themselves, which is why the full text is here rather than summarised.

### OCR, for Find burned-in text

Everything under `tesseract/` is loaded only when someone presses **Find burned-in text** in
the redaction view (`js/ocr.js`), never at page load. Licence texts sit beside the files.

| File | Package | Version | Licence | Text |
| --- | --- | --- | --- | --- |
| `tesseract/tesseract.min.js`, `tesseract/worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) | 7.0.0 | Apache-2.0 | `tesseract/LICENSE-tesseract-js.txt` |
| `tesseract/tesseract-core-simd-lstm.js` + `.wasm` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 7.0.0 | Apache-2.0 | `tesseract/LICENSE-tesseract-js-core.txt` |
| `tesseract/tesseract-core-lstm.js` + `.wasm` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 7.0.0 | Apache-2.0 | `tesseract/LICENSE-tesseract-js-core.txt` |
| `tesseract/eng.traineddata.gz` | [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) `eng.traineddata`, last changed in commit `923915d4` (2017-09-14), fetched at `87416418` | 4.0.0 fast | Apache-2.0 | `tesseract/LICENSE-tessdata-fast.txt` |

The two bundles carry webpack's extracted notices for what they compile in
(regenerator-runtime and buffer, MIT; ieee754, BSD-3-Clause; zlib.js, MIT) in
`tesseract/tesseract.min.js.LICENSE.txt` and `tesseract/worker.min.js.LICENSE.txt`, the
files their first line points to. The `.wasm` files are the Tesseract engine (Apache-2.0,
`tesseract/LICENSE-tesseract.txt`) compiled together with the libraries below, each pinned
by tesseract.js-core v7.0.0 as a submodule. All of their notices are in
`tesseract/LICENSE-tesseract-core-libs.txt`, one section each, taken from the pinned commit:

| Compiled inside both `.wasm` | Licence |
| --- | --- |
| [Leptonica](https://github.com/DanBloomberg/leptonica) | BSD 2-Clause |
| [zlib](https://github.com/madler/zlib) | zlib |
| [libpng](https://github.com/glennrp/libpng) | libpng / PNG Reference Library licence |
| [libjpeg](https://github.com/LuaDist/libjpeg) (IJG 9a) | IJG |
| [libtiff](https://gitlab.com/libtiff/libtiff) | libtiff (BSD style) |
| [libwebp](https://github.com/webmproject/libwebp) | BSD 3-Clause |
| [giflib](https://github.com/mirrorer/giflib) | MIT |
| [OpenLibm](https://github.com/JuliaMath/openlibm) | MIT, BSD and ISC by file, some public domain (the LGPL test files are not built in) |

What was left out, and why, because each is the obvious thing to add back:

* **Two cores, not six.** Only the LSTM builds (the model is LSTM-only, OEM 1), with SIMD and
  without. The relaxed-SIMD build is dropped, so `js/ocr.js` chooses the core file itself:
  given a directory, the worker would pick relaxed SIMD in any current Chrome and request a
  file that is not here.
* **`.js` + `.wasm`, not upstream's single `.wasm.js`.** That one inlines the module as
  base64, about 1 MB more per core. The loader finds the `.wasm` beside itself.
* **tessdata_fast, not the 10.9 MB `best` model Carino Media ships.** 1.9 MB gzipped, and
  burned-in overlays are clean machine-drawn text. Gzipped with `gzip -9 -n` (no name, no
  timestamp), so a refresh is reproducible; the worker unzips it. No Spanish or Portuguese
  model: matching folds accents away on the tag side, so `Muñoz` still meets an English
  read of `MUNOZ`, and each extra model is about 2 MB.

**The off-origin rule, for these bundles specifically.** `tesseract.min.js` and
`worker.min.js` contain three jsDelivr URLs: the defaults for `workerPath`, `corePath` and
`langPath`. They are dead strings only while all three options are passed, which is why
`js/ocr.js` always passes all three (and `corePath` as a file, which skips the worker's own
lookup). Leave them unpatched, so a refresh stays a byte-for-byte copy of npm, and keep
the options. `tests/suites/ocr.js` runs under `tests/realtime.py`, which records every
request the page and the OCR worker make and fails if one leaves the origin. Both bundles
end in a relative `//# sourceMappingURL=`; the maps are not shipped, so that is a
same-origin 404 at worst. `cacheMethod: 'none'` keeps the model out of IndexedDB.

The self-hosted web fonts under `../fonts/` are SIL Open Font License 1.1 and
carry their licences beside them — `../fonts/LICENSE-IBMPlex.txt` (IBM Plex Sans
and IBM Plex Mono) and `../fonts/LICENSE-RedHat.txt` (Red Hat Text and Red Hat
Display). The OFL requires the licence to be distributed with the font files, so
those two files are not optional bookkeeping.

## Refreshing a bundle

Fetch the exact version, and take the licence in the same breath — the licence
going stale against the code is the failure mode this table exists to prevent:

    npm pack dcmjs@<version>
    tar xzf dcmjs-<version>.tgz
    cp package/License.txt LICENSE-dcmjs.txt

    npm pack @cornerstonejs/codec-openjpeg@<version>
    tar xzf cornerstonejs-codec-openjpeg-<version>.tgz
    cp package/dist/openjpegwasm_decode.js package/dist/openjpegwasm_decode.wasm .
    cp package/LICENSE LICENSE-codec-openjpeg.txt

    npm pack @cornerstonejs/codec-charls@<version>
    tar xzf cornerstonejs-codec-charls-<version>.tgz
    cp package/dist/charlswasm_decode.js package/dist/charlswasm_decode.wasm .
    cp package/LICENSE LICENSE-codec-charls.txt

    npm pack html2canvas@<version>
    tar xzf html2canvas-<version>.tgz
    cp package/dist/html2canvas.min.js .
    cp package/LICENSE LICENSE-html2canvas.txt

OCR, from the same tarballs and the same commits the tables above name:

    npm pack tesseract.js@<version>
    tar xzf tesseract.js-<version>.tgz
    cp package/dist/tesseract.min.js package/dist/tesseract.min.js.LICENSE.txt \
       package/dist/worker.min.js package/dist/worker.min.js.LICENSE.txt tesseract/
    cp package/LICENSE.md tesseract/LICENSE-tesseract-js.txt

    npm pack tesseract.js-core@<version>
    tar xzf tesseract.js-core-<version>.tgz
    cp package/tesseract-core-simd-lstm.js package/tesseract-core-simd-lstm.wasm \
       package/tesseract-core-lstm.js package/tesseract-core-lstm.wasm tesseract/
    cp package/LICENSE tesseract/LICENSE-tesseract-js-core.txt

    curl -LO https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata
    gzip -9 -n eng.traineddata && mv eng.traineddata.gz tesseract/
    curl -o tesseract/LICENSE-tessdata-fast.txt https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/LICENSE

For a new tesseract.js-core, rebuild `tesseract/LICENSE-tesseract-core-libs.txt` from the
`third_party/` submodule commits that tag pins (`gh api
repos/naptha/tesseract.js-core/contents/third_party?ref=v<version>`), and check that the
worker still accepts a `corePath` ending in `.js`.

The two BSD texts are not in those tarballs and have to be taken from upstream
in the same breath, or the binaries ship without the notice their licences
require:

    curl -o LICENSE-openjpeg.txt https://raw.githubusercontent.com/uclouvain/openjpeg/master/LICENSE
    curl -o LICENSE-charls.txt  https://raw.githubusercontent.com/team-charls/charls/master/LICENSE.md

One thing to know before touching how those two are loaded: **they are UMD
bundles, so `index.html` pulls them in with a `<script>` tag, not `import()`.**
Their export tail only fires for CommonJS or AMD, so a dynamic import resolves
to a namespace with zero keys — no error, no rejection, nothing to debug. Making
them match the `import()` two lines above, which is what the next person will
want to do, breaks JPEG 2000 and JPEG-LS silently.

Then re-read the new bundle for anything that points off-origin before shipping
it. Minifiers append a `//# sourceMappingURL=` comment, CDN builds sometimes
carry an absolute one, and a map URL is a real request the moment a browser has
devtools open. The maps we ship are named relatively or root-relatively, so they
resolve against whatever origin is serving the page and 404 there rather than
leaving the building; keep it that way.

## The copy inside Carino DICOM

Carino DICOM bundles this editor and serves it from its dashboard, so this tree
exists twice. Keep the two byte-identical: a divergence here is a divergence in
what a hospital is running.

That copy carries two things this one does not, and a careless `cp -r` in either
direction destroys them:

* **`pacs/web/editor/vendor/README.md`** — its own version of this file. PACS
  redistributes these bundles inside a shipped binary and a container image,
  which a static site users visit does not, and that is a different obligation
  written up in different words. Do not overwrite it with this one.
* **`pacs/web/editor/tests/pn-roundtrip.e2e.mjs`** — a Node check that a Person
  Name survives a load-and-save untouched. It exists because it once did not:
  `parseByVR` built the `{Alphabetic, Ideographic, Phonetic}` shape of a
  *naturalised* dcmjs dataset, while the raw dict this editor holds carries PN
  as a plain string in both directions in dcmjs 0.29.8, so the writer stringified
  the object to the literal `[object Object]` — on every PN tag, on a plain open
  and save with nothing edited. `parseByVR` follows the shape the element is
  already in now, and `tests/suites/edits.js` asserts it here. Run the PACS suite
  after any dcmjs bump anyway: the read and write shapes are not symmetric, and a
  version that starts returning objects from `readBytes` would need that branch
  to change again.
