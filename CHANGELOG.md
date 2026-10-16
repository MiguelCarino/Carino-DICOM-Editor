# Changelog

All notable changes to Carino DICOM Editor. Versions follow [Semantic Versioning](https://semver.org/).
Licensed under **AGPL-3.0-or-later** (see [LICENSE](LICENSE)).

## [Unreleased]

### Added
- **Create → Eye photo**, for fundus, slit-lamp and external eye pictures that a camera saved
  as JPEG or PNG. Writes Ophthalmic Photography 8 Bit Image Storage
  (`1.2.840.10008.5.1.4.1.1.77.1.5.1`, Modality `OP`, PS3.3 A.41) with the Ophthalmic Photography
  Image, Ocular Region Imaged, Acquisition Parameters, Photographic Parameters, Synchronization
  and Multi-frame modules. Each thumbnail gets a Right / Left / Both picker for Image Laterality
  `(0020,0062)`, filled from the file name (OD/OS/OU, OI, OE, right/left, derecho/izquierdo) and
  required before anything is written. A baseline JPEG goes in without re-encoding as JPEG
  Baseline with `YBR_FULL_422`, Lossy Image Compression `01`, its ratio and `ISO_10918_1`; its
  EXIF/XMP, other APPn segments, comments and anything after EOI are left out of the fragment
  (they can hold GPS, owner, serial or a preview, out of reach of de-identification). Other JPEGs
  (progressive, RGB-coded, EXIF-rotated) and PNG are stored decoded as RGB. Device and region are
  CID 4202 / CID 4209 codes. A fundus camera needs its field of view, from which the nominal
  Pixel Spacing is written. EXIF capture time becomes Acquisition DateTime. No optic-disc
  laterality guess: it could not be checked against real photos.
- **Create can be opened with an order** from a worklist: `#create=eye&patient_id=…` or a
  `*.carino-create.json` file over the Carino Bridge, with the keys Carino DICOM's orders use
  (format in `js/create.js` and the README). `study_uid` makes the files join that study, and
  `procedure_id` / `sps_id` fill the Request Attributes Sequence (Requested Procedure ID falls
  back to the SPS ID, as the worklist does). Only the hash is read, never a query string, and it
  is cleared once read. While an order is attached the patient's name and ID are locked;
  Anonymize and Randomize drop the order with its accession and referring physician.
- **Create sends the files back to the worklist** that opened it, when its bridge order carries
  a `reply` token: the button becomes **⬆ Create and send back**, the files are posted to that
  page (`window.opener`, at the origin the bridge delivered from) instead of downloaded, and its
  answer is shown. A refusal is said beside the button and can be retried; if the worklist
  window has been closed, the files are downloaded as before.
- Create writes Accession Number and Referring Physician's Name (both Type 2), with new fields
  for both.
- The validator knows Ophthalmic Photography 8 Bit: its Type 1/2 attributes, and Image
  Laterality R, L or B only (a missing or `U` laterality is an error). A sequence with items now
  counts as having a value.
- Covered by `tests/suites/eyephoto.js`, also in `#selftest`.
- **Find burned-in text**, in the redaction view. Reads every frame of the file with OCR on
  this machine (Tesseract.js 7.0.0 and the tessdata_fast English model, vendored in
  `vendor/tesseract/` and loaded only when the button is pressed; nothing is uploaded, and
  no request leaves the page's origin). Each frame is read twice, its brightest pixels alone
  (consoles burn text at full white) and as shown, after upscaling small frames up to 3x. Words that match the
  file's own identifying attributes (Patient Name, Patient ID, Other Patient IDs and the
  Other Patient IDs Sequence, Birth Date, Patient's Age, Accession Number, Study ID,
  Institution Name, Station Name, Referring, Performing and Record physicians, Operators'
  Name, and the study, series, acquisition and content dates and times; PS3.15 Table E.1-1)
  are proposed and selected. Matching folds case, accents, separators and the common OCR
  confusions, knows day-first, month-first, two-digit-year and month-name dates, finds a
  value run into its label (`PT:DOE`, `ID:A12`), and lets values of 7+ characters differ by
  one character. Other text
  (measurements, markers, scales) is outlined and left unselected. Overlapping reads and
  neighbouring words are merged and padded. A click switches a box; Stop cancels the run.
  A frame that cannot be decoded is named in the result ("check them yourself"), and a file
  with no decodable frame is an error rather than "No text found". With proposals on screen
  but none selected, Apply says to click a yellow box instead of to draw one.
  Apply is the existing redaction, with its retagging and undo. The copy says it runs on
  this device and can miss text, and says when a file is already de-identified (Patient
  Identity Removed = YES), since its tags then hold nothing to match.
- **Size.** `vendor/` grows by 8.1 MB (1.7 MB to 9.8 MB) on disk and in the desktop app's
  `resources/web/`; about +4.2 MB gzip-compressed or +2.9 MB xz-compressed in an installer.
  A first Find downloads about 3.1 MB (engine and model, gzip on the wire).
- `tests/suites/ocr.js`, not in `#selftest` (it would download the engine). It runs on the
  real clock through the new `tests/realtime.py`, which `run.sh` uses for any suite marked
  `@realtime`: the virtual-time budget does not wait for a Web Worker.

### Fixed
- **AppImage dock icon on GNOME Wayland.** GNOME on Wayland takes the dock icon only
  from a `.desktop` file named after the window's app ID, and an AppImage run from
  Downloads installed none. On each start the AppImage now writes
  `~/.local/share/applications/carino-dicom-editor.desktop` and its icon (marked
  `X-Carino-AppImage=true`; `TryExec` hides it once the AppImage is gone). It never
  touches an entry of your own, and removes its own once the .deb/.rpm is installed.

## [1.0.2] — 2026-10-11

The first published release; neither 1.0.0 nor 1.0.1 published one. The 1.0.1
build failed because the Linux .deb and .rpm kept electron-builder's default names,
which the release manifest refused. Linux now names every package
`${productName}-${version}-${arch}`.

### Added
- **⇄ Swap patients** (Edit tab), for images filed under the wrong patient. With exactly
  two studies loaded, every file of each study takes the other study's whole Patient
  Module (group 0010); a tag only one patient had leaves with that patient. Study,
  series, equipment and pixel data stay put. Accession Number is opt-in. New UIDs are on
  by default (through `remapUIDs()`), because a PACS that hides rather than deletes would
  otherwise merge the re-upload into the old study. The dialog previews both sides and
  warns, without blocking, when both studies already share a Patient ID or one study mixes
  IDs. Edits typed into the table are folded in first instead of being dropped. Undo
  history is cleared, as for the UID prefix rewrite. Covered by `tests/suites/swap.js`.

### Changed
- **Create → Modality offers every code in the standard**: all 79 Defined Terms of
  Modality (0008,0060) from PS3.3 C.7.3.1.1.1, written code first (`US - Ultrasound`).
  `SC` is gone: it is not a Modality value, and a Secondary Capture object uses `OT`,
  which stays the default.
- The **Extract** tab now starts from the open study instead of an empty list, so
  **⤓ Extract image** on the Overview no longer lands on nothing. It reads the study
  fresh on every visit, through the same merge the download uses, so a redacted banner
  stays redacted and a saved window or photometric fix reaches the PNG. Files dropped
  onto Extract are added beside the study (dashed border, since the study's edits do not
  reach them); **Clear added files** removes only those.
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
- **Desktop app icon on Linux docks and the Windows taskbar.** The window called itself
  `Carino DICOM Editor` while the launcher expected `Carino-DICOM-Editor`, so GNOME/KDE
  docks showed a generic icon. `StartupWMClass` now repeats the window's class (X11)
  and `desktopName` sets its app ID to `carino-dicom-editor` (Wayland). On Windows the window now claims the
  installer's AppUserModelID, so it groups with its pinned shortcut. CI fails any build
  whose packages lack the icon or whose names disagree.
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
- Dropping or opening a file that is not DICOM (a stray JPEG, say) wiped the
  open study, its edits and the undo history before anything was parsed, and
  on Overview nothing said why. Files are now parsed first and the study is
  replaced only if at least one of them loads. Failures still go to the Edit
  banner and now also to a toast on whichever tab is open; an image is named as
  one and pointed at Create. `handleFiles()` returns how many files it loaded,
  which the PACS hand-off now counts instead of `files.length`.
- Opening a second file (to compare it, say) silently threw away the first
  one's edits. Open still means replace, but every way in from the UI (Open,
  the file and folder pickers, a drop anywhere) now asks first when there is
  unexported work: an edit, undo history, or a working copy that differs from
  its file. Closing or reloading the tab asks too (not in the desktop app,
  where Electron would cancel the close without a prompt).
- While comparing, the other file's picture was a full-width square under the
  preview: at 1280x720 it ran over Load Files and squeezed this file's picture
  to 140px. The two now sit side by side in the Preview card, each under its
  file name and square; a window too short for both scrolls the sidebar.
- **Randomize All** read like de-identification ("replaces identifying tags")
  but changes only the patient block, the study dates and two IDs; institution,
  device, physician, private tags and burned-in text stay. It is now **Fake
  patient (test data)**, and its confirm says it is NOT de-identification and
  what it keeps, with a **Make fake patient** button. **Anonymize All** is **Anonymize (PS3.15)**, and its confirm
  says UIDs are kept when Retain UIDs is ticked. Both buttons have titles, both
  confirms and toasts are translated, ⚙ reads "⚙ Options · 2" while two options
  are ticked, and the options panel is a grid.
- In Spanish, Portuguese, Japanese or Russian, some confirms still asked in
  English, among them both compare **Copy all** overwrites, so the reader approved
  an irreversible change they might not have read. Every confirm and toast now
  goes through the translation (including the PACS hand-off and **+ Tag**), the
  file and image counts read "Files: 3" / "Images: 3" so no locale needs an
  English plural, and the Create and Extract count pills are translated too.

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
