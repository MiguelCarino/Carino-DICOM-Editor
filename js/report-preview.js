// Report preview: every PDF report is shown before it is written, as Topo's report dialog does.
// The frame holds the very document the PDF draws (carinoReportHtml), laid out at the PDF's width on
// a sheet with the PDF's margins, with a dashed line where each page will end (pdfPageBreaks, the
// same cut the PDF makes). Download writes the PDF from the report as previewed; Close drops it.
//
// cfg: { build(values, progress) -> report opts | Promise, options?: [{ id, type: 'check'|'radio',
// label, value, choices?: [[value, label]] }] }. A change to an option builds the report again.
const RP_MARGIN_PX = Math.round(PDF_PAGE.margin / PDF_PT_PER_PX);   // 15 mm at the layout's scale
const RP_PAGE_PX = PDF_CSS_W + 2 * RP_MARGIN_PX + 32;               // the sheet and the grey around it
const _rp = { seq: 0, cfg: null, values: {}, built: null, back: null };

function rpStatus(text) { const el = $('rpStatus'); if (el) el.textContent = text || ''; }

function rpRenderOptions() {
  const box = $('rpOpts');
  if (!box) return;
  const opts = _rp.cfg?.options || [];
  box.hidden = !opts.length;
  box.replaceChildren(...opts.map(o => {
    const wrap = document.createElement(o.type === 'radio' ? 'fieldset' : 'label');
    if (o.type === 'radio') {
      const lg = document.createElement('legend');
      lg.textContent = T(o.label);
      wrap.append(lg, ...o.choices.map(([v, l]) => {
        const lab = document.createElement('label');
        const r = document.createElement('input');
        r.type = 'radio'; r.name = 'rp-' + o.id; r.value = v; r.checked = _rp.values[o.id] === v;
        r.addEventListener('change', () => { if (r.checked) { _rp.values[o.id] = v; rpRefresh(); } });
        const s = document.createElement('span'); s.textContent = T(l);
        lab.append(r, s);
        return lab;
      }));
    } else {
      const c = document.createElement('input');
      c.type = 'checkbox'; c.checked = !!_rp.values[o.id];
      c.addEventListener('change', () => { _rp.values[o.id] = c.checked; rpRefresh(); });
      const s = document.createElement('span'); s.textContent = T(o.label);
      wrap.append(c, s);
    }
    return wrap;
  }));
}

// A stage narrower than a sheet shows the sheet scaled down, as it will print, rather than the
// report reflowed to a phone's width. Only the frame element is scaled.
function rpFit() {
  const frame = $('rpFrame'), stage = $('rpStage');
  if (!frame || !stage) return;
  Object.assign(frame.style, { width: '', height: '', transform: '' });
  const w = stage.clientWidth;
  if (!w || w >= RP_PAGE_PX) return;
  const k = w / RP_PAGE_PX;
  Object.assign(frame.style, { width: `${RP_PAGE_PX}px`, height: `${Math.round(stage.clientHeight / k)}px`,
                               transform: `scale(${k})`, transformOrigin: '0 0' });
}

function rpPreviewHtml(html) {
  const fonts = new URL('fonts/carino-fonts.css', document.baseURI).href;
  const css = `<link rel="stylesheet" href="${_pesc(fonts)}"><style>
    html{background:#d6d8dc;}
    body{box-sizing:content-box;width:${PDF_CSS_W}px;padding:${RP_MARGIN_PX}px;margin:16px auto 24px;position:relative;box-shadow:0 1px 6px rgba(0,0,0,.28);}
    .rp-break{position:absolute;left:0;right:0;height:0;border-top:1.5px dashed #9aa0a8;pointer-events:none;}
    .rp-break span{position:absolute;left:8px;top:3px;font:10px 'IBM Plex Mono',monospace;color:#6b7280;}
    @media print{html{background:#fff;}body{margin:0;box-shadow:none;}.rp-break{display:none!important;}}
  </style></head>`;
  return html.replace('</head>', css);
}

async function rpRefresh() {
  const seq = ++_rp.seq;
  const frame = $('rpFrame');
  $('rpDownload').disabled = true;
  if ($('rpPrint')) $('rpPrint').disabled = true;
  rpStatus(T('Preparing the report…'));
  let opts;
  try {
    opts = await _rp.cfg.build({ ..._rp.values }, (i, n) => { if (seq === _rp.seq) rpStatus(TF('Reading files… {i} / {n}', { i, n })); });
  } catch (e) {
    console.error(e);
    if (seq === _rp.seq) rpStatus(T('Could not build the report.'));
    return;
  }
  if (seq !== _rp.seq || !_rp.cfg) return;
  _rp.built = opts;
  $('rpName').textContent = reportPdfName(opts);
  await new Promise(done => {
    const shown = () => { frame.onload = null; done(); };
    frame.onload = shown;
    setTimeout(shown, 5000);   // a frame that never says it loaded
    frame.srcdoc = rpPreviewHtml(carinoReportHtml(opts));
  });
  if (seq !== _rp.seq) return;
  let pages = 0;
  try {
    const d = frame.contentDocument;
    if (d.fonts) await d.fonts.ready;
    await Promise.all([...d.images].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    if (seq !== _rp.seq) return;
    pdfSpellOutText(d);        // as the PDF draws it, so the page ends below are the PDF's
    const r = d.body.getBoundingClientRect();
    const breaks = pdfPageBreaks(d, { top: r.top + RP_MARGIN_PX, height: r.height - 2 * RP_MARGIN_PX });
    pages = breaks.length - 1;
    breaks.slice(1, -1).forEach((b, i) => {
      const line = d.createElement('div');
      line.className = 'rp-break';
      line.style.top = `${RP_MARGIN_PX + b}px`;
      const tag = d.createElement('span');
      tag.textContent = TF('Page {n}', { n: i + 2 });
      line.append(tag);
      d.body.append(line);
    });
  } catch (e) { console.warn('Report preview: could not measure the pages.', e); }
  rpFit();
  rpStatus(pages ? TF(pages === 1 ? '1 page' : '{n} pages', { n: pages }) : '');
  try { frame.contentDocument.addEventListener('keydown', rpKey); } catch (_) {}   // Esc with focus in the sheet
  $('rpDownload').disabled = false;
  if ($('rpPrint')) $('rpPrint').disabled = false;
}

function openReportPreview(cfg) {
  const ov = $('rpOverlay');
  if (!ov) return Promise.resolve(cfg.build({})).then(carinoPdfDownload);   // a page without the dialog writes straight away
  _rp.cfg = cfg; _rp.built = null; _rp.values = {};
  (cfg.options || []).forEach(o => { _rp.values[o.id] = o.value; });
  _rp.back = document.activeElement;
  rpRenderOptions();
  $('rpName').textContent = '';
  ov.hidden = false;
  document.addEventListener('keydown', rpKey);
  $('rpClose')?.focus();
  return rpRefresh();
}

function closeReportPreview() {
  _rp.seq++; _rp.cfg = null; _rp.built = null;
  const ov = $('rpOverlay');
  if (ov) ov.hidden = true;
  const frame = $('rpFrame');
  if (frame) { frame.onload = null; frame.removeAttribute('srcdoc'); }
  document.removeEventListener('keydown', rpKey);
  try { _rp.back?.focus(); } catch (_) {}
}
function rpKey(e) { if (e.key === 'Escape') closeReportPreview(); }

async function rpDownload() {
  const opts = _rp.built;
  if (!opts) return;
  closeReportPreview();
  await carinoPdfDownload(opts);
}

// Print prints the sheet in the frame, the same document the PDF draws; the dialog stays open.
function rpPrint() {
  const w = $('rpFrame')?.contentWindow;
  if (!_rp.built || !w) return;
  w.focus();
  w.print();
  $('rpPrint')?.focus();
}

$('rpClose')?.addEventListener('click', closeReportPreview);
$('rpPrint')?.addEventListener('click', rpPrint);
$('rpDownload')?.addEventListener('click', rpDownload);
$('rpOverlay')?.addEventListener('click', e => { if (e.target.id === 'rpOverlay') closeReportPreview(); });
window.addEventListener('resize', () => { if (_rp.cfg) rpFit(); });
window.addEventListener('carino:langchange', () => { if (_rp.cfg) rpRenderOptions(); });
window.openReportPreview = openReportPreview;
window.closeReportPreview = closeReportPreview;
