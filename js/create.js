// Create DICOM tab: build DICOM files from images, grouped into series, or eye photos as
// Ophthalmic Photography (see "Eye photos" below).
// ---- Create DICOM ----
let createImages = [];

const SERIES_COLORS = ['#a78bfa','#22d3ee','#f472b6','#fb923c','#4ade80','#facc15','#f87171','#94a3b8'];
let createSeries = [{ id: 1, description: '', color: SERIES_COLORS[0] }];
let nextSeriesId = 2;

const createAddBtn   = $('createAddBtn');
const createSideAddBtn = $('createSideAddBtn');
const createFileInput  = $('createFileInput');
const createImgWrap  = $('createImgWrap');
const createImgGrid  = $('createImgGrid');
const createImgCount = $('createImgCount');
const clearCreateBtn = $('clearCreateBtn');
const createSideDropZone = $('createSideDropZone');
const createDicomBtn = $('createDicomBtn');

(function() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  $('cdStudyDate').value = iso;
})();

function addCreateImages(files) {
  const exts = /\.(png|jpe?g|bmp|gif|webp|tiff?)$/i;
  for (const f of files) {
    if (!f.type.startsWith('image/') && !exts.test(f.name)) continue;
    createImages.push({ file: f, objectURL: URL.createObjectURL(f), series: createSeries[0].id, eye: eyeFromFilename(f.name) });
  }
  renderCreateGrid();
}

function removeCreateImage(idx) {
  URL.revokeObjectURL(createImages[idx].objectURL);
  createImages.splice(idx, 1);
  renderCreateGrid();
}

function seriesColor(id) {
  const s = createSeries.find(s => s.id === id);
  return s ? s.color : '#94a3b8';
}

function renderSeriesPanel() {
  const container = $('seriesList');
  if (!container) return;
  container.innerHTML = '';
  createSeries.forEach(s => {
    const row = document.createElement('div');
    row.className = 'series-item';

    const dot = document.createElement('span');
    dot.className = 'series-dot';
    dot.style.background = s.color;

    const label = document.createElement('span');
    label.className = 'series-label';
    label.textContent = `S${s.id}`;

    const input = document.createElement('input');
    input.className = 'form-input';
    input.style.cssText = 'flex:1;font-size:12px;padding:5px 8px';
    input.placeholder = T('Description');
    input.value = s.description;
    input.addEventListener('input', () => { s.description = input.value; });

    row.appendChild(dot);
    row.appendChild(label);
    row.appendChild(input);

    if (createSeries.length > 1) {
      const rm = document.createElement('button');
      rm.className = 'series-rm-btn';
      rm.title = 'Remove series';
      rm.textContent = '✕';
      rm.addEventListener('click', () => removeSeries(s.id));
      row.appendChild(rm);
    }

    container.appendChild(row);
  });
}

function addSeries() {
  const color = SERIES_COLORS[createSeries.length % SERIES_COLORS.length];
  createSeries.push({ id: nextSeriesId++, description: '', color });
  renderSeriesPanel();
  renderCreateGrid();
}

function removeSeries(id) {
  if (createSeries.length <= 1) return;
  createSeries = createSeries.filter(s => s.id !== id);
  const fallbackId = createSeries[0].id;
  createImages.forEach(img => { if (img.series === id) img.series = fallbackId; });
  renderSeriesPanel();
  renderCreateGrid();
}

function renderCreateGrid() {
  setCountPill(createImgCount, createImages.length);
  if (!createImages.length) {
    createImgGrid.innerHTML = `
      <div class="img-empty">
        <div class="img-empty-icon">🖼</div>
        <span>${T('Drop images here or click "+ Add Images"')}</span>
        <span class="img-empty-hint">${T('PNG · JPEG · BMP · WebP supported')}</span>
      </div>`;
    return;
  }
  createImgGrid.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'img-grid';
  createImages.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'img-thumb';

    const image = document.createElement('img');
    image.src = img.objectURL;
    image.alt = img.file.name;

    const info = document.createElement('div');
    info.className = 'img-thumb-info';
    info.textContent = img.file.name;

    const rmBtn = document.createElement('button');
    rmBtn.className = 'img-thumb-remove';
    rmBtn.title = 'Remove';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', e => { e.stopPropagation(); removeCreateImage(i); });

    const sel = document.createElement('select');
    sel.className = 'img-thumb-series';
    sel.title = 'Assign series';
    sel.style.background = seriesColor(img.series) + 'cc';
    createSeries.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `S${s.id}`;
      if (img.series === s.id) opt.selected = true;
      sel.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = 'new';
    newOpt.textContent = T('+ New');
    sel.appendChild(newOpt);

    sel.addEventListener('change', () => {
      if (sel.value === 'new') {
        addSeries();
        createImages[i].series = createSeries[createSeries.length - 1].id;
      } else {
        createImages[i].series = parseInt(sel.value);
      }
      renderCreateGrid();
    });

    div.appendChild(image);
    div.appendChild(info);
    div.appendChild(rmBtn);
    div.appendChild(sel);
    if (createKind === 'eye') div.appendChild(eyeSelectFor(img));
    grid.appendChild(div);
  });
  createImgGrid.appendChild(grid);
}

createAddBtn.addEventListener('click', () => createFileInput.click());
createSideAddBtn.addEventListener('click', () => createFileInput.click());
createSideDropZone.addEventListener('click', () => createFileInput.click());
createFileInput.addEventListener('change', e => {
  if (e.target.files?.length) addCreateImages(Array.from(e.target.files));
  e.target.value = '';
});
clearCreateBtn.addEventListener('click', () => {
  createImages.forEach(img => URL.revokeObjectURL(img.objectURL));
  createImages = [];
  createSeries = [{ id: 1, description: '', color: SERIES_COLORS[0] }];
  nextSeriesId = 2;
  renderCreateGrid();
  renderSeriesPanel();
  toast?.('Cleared all images');
});

createSideDropZone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
createSideDropZone.addEventListener('drop', e => {
  e.preventDefault();
  e.stopPropagation();
  // Folders work too; addCreateImages filters out non-image files.
  collectDropped(e.dataTransfer)?.then(r => addCreateImages(r.items.map(it => it.file)));
});

// Decode any browser-readable picture to interleaved 8-bit RGB (Planar Configuration 0).
async function imageToRGB(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width  = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const rows = canvas.height;
  const cols = canvas.width;
  const rgba = ctx.getImageData(0, 0, cols, rows).data;

  // DICOM OB values must be even-length; pad with a null byte if needed.
  const pixBytes = rows * cols * 3;
  const rgb = new Uint8Array(pixBytes % 2 === 0 ? pixBytes : pixBytes + 1);
  for (let i = 0; i < rows * cols; i++) {
    rgb[i * 3]     = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }
  return { rows, cols, rgb };
}

async function buildDicomFromImage(file, meta, instanceNum) {
  const { rows, cols, rgb } = await imageToRGB(file);
  const sopInstanceUID = newUID();

  // Keys must be 8-char uppercase hex, no 'x': dcmjs Tag.fromString parseInt()s substring(0,4).
  const d = {
    '00080005': { vr: 'CS', Value: ['ISO_IR 192'] },
    '00080008': { vr: 'CS', Value: ['ORIGINAL', 'PRIMARY'] },
    '00080016': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.7'] },
    '00080018': { vr: 'UI', Value: [sopInstanceUID] },
    '00080020': { vr: 'DA', Value: [meta.studyDate] },
    '00080021': { vr: 'DA', Value: [meta.studyDate] },
    '00080022': { vr: 'DA', Value: [meta.studyDate] },
    '00080023': { vr: 'DA', Value: [meta.studyDate] },
    '00080030': { vr: 'TM', Value: [meta.studyTime] },
    '00080031': { vr: 'TM', Value: [meta.studyTime] },
    '00080032': { vr: 'TM', Value: [meta.studyTime] },
    '00080033': { vr: 'TM', Value: [meta.studyTime] },
    '00080050': { vr: 'SH', Value: [meta.accession || ''] },
    '00080060': { vr: 'CS', Value: [meta.modality] },
    '00080090': { vr: 'PN', Value: [meta.referring || ''] },
    '00081030': { vr: 'LO', Value: [meta.studyDescription] },
    '0008103E': { vr: 'LO', Value: [meta.seriesDescription] },
    '00100010': { vr: 'PN', Value: [meta.patientName] },
    '00100020': { vr: 'LO', Value: [meta.patientID] },
    '00100030': { vr: 'DA', Value: [meta.patientDOB] },
    '00100040': { vr: 'CS', Value: [meta.patientSex] },
    '0020000D': { vr: 'UI', Value: [meta.studyUID] },
    '0020000E': { vr: 'UI', Value: [meta.seriesUID] },
    '00200010': { vr: 'SH', Value: ['1'] },
    '00200011': { vr: 'IS', Value: [1] },
    '00200012': { vr: 'IS', Value: [instanceNum] },
    '00200013': { vr: 'IS', Value: [instanceNum] },
    '00280002': { vr: 'US', Value: [3] },
    '00280004': { vr: 'CS', Value: ['RGB'] },
    '00280006': { vr: 'US', Value: [0] },
    '00280010': { vr: 'US', Value: [rows] },
    '00280011': { vr: 'US', Value: [cols] },
    '00280100': { vr: 'US', Value: [8] },
    '00280101': { vr: 'US', Value: [8] },
    '00280102': { vr: 'US', Value: [7] },
    '00280103': { vr: 'US', Value: [0] },
    '7FE00010': { vr: 'OB', Value: [rgb.buffer] },
  };
  if (meta.request) d['00400275'] = { vr: 'SQ', Value: [meta.request] };

  // Meta also needs plain 8-char hex keys — DicomDict.write() checks meta["00020010"]
  const fileMeta = {
    '00020002': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.7'] },
    '00020003': { vr: 'UI', Value: [sopInstanceUID] },
    '00020010': { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] },
    '00020012': { vr: 'UI', Value: ['1.2.826.0.1.3680043.10.743'] },
  };

  const dd = new DicomDict(fileMeta);
  dd.dict = d;
  const out = dd.write();
  return out.buffer || out;
}

// ---- Eye photos: Ophthalmic Photography 8 Bit Image (PS3.3 A.41) ----
// Small-clinic fundus cameras and slit lamps often save only JPEG, and generic converters file
// those as Secondary Capture with no eye recorded. This writes the ophthalmic IOD instead:
// Modality OP, Image Laterality on every image, and the camera's own JPEG bytes left untouched.
const OP8_SOP_UID      = '1.2.840.10008.5.1.4.1.1.77.1.5.1';
const TS_JPEG_BASELINE = '1.2.840.10008.1.2.4.50';
const TS_EXPLICIT_LE   = '1.2.840.10008.1.2.1';
// CID 4202 "Ophthalmic Photography Acquisition Device" and CID 4209 "Ophthalmic Anatomic
// Structure Imaged" (PS3.16); the same codes Retina writes.
const EYE_DEVICES = {
  fundus:   { code: ['409898007', 'Fundus Camera'],           region: ['5665001', 'Retina'], desc: 'Fundus photograph' },
  slitlamp: { code: ['397247004', 'Slit Lamp Biomicroscope'], region: ['81745001', 'Eye'],   desc: 'Slit lamp photograph' },
  external: { code: ['409903006', 'External Camera'],         region: ['81745001', 'Eye'],   desc: 'External eye photograph' },
};
// Retinal distance per degree of visual angle in the schematic eye, about 0.29 mm. Used only for
// the nominal Pixel Spacing a fundus image must carry (C.8.17.2); the standard calls it nominal.
const RETINA_MM_PER_DEGREE = 0.288;

let createKind = 'general';

// Words in a file name that say which eye: OD/OS/OU, the Spanish OI and AO, the Portuguese OE,
// and the plain words. Digits glued to a word ("OD1", "2L") do not hide it.
const EYE_NAME_WORDS = {
  R: ['od', 'r', 'right', 'righteye', 'derecho', 'derecha', 'der', 'direito'],
  L: ['os', 'l', 'left', 'lefteye', 'izquierdo', 'izquierda', 'izq', 'oi', 'esquerdo', 'oe'],
  B: ['ou', 'both', 'botheyes', 'ambos', 'ao', 'bilateral'],
};
// 'R' | 'L' | 'B', or null when the name says nothing, or names two different eyes.
function eyeFromFilename(name) {
  const base = String(name || '').replace(/\.[^.]*$/, '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const found = new Set();
  for (const tok of base.split(/[^a-z0-9]+/)) {
    const w = tok.replace(/^\d+|\d+$/g, '');
    for (const [eye, words] of Object.entries(EYE_NAME_WORDS)) if (words.includes(w)) found.add(eye);
  }
  return found.size === 1 ? [...found][0] : null;
}

// EXIF Orientation (0x0112) and DateTimeOriginal (0x9003) from a TIFF block.
function readJpegExif(t) {
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4D && t[1] === 0x4D)) return {};
  const u16 = o => le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1];
  const u32 = o => (le ? t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)
                       : (t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>> 0;
  const entries = (off, want) => {
    const at = {};
    if (off + 2 > t.length) return at;
    for (let i = 0, n = u16(off); i < n && off + 14 + i * 12 <= t.length; i++) {
      const e = off + 2 + i * 12;
      if (want.includes(u16(e))) at[u16(e)] = e;
    }
    return at;
  };
  const out = {};
  const ifd0 = entries(u32(4), [0x0112, 0x8769]);
  if (ifd0[0x0112]) out.orientation = u16(ifd0[0x0112] + 8);
  if (ifd0[0x8769]) {
    const ex = entries(u32(ifd0[0x8769] + 8), [0x9003]);
    if (ex[0x9003]) {
      const o = u32(ex[0x9003] + 8);
      const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(String.fromCharCode(...t.subarray(o, o + 19)));
      if (m && m[1] !== '0000') out.taken = m.slice(1).join('');
    }
  }
  return out;
}

// The JPEG's own header: frame type, size, components, Adobe colour transform, EXIF.
// null when the bytes are not a JPEG with a frame header.
function inspectJpeg(u) {
  if (u.length < 4 || u[0] !== 0xFF || u[1] !== 0xD8) return null;
  const j = { sof: null, bits: 0, rows: 0, cols: 0, comps: [], adobe: null, orientation: 1, taken: '' };
  const ascii = (seg, n) => String.fromCharCode(...seg.subarray(0, n));
  let p = 2;
  while (p + 4 <= u.length) {
    if (u[p] !== 0xFF) return null;
    const m = u[p + 1];
    if (m === 0xFF) { p++; continue; }                                    // fill byte
    if (m === 0x01 || (m >= 0xD0 && m <= 0xD8)) { p += 2; continue; }      // no length
    if (m === 0xD9 || m === 0xDA) break;                                  // headers end at the scan
    const len = (u[p + 2] << 8) | u[p + 3];
    const seg = u.subarray(p + 4, p + 2 + len);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      j.sof = m; j.bits = seg[0];
      j.rows = (seg[1] << 8) | seg[2]; j.cols = (seg[3] << 8) | seg[4];
      for (let i = 0; i < seg[5]; i++) j.comps.push(seg[6 + i * 3]);
    } else if (m === 0xEE && seg.length >= 12 && ascii(seg, 5) === 'Adobe') {
      j.adobe = seg[11];
    } else if (m === 0xE1 && seg.length > 14 && ascii(seg, 4) === 'Exif' && !seg[4] && !seg[5]) {
      try { Object.assign(j, readJpegExif(seg.subarray(6))); } catch (_) { /* unreadable EXIF: no rotation, no time */ }
    }
    p += 2 + len;
  }
  return j.sof === null ? null : j;
}

// Why these JPEG bytes cannot be filed unchanged, or '' when they can.
function jpegKeepProblem(j) {
  // JPEG Baseline (1.2.840.10008.1.2.4.50) is ISO 10918-1 Process 1 only (PS3.5 A.4.1):
  // SOF0, 8-bit. Progressive and arithmetic-coded JPEG have no current transfer syntax.
  if (j.sof !== 0xC0 || j.bits !== 8) return 'not baseline JPEG';
  if (!j.rows || !j.cols) return 'no image size in the frame header';
  if (j.comps.length !== 1 && j.comps.length !== 3) return `${j.comps.length} colour components`;
  // PS3.5 8.2.1 would allow an RGB-coded JPEG as RGB, but C.8.17.2.1.3 allows lossy OP colour
  // only as YBR_FULL_422. Adobe transform 0, or components named R G B, mean RGB.
  if (j.comps.length === 3 && (j.adobe === 0 || j.comps.join() === '82,71,66')) return 'RGB-coded JPEG';
  // DICOM viewers ignore EXIF, so a photo the camera only tagged as turned would show on its side.
  if (j.orientation !== 1) return 'turned by its EXIF Orientation';
  return '';
}

// Lossy Image Compression Method (0028,2114) for a decoded picture, or '' when its format is
// always lossless. PS3.3 C.7.6.1.1.5.1 Defined Terms where one exists; the Defined Terms may be
// extended, so another lossy format is named by its MIME subtype (as Retina does).
function lossyMethodFor(file, jpeg) {
  const m = String(file.type || '').toLowerCase();
  if (jpeg || /^image\/p?jpe?g$/.test(m) || (!m && /\.jpe?g$/i.test(file.name))) return 'ISO_10918_1';
  if (/^image\/(png|apng|bmp|x-ms-bmp|gif|tiff?)$/.test(m) || (!m && /\.(png|bmp|gif|tiff?)$/i.test(file.name))) return '';
  const sub = (m.split('/')[1] || '').replace(/^x-/, '').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 16);
  return sub || 'UNKNOWN';
}

// DS holds at most 16 characters.
function dsOf(x) { return String(Number(x.toPrecision(8))).slice(0, 16); }

const codeItem = ([value, meaning]) => ({
  '00080100': { vr: 'SH', Value: [value] },
  '00080102': { vr: 'SH', Value: ['SCT'] },
  '00080104': { vr: 'LO', Value: [meaning] },
});

// One OP 8 Bit Image. eye: 'R' | 'L' | 'B'. Returns the Part 10 bytes.
async function buildEyePhotoDicom(file, meta, instanceNum, eye) {
  if (!['R', 'L', 'B'].includes(eye)) throw new Error('no eye chosen for ' + file.name);
  const dev = EYE_DEVICES[meta.eyeDevice] || EYE_DEVICES.fundus;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = inspectJpeg(bytes);
  const keep = !!jpeg && !jpegKeepProblem(jpeg);

  let rows, cols, spp, pixel, ts, photometric, lossy, ratio;
  if (keep) {
    ({ rows, cols } = jpeg);
    spp = jpeg.comps.length;
    // PS3.5 Table 8.2.1-1, narrowed by C.8.17.2.1.3: YCbCr colour JPEG is YBR_FULL_422 whatever
    // its subsampling; the decoder takes the sampling from the frame header.
    photometric = spp === 3 ? 'YBR_FULL_422' : 'MONOCHROME2';
    pixel = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    ts = TS_JPEG_BASELINE;
    lossy = 'ISO_10918_1';
    ratio = rows * cols * spp / bytes.length;
  } else {
    const r = await imageToRGB(file);
    ({ rows, cols } = r);
    spp = 3;
    photometric = 'RGB';
    pixel = r.rgb.buffer;
    ts = TS_EXPLICIT_LE;
    // A JPEG decoded here was still lossy once; "01" may never be reset (C.7.6.1.1.5).
    lossy = lossyMethodFor(file, jpeg);
    ratio = rows * cols * 3 / bytes.length;
  }

  // Acquisition DateTime is Type 1C, required for ORIGINAL (C.8.17.2): the camera's own capture
  // time when EXIF has one, otherwise the study date the user entered.
  const taken = (jpeg && jpeg.taken) || (meta.studyDate + meta.studyTime);
  const takenDA = taken.slice(0, 8), takenTM = taken.slice(8, 14);
  const fov = meta.eyeFov > 0 ? meta.eyeFov : null;
  const sopInstanceUID = newUID();

  // Grouped by module; keys are 8-char uppercase hex, as dcmjs needs.
  const d = {
    // SOP Common
    '00080005': { vr: 'CS', Value: ['ISO_IR 192'] },
    '00080016': { vr: 'UI', Value: [OP8_SOP_UID] },
    '00080018': { vr: 'UI', Value: [sopInstanceUID] },
    // Patient, General Study
    '00100010': { vr: 'PN', Value: [meta.patientName] },
    '00100020': { vr: 'LO', Value: [meta.patientID] },
    '00100030': { vr: 'DA', Value: [meta.patientDOB] },
    '00100040': { vr: 'CS', Value: [meta.patientSex] },
    '0020000D': { vr: 'UI', Value: [meta.studyUID] },
    '00080020': { vr: 'DA', Value: [meta.studyDate] },
    '00080030': { vr: 'TM', Value: [meta.studyTime] },
    '00080050': { vr: 'SH', Value: [meta.accession || ''] },
    '00080090': { vr: 'PN', Value: [meta.referring || ''] },
    '00081030': { vr: 'LO', Value: [meta.studyDescription] },
    '00200010': { vr: 'SH', Value: ['1'] },
    // General Series; Ophthalmic Photography Series (C.8.17.1): Modality is OP. Series-level
    // Laterality (0020,0060) is left out: the images of one series may show different eyes.
    '00080060': { vr: 'CS', Value: ['OP'] },
    '0020000E': { vr: 'UI', Value: [meta.seriesUID] },
    '00200011': { vr: 'IS', Value: [meta.seriesNumber || 1] },
    '0008103E': { vr: 'LO', Value: [meta.seriesDescription || dev.desc] },
    // Synchronization (M in A.41.3): nothing here shares a trigger or an external clock.
    '00200200': { vr: 'UI', Value: [meta.syncUID] },
    '0018106A': { vr: 'CS', Value: ['NO TRIGGER'] },
    '00181800': { vr: 'CS', Value: ['N'] },
    // General Equipment: Manufacturer is Type 2, and the camera's maker is not known here.
    '00080070': { vr: 'LO', Value: [''] },
    // General Image, Ophthalmic Photography Image (C.8.17.2)
    '00080008': { vr: 'CS', Value: ['ORIGINAL', 'PRIMARY'] },
    '00200013': { vr: 'IS', Value: [instanceNum] },
    '00200020': { vr: 'CS', Value: [] },
    '00080022': { vr: 'DA', Value: [takenDA] },
    '00080032': { vr: 'TM', Value: [takenTM] },
    '0008002A': { vr: 'DT', Value: [taken] },
    '00080023': { vr: 'DA', Value: [takenDA] },
    '00080033': { vr: 'TM', Value: [takenTM] },
    '00280301': { vr: 'CS', Value: [meta.eyeBurnedIn === false ? 'NO' : 'YES'] },
    '00282110': { vr: 'CS', Value: [lossy ? '01' : '00'] },
    // Multi-frame (M): one frame. Frame Increment Pointer must point at a present attribute with
    // a value; C.7.6.6.1.2 names Frame Time = 0 for this single-frame case.
    '00280008': { vr: 'IS', Value: [1] },
    '00280009': { vr: 'AT', Value: [0x00181063] },
    '00181063': { vr: 'DS', Value: [0] },
    // Ocular Region Imaged (C.8.17.5): laterality per image, R/L/B only.
    '00200062': { vr: 'CS', Value: [eye] },
    '00082218': { vr: 'SQ', Value: [codeItem(dev.region)] },
    // Ophthalmic Photography Acquisition Parameters (C.8.17.4, C.8.17.8-2): Type 2 and unknown,
    // so present and empty. Nothing was measured with this photograph.
    '00220005': { vr: 'CS', Value: [] },
    '0022000C': { vr: 'FL', Value: fov ? [fov] : [] },
    '0022001B': { vr: 'SQ', Value: [] },
    '0022000A': { vr: 'FL', Value: [] },
    '0022000B': { vr: 'FL', Value: [] },
    '0022000D': { vr: 'CS', Value: [] },
    // Ophthalmic Photographic Parameters (C.8.17.3)
    '00220015': { vr: 'SQ', Value: [codeItem(dev.code)] },
    '00220016': { vr: 'SQ', Value: [] },
    '00220017': { vr: 'SQ', Value: [] },
    '00220018': { vr: 'SQ', Value: [] },
    '00220019': { vr: 'SQ', Value: [] },
    '00187004': { vr: 'CS', Value: [] },
    // Image Pixel; A.41.4.1 fixes 8/8/7.
    '00280002': { vr: 'US', Value: [spp] },
    '00280004': { vr: 'CS', Value: [photometric] },
    '00280010': { vr: 'US', Value: [rows] },
    '00280011': { vr: 'US', Value: [cols] },
    '00280100': { vr: 'US', Value: [8] },
    '00280101': { vr: 'US', Value: [8] },
    '00280102': { vr: 'US', Value: [7] },
    '00280103': { vr: 'US', Value: [0] },
    '7FE00010': { vr: 'OB', Value: [pixel] },
  };
  if (spp === 3) d['00280006'] = { vr: 'US', Value: [0] };
  else d['20500020'] = { vr: 'CS', Value: ['IDENTITY'] };      // 1C for MONOCHROME2 (C.8.17.2)
  if (lossy) {
    d['00282112'] = { vr: 'DS', Value: [dsOf(Math.max(1, ratio))] };
    d['00282114'] = { vr: 'CS', Value: [lossy] };
  }
  // Pixel Spacing is 1C for a fundus camera (C.8.17.2): nominal, from the field of view.
  if (dev === EYE_DEVICES.fundus && fov) {
    const mm = dsOf(fov * RETINA_MM_PER_DEGREE / cols);
    d['00280030'] = { vr: 'DS', Value: [mm, mm] };
  }
  if (meta.request) d['00400275'] = { vr: 'SQ', Value: [meta.request] };

  const fileMeta = {
    '00020002': { vr: 'UI', Value: [OP8_SOP_UID] },
    '00020003': { vr: 'UI', Value: [sopInstanceUID] },
    '00020010': { vr: 'UI', Value: [ts] },
    '00020012': { vr: 'UI', Value: ['1.2.826.0.1.3680043.10.743'] },
  };
  const dd = new DicomDict(fileMeta);
  dd.dict = d;
  // One fragment for the one frame (PS3.5 A.4), rather than dcmjs's default 20 KB pieces.
  const out = dd.write({ fragmentMultiframe: false });
  return out.buffer || out;
}

// ---- Create's mode: a plain picture, or eye photos ----
function setCreateKind(kind) {
  createKind = kind === 'eye' ? 'eye' : 'general';
  $('cdKind').value = createKind;
  $('cdEyeCard').classList.toggle('hidden', createKind !== 'eye');
  const mod = $('cdModality');
  // OP is the only Modality the OP IOD allows (C.8.17.1); a picture leaves OP behind.
  if (createKind === 'eye') { mod.value = 'OP'; mod.disabled = true; }
  else { mod.disabled = false; if (mod.value === 'OP') mod.value = 'OT'; }
  showCreateBlock('');
  renderCreateGrid();
}

function eyeFovValue() {
  const v = parseFloat($('cdEyeFov').value);
  return v > 0 && v <= 200 ? v : 0;
}

// What stops Create right now, in words, or ''.
function createBlockReason() {
  if (createKind !== 'eye') return '';
  const missing = createImages.filter(img => !img.eye).length;
  if (missing) return T('Choose Right, Left or Both on every eye photo first. {n} still need one.').replace('{n}', missing);
  if ($('cdEyeDevice').value === 'fundus' && !eyeFovValue()) {
    return T("Enter the camera's field of view in degrees. Fundus photos need it to record the pixel size.");
  }
  return '';
}

function showCreateBlock(msg) {
  const el = $('cdBlock');
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

// The message was for the last attempt; keep it true, or drop it once nothing blocks.
function refreshCreateBlock() {
  if (!$('cdBlock').classList.contains('hidden')) showCreateBlock(createBlockReason());
}

const EYE_CHOICES = [['', 'Which eye?'], ['R', 'Right (OD)'], ['L', 'Left (OS)'], ['B', 'Both (OU)']];

function eyeSelectFor(img) {
  const sel = document.createElement('select');
  sel.className = 'img-thumb-eye' + (img.eye ? '' : ' unset');
  sel.setAttribute('aria-label', T('Which eye?') + ' ' + img.file.name);
  for (const [v, label] of EYE_CHOICES) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = T(label);
    if ((img.eye || '') === v) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    img.eye = sel.value || null;
    sel.classList.toggle('unset', !img.eye);
    refreshCreateBlock();
  });
  return sel;
}

$('cdKind').addEventListener('change', e => setCreateKind(e.target.value));
$('cdEyeFov').addEventListener('input', refreshCreateBlock);
$('cdEyeDevice').addEventListener('change', refreshCreateBlock);
$('cdModality').addEventListener('change', e => { if (e.target.value === 'OP') setCreateKind('eye'); });
// The camera's field of view rarely changes, so this browser remembers it.
try { const fov = localStorage.getItem('dcm-create-fov'); if (fov) $('cdEyeFov').value = fov; } catch (_) {}
$('cdEyeFov').addEventListener('change', () => {
  try { localStorage.setItem('dcm-create-fov', $('cdEyeFov').value); } catch (_) {}
});

// Every file Create is about to write, one at a time: { name, buf } or { name, error }.
async function* createDicomOutputs() {
  const studyDate = ($('cdStudyDate').value || '').replace(/-/g, '') || nowDA();
  const common = {
    patientName:      $('cdPatientName').value.trim() || 'UNKNOWN',
    patientID:        $('cdPatientID').value.trim(),
    patientDOB:       ($('cdPatientDOB').value || '').replace(/-/g, ''),
    patientSex:       $('cdPatientSex').value,
    accession:        $('cdAccession').value.trim(),
    referring:        createOrder.referring || '',
    studyUID:         createOrder.studyUID || newUID(),
    request:          createRequestItem(),
    studyDate,
    studyTime:        nowTM(),
    studyDescription: $('cdStudyDesc').value.trim(),
    modality:         $('cdModality').value || 'OT',
  };
  const eye = createKind === 'eye';
  if (eye) {
    Object.assign(common, {
      eyeDevice:   $('cdEyeDevice').value,
      eyeFov:      eyeFovValue(),
      eyeBurnedIn: $('cdEyeBurnedIn').checked,
      syncUID:     newUID(),            // one environment for everything made in this go
    });
  }

  // Each series gets its own Series Instance UID.
  const seriesMeta = {};
  createSeries.forEach((s, i) => {
    seriesMeta[s.id] = { ...common, seriesUID: newUID(), seriesNumber: i + 1, seriesDescription: s.description };
  });
  const count = {};
  for (const img of createImages) {
    const sid = seriesMeta[img.series] ? img.series : createSeries[0].id;
    count[sid] = (count[sid] || 0) + 1;
    const name = img.file.name.replace(/\.[^.]+$/, '') + '.dcm';
    try {
      const buf = eye ? await buildEyePhotoDicom(img.file, seriesMeta[sid], count[sid], img.eye)
                      : await buildDicomFromImage(img.file, seriesMeta[sid], count[sid]);
      yield { name, buf };
    } catch (e) {
      yield { name: img.file.name, error: e.message || String(e) };
    }
  }
}

// ---- Prefill: open Create ready to add photos to an ordered study ----
// For a worklist (Carino DICOM) to hand over the order. The keys are the ones its orders use
// (pacs/mwl.py), so an order can be passed as it is. Two ways in:
//
//   #create=eye&patient_name=DOE%5EJANE&patient_id=123&patient_birthdate=19800102&patient_sex=F
//     &accession=A1&study_desc=Fundus%20photos&procedure_id=RP1&sps_id=SPS1&study_uid=1.2.3&referring=…
//       Values URL-encoded. "create" alone opens Create; "create=eye" also picks Eye photo.
//       The hash is dropped from the address bar once read: patient details do not belong in
//       the browser's history.
//
//   Carino Bridge (#carino-bridge): a file named *.carino-create.json beside any photos, holding
//     { "carinoCreate": 1, "kind": "eye", "patient_name": "DOE^JANE", … same keys … }
//       The photos, if any, are added to Create. Nothing in the payload reaches the URL.
//
// Anything that would not fit its DICOM VR is dropped rather than cut: a truncated Patient ID is
// a different patient. study_uid makes every file join that study instead of a new one.
const CREATE_PREFILL_FIELDS = {
  patient_name: 64, patient_id: 64, patient_birthdate: 10, patient_sex: 1, accession: 16,
  study_desc: 64, procedure_id: 16, sps_id: 16, study_uid: 64, referring: 64,
};
let createOrder = {};

function parseCreateHash(hash) {
  const h = String(hash || '').replace(/^[#?]/, '');
  const params = new URLSearchParams(h);
  if (!params.has('create')) return null;
  const p = { kind: params.get('create') };
  for (const k of Object.keys(CREATE_PREFILL_FIELDS)) if (params.has(k)) p[k] = params.get(k);
  return p;
}

// Returns the fields it took, cleaned, so callers and tests can see what was refused.
function applyCreatePrefill(p) {
  const v = {};
  for (const [k, max] of Object.entries(CREATE_PREFILL_FIELDS)) {
    const s = typeof p[k] === 'string' ? p[k].trim() : (typeof p[k] === 'number' ? String(p[k]) : '');
    if (s && s.length <= max && !/[\\\u0000-\u001f]/.test(s)) v[k] = s;
  }
  const dob = (v.patient_birthdate || '').replace(/-/g, '');
  if (!/^\d{8}$/.test(dob)) delete v.patient_birthdate;
  if (!/^[MFO]$/.test(v.patient_sex || '')) delete v.patient_sex;
  // PS3.5 9.1: digits and dots, no empty or zero-led component.
  if (!/^(0|[1-9]\d*)(\.(0|[1-9]\d*))*$/.test(v.study_uid || '')) delete v.study_uid;

  $('cdPatientName').value = v.patient_name || '';
  $('cdPatientID').value   = v.patient_id || '';
  $('cdPatientDOB').value  = v.patient_birthdate ? `${dob.slice(0, 4)}-${dob.slice(4, 6)}-${dob.slice(6, 8)}` : '';
  $('cdPatientSex').value  = v.patient_sex || '';
  $('cdAccession').value   = v.accession || '';
  $('cdStudyDesc').value   = v.study_desc || '';
  createOrder = {
    studyUID: v.study_uid || '', procedureId: v.procedure_id || '', spsId: v.sps_id || '',
    procedure: v.study_desc || '', referring: v.referring || '',
  };
  renderCreateOrder();
  setCreateKind(p.kind === 'eye' ? 'eye' : createKind);
  switchTab('create');
  return v;
}

// Request Attributes Sequence item (PS3.3 Table 10-9), when an order came in with an ID.
function createRequestItem() {
  const o = createOrder;
  if (!o.procedureId && !o.spsId) return null;
  const item = {};
  if (o.procedureId) item['00401001'] = { vr: 'SH', Value: [o.procedureId] };
  if (o.spsId)       item['00400009'] = { vr: 'SH', Value: [o.spsId] };
  if (o.procedure)   item['00321060'] = { vr: 'LO', Value: [o.procedure] };
  const acc = $('cdAccession').value.trim();
  if (acc) item['00080050'] = { vr: 'SH', Value: [acc] };
  return item;
}

function renderCreateOrder() {
  const has = !!(createOrder.studyUID || createOrder.procedureId || createOrder.spsId);
  $('cdOrder').classList.toggle('hidden', !has);
  $('cdOrderUID').textContent = createOrder.studyUID || createOrder.procedureId || createOrder.spsId || '';
}

$('cdOrderClear').addEventListener('click', () => { createOrder = {}; renderCreateOrder(); });

const CREATE_HANDOFF = /\.carino-create\.json$/i;
// A bridge delivery that is a Create order. true when it was one, whatever else it held.
async function takeCreateHandoff(files) {
  const order = files.find(f => CREATE_HANDOFF.test(f.name || ''));
  if (!order) return false;
  let p;
  try { p = JSON.parse(await order.text()); } catch (_) { p = null; }
  if (!p || p.carinoCreate !== 1) throw new Error(T('The order sent to Create could not be read.'));
  applyCreatePrefill(p);
  addCreateImages(files.filter(f => f !== order));
  return true;
}

// ---- Quick-fill helpers ----
// Same split as the Edit tab: Anonymize fills placeholders, Randomize invents a plausible patient.
function fillCreateAnon() {
  $('cdPatientName').value = ANON_NAME;
  $('cdPatientID').value   = 'ANON';
  $('cdPatientDOB').value  = '';
  $('cdPatientSex').value  = 'O';
  $('cdStudyDate').value   = new Date().toISOString().slice(0, 10);
  $('cdStudyDesc').value   = '';
}

function fillCreateRandom() {
  const year  = 1950 + Math.floor(Math.random() * 60);
  const month = String(1  + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day   = String(1  + Math.floor(Math.random() * 28)).padStart(2, '0');
  const sex   = randFrom(['M', 'F', 'O']);
  $('cdPatientName').value = randName(sex);
  $('cdPatientID').value   = randDigits(8);
  $('cdPatientDOB').value  = `${year}-${month}-${day}`;
  $('cdPatientSex').value  = sex;
  $('cdStudyDate').value   = new Date().toISOString().slice(0, 10);
  $('cdStudyDesc').value   = randFrom(['CHEST X-RAY', 'MRI BRAIN', 'CT ABDOMEN', 'US PELVIS', 'MAMMOGRAM']);
}

$('cdAnonymizeBtn').addEventListener('click', fillCreateAnon);
$('cdRandomizeBtn').addEventListener('click', fillCreateRandom);
$('addSeriesBtn').addEventListener('click', addSeries);

renderSeriesPanel();

