# Changelog

All notable changes to Carino DICOM Editor. Versions follow [Semantic Versioning](https://semver.org/).
Licensed under **AGPL-3.0-or-later** (see [LICENSE](LICENSE)).

## [Unreleased]

### Changed
- `index.html` is split into `app.css` and plain classic scripts under `js/`
  (loaded in the original order, no build step). The code is moved verbatim,
  with one exception: `JPEG_LOSSLESS_MODULE` in `js/preview.js` is now
  `'../vendor/lossless-min.js'`, because `import()` in a classic script resolves
  against the script's own URL (`js/`), not the page's.
- Comments and docs that named `index.html` for code that moved now name the
  new file: `.github/workflows/desktop-build.yml` (packaged payload list, the
  `/releases/latest` fetch), `tests/gallery.html` (token block now in
  `app.css`), `fonts.css` (font stacks now in `app.css`), `desktop/main.js`
  and `desktop/preload.js`.

- `TAG_DICT` (836 hand-written tag entries) is replaced by `TAG_CATS` in
  `js/dictionary.js`: only the tags whose filter category the group rule gets
  wrong. Every tag keeps the category it had.
- Shared `$()` and `T()` helpers in `js/utils.js` replace 169
  `document.getElementById(` and 101 `(window.t||String)(` call sites.
- Repeated colours in `app.css` are tokens (`--bg`, `--field`, `--raised`,
  `--on-accent`, `--sev-*`). Text on gold hover fills moves from `#050505` to
  `#0a0a0a`, the value the other gold buttons already used.
- Comments trimmed to the why (standard references, security and ordering
  constraints); history lives in git. `tests/README.md` is cut to 118 lines.
- The long functions are split into named top-level helpers, same behaviour:
  `decodeDicomPixels()` and `decodeStoredFrames()` (one helper per transfer
  syntax / codec step), `renderTable()`, `validateDicom()` (one per check),
  `renderSelfTest()` and `handleFiles()`.
- Unused CSS is gone (the old Validator tab, compare-drop/stats, file tabs,
  `.social-btn`, `.pill.glow`), and static inline `style=""` attributes in
  `index.html` are classes in `app.css`. No visible change.

### Fixed
- Exporting an edited **Explicit VR Big Endian** file wrote its word-sized binary
  values (OW pixels and LUTs, OL, OF, OD) unswapped under a little-endian label,
  so 4095 came back as 65295. They are now swapped on a copy at export.
- Tag names and VRs now come from the PS3.6 dictionary. The old hand-written
  table overrode about 40 tags with the wrong name (e.g. (0018,9181) showed as
  "Gradient Output", (0008,1163) as "Dimension Organization UID") and gave no
  VR for its 836 tags when reading implicit-VR files. Names now use the
  standard wording ("Patient's Name", not "Patient Name").
- Input during page load is held back until every script has run
  (`js/gate.js`, released on `DOMContentLoaded`). Without it, a file dropped
  mid-load reached `handleFiles()` before its helpers existed and was lost.
- The **UID Pattern** Apply button rewrote standard `1.2.840.10008.*` UIDs too,
  so one click turned CT Image Storage into `9.9.840.10008…` and broke every
  file, and a UID outside the shared root kept only its last component, so
  different UIDs could merge. Standard UIDs are now left out of both the scan
  and the rewrite, only UIDs under the detected root move, a result over 64
  characters is refused, and Apply asks first ("Rewrite N UIDs in M files…?").
  The rewrite clears the undo history: Undo only restored the open file, so it
  left that one file on the old root and split the study.
- On a phone the page was wider than the screen (659px at 390px), and with the
  page itself not scrollable, Create, Info, Download and Search could not be
  reached. `.app` now has a `minmax(0, 1fr)` column, and at 700px or less the
  tabs move to a full-width second row of the header (below 380px with less
  padding, so all four fit down to 320px in every language).
- On Edit at phone width the tag table kept its 640px minimum, so every Value
  input sat past the right edge (419-647px at 390px) behind a sideways scroll,
  and the UID Pattern box pushed Apply off screen. Stacked (1000px or less), the
  UID box wraps, and from 360px up the table shrinks to fit in every language
  (Value about 92px wide at 390px, 62px at 360px). To make room, a long
  description can break mid-word ("Implementat/ion") until phones get stacked
  rows. Under 360px, and in compare, the 640px table stays and scrolls sideways
  to full-width Value fields.

## [1.0.0] — 2026-08-30

First tagged release. One static `index.html`, everything client-side.

### Added
- **Tag editing** — view, edit, create, compare and validate DICOM objects in
  the browser. Tag names and VRs come from a complete bundled PS3.6 data
  dictionary (5041 attributes plus 88 repeating-group masks), looked up in
  layers, so every attribute in the standard resolves rather than reading back
  as an unknown tag.
- **De-identification** — the PS3.15 Annex E Table E.1-1 Basic Profile, 618
  attributes generated from the machine-readable standard, with a UID remap kept
  consistent across the whole loaded set so internal references survive. Five
  optional profiles sit behind a button, all off by default, and each one
  records itself in `(0012,0063)` and `(0012,0064)`.
- **Burned-in pixel redaction** — identity printed into the image is not
  reachable by any tag edit, so it gets a full-screen workspace of its own that
  overwrites those samples in the stored pixel data.
- **Image edits** — rotate, flip and invert the **stored** pixels, so what comes
  out of Download opens the right way up in every other reader. Nothing is
  resampled: every operation is a permutation of whole samples. The Overview's
  own controls turn the picture on screen and change no file, which is why the
  two live under different labels.
- **Study viewing** — a dropped folder is a stack rather than a list, sorted by
  Series Number, then Instance Number, falling back to a natural sort on the
  filename for exports that number nothing.
- **Five samples**, forged in the browser through the ordinary load path — no
  patient ever existed and nothing is fetched — plus `#sample=` and `#case=`
  deep links that make every card in the reference gallery a one-click
  reproduction.
- **Desktop application** — an Electron shell that serves the whole tool from an
  internal `app://` origin, dcmjs and the dictionary and the WASM codecs
  included, so the app never asks the network for any part of itself.
- **Five languages** — English, Spanish, Brazilian Portuguese, Japanese and
  Russian, from one dictionary the parity checker keeps honest.
- **Nothing leaves the machine.** No upload, no server, no telemetry, no licence
  check. The desktop update notice is opt-in and downloads nothing.

### Verification

- The suites pass. Each is injected into a copy of the real `index.html` and run
  in headless Chromium against the real functions — no build step, nothing
  mocked. The oracle writes DICOM files byte by byte and computes what each one
  is supposed to look like from the samples it was built from rather than from
  the bytes, so a decoder that is self-consistently wrong still fails.
- **The builds are unsigned**, and no build has been launched from an installer
  on a machine that did not produce it. macOS ships one universal `.dmg`,
  Windows an x64 installer, and Linux an `.AppImage` for x86-64 and one for
  arm64; the arm64 build has never been started on arm64 hardware. What the
  workflow proves is that they packaged.
- Nothing in this release has been through a formal validation of any kind, and
  none of it is a medical device.
