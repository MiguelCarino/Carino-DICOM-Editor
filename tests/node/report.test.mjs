/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Node unit tests for the report file (PDF or HTML) wiring: no browser.
//
//     node --test tests/node/
//
// Loads the fleet engine's pure half (carino-pdf.js under no document), js/render.js and
// js/report-preview.js into one vm context with a stub DOM, and checks what can be held without
// layout: file names per format, the report's own @page rule as CarinoPdf reads it, the preview
// sheet's geometry, the page cuts the preview draws, the markup and i18n the switch needs, and
// that the app's duplicate PDF engine is gone. The PDF itself is checked in tests/suites/pdf.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function load() {
  const listeners = {};
  const window = { addEventListener: (k, f) => { (listeners[k] ||= []).push(f); } };
  const ctx = vm.createContext({
    window, console, URL, Blob, TextEncoder, setTimeout, clearTimeout,
    fetch: () => Promise.reject(new Error('no network in tests')),
    FileReader: class {},
    document: undefined,
    $: () => null,
    T: (s) => s,
    TF: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]),
  });
  // carino-pdf.js returns before its DOM half when there is no document: only the pure helpers.
  vm.runInContext(read('carino-pdf.js'), ctx, { filename: 'carino-pdf.js' });
  ctx.CarinoPdf = window.CarinoPdf;
  ctx.document = { baseURI: 'https://dcm.carino.systems/', addEventListener() {}, removeEventListener() {} };
  vm.runInContext(read('js/render.js'), ctx, { filename: 'js/render.js' });
  vm.runInContext(read('js/report-preview.js'), ctx, { filename: 'js/report-preview.js' });
  return { ctx, window, listeners };
}

test('the engine pure half loads', () => {
  const { ctx } = load();
  assert.equal(typeof ctx.CarinoPdf.pageBreaks, 'function');
  assert.equal(typeof ctx.CarinoPdf.pageSetup, 'function');
});

test('file names follow the format', () => {
  const { ctx } = load();
  const o = { title: 'DICOM Tag Dump', fileBase: 'CT 患者 01' };
  assert.equal(ctx.window.reportFileName(o, 'pdf'), 'CT-患者-01_DICOM-Tag-Dump.pdf');
  assert.equal(ctx.window.reportFileName(o), 'CT-患者-01_DICOM-Tag-Dump.pdf');
  assert.equal(ctx.window.reportFileName(o, 'html'), 'CT-患者-01_DICOM-Tag-Dump.html');
  assert.equal(ctx.window.reportFileName({ title: 'DICOM Change Report', fileBase: 'dicom-edited' }, 'html'),
               'dicom-edited_DICOM-Change-Report.html');
  // The engine's own fileName agrees on the extension swap.
  assert.equal(ctx.CarinoPdf.fileName(ctx.window.reportFileName(o, 'pdf'), 'html'), ctx.window.reportFileName(o, 'html'));
});

test('the report states its page: A4 portrait, 15 mm margins, as CarinoPdf reads it', () => {
  const { ctx } = load();
  const html = ctx.carinoReportHtml({ title: 'T <x>', subtitle: 's', meta: 'm', body: '<section><p>hi</p></section>' });
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const page = ctx.CarinoPdf.pageSetup(css);
  assert.equal(page.w, 210);
  assert.equal(page.h, 297);
  assert.deepEqual([...page.margin], [15, 15, 15, 15]);
  assert.match(html, /<title>T &lt;x&gt;<\/title>/);
});

test('the report document stands alone, so its HTML file is the document itself', () => {
  const { ctx } = load();
  const html = ctx.carinoReportHtml({ title: 'T', body: '<p>x</p>' });
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<img\b[^>]*\bsrc\s*=\s*["']?(?!data:)/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<meta charset="utf-8">/);
});

test('the preview sheet is the PDF page: printable width and height at 96 px per inch', () => {
  const { ctx } = load();
  const w = vm.runInContext('RP_CSS_W', ctx), h = vm.runInContext('RP_CSS_H', ctx), m = vm.runInContext('RP_MARGIN_PX', ctx);
  assert.ok(Math.abs(w - 180 * 96 / 25.4) < 1e-9);
  assert.ok(Math.abs(h - 267 * 96 / 25.4) < 1e-9);
  assert.equal(m, Math.round(15 * 96 / 25.4));
});

test('preview page cuts are the engine cuts, shifted to the sheet content', () => {
  const { ctx } = load();
  const top0 = 73;   // body top + margin in the preview document
  // 60 rows of 40 px from the content top: rows end every 40 px.
  const rows = Array.from({ length: 60 }, (_, i) => [top0 + i * 40, top0 + (i + 1) * 40]);
  const m = { ends: rows.map(r => r[1]), keeps: rows, forced: [] };
  const cuts = ctx.rpPageCuts(m, top0, 2400, 1000);
  assert.equal(cuts[0], 0);
  assert.equal(cuts[cuts.length - 1], 2400);
  for (let i = 1; i < cuts.length; i++) assert.ok(cuts[i] - cuts[i - 1] <= 1001, `page ${i} too tall`);
  for (const c of cuts) assert.equal(c % 40, 0, `cut ${c} runs through a row`);
  assert.deepEqual([...cuts], [...ctx.CarinoPdf.pageBreaks(m.ends.map(e => e - top0), rows.map(k => [k[0] - top0, k[1] - top0]), [], 2400, 1000)]);
  // A forced break (break-before: page) starts a page there.
  const f = ctx.rpPageCuts({ ...m, forced: [top0 + 400] }, top0, 2400, 1000);
  assert.ok(f.includes(400));
});

test('the duplicate PDF engine is gone and nothing loads the old vendored html2canvas', () => {
  const render = read('js/render.js');
  for (const f of ['buildPdf', 'reportToPdf', 'pdfSpellOutText', 'pdfPageBreaks', 'pdfPageImage', 'carinoPdfDownload', 'PDF_CSS_W'])
    assert.ok(!render.includes(f), `${f} still in js/render.js`);
  assert.ok(!existsSync(join(ROOT, 'vendor/html2canvas.min.js')));
  for (const p of ['index.html', 'js/render.js', 'js/report-preview.js', 'js/preview.js', 'js/ocr.js', 'tools/make-sbom.mjs', 'desktop/package.json'])
    assert.ok(!read(p).includes('vendor/html2canvas'), `${p} names vendor/html2canvas`);
});

test('markup: carino-pdf.js loaded, Download is the last action and labelled by code', () => {
  const html = read('index.html');
  assert.match(html, /<script src="carino-pdf\.js" defer><\/script>/);
  const dlg = html.slice(html.indexOf('id="rpOverlay"'), html.indexOf('id="rpFrame"'));
  const actions = dlg.slice(dlg.indexOf('rpv-actions'));
  const ids = [...actions.matchAll(/<button[^>]*id="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['rpPrint', 'rpDownload']);
  const dl = actions.match(/<button[^>]*id="rpDownload"[^>]*>([^<]*)</);
  assert.equal(dl[1], 'Download PDF');
  assert.doesNotMatch(dl[0], /data-i18n/);   // its label follows the switch, set in js/report-preview.js
  assert.match(dl[0], /class="btn btn-primary\b/);   // the fleet's primary (carino-ui.css), and the app's .btn.primary look
  // The switch is put just above the file name, outside the options.
  assert.match(read('js/report-preview.js'), /\$\('rpName'\)\.before\(_rp\.sw\.el\)/);
});

test('the desktop build ships the engine and its html2canvas', () => {
  const pkg = JSON.parse(read('desktop/package.json'));
  const from = pkg.build.extraResources.map(r => r.from);
  assert.ok(from.includes('../carino-pdf.js'));
  assert.ok(from.includes('../carino-html2canvas.js'));
});

test('every new string is translated in es, pt-BR, ja and ru', () => {
  const src = read('i18n.js');
  const blocks = {};
  for (const loc of ['es', 'pt-BR', 'ja', 'ru']) {
    const start = src.search(new RegExp(`^    ${loc.includes('-') ? `'${loc}'` : loc}: \\{`, 'm'));
    assert.ok(start >= 0, `no ${loc} block`);
    const end = src.indexOf('\n    },', start);
    blocks[loc] = src.slice(start, end);
  }
  const keys = ['File', 'PDF', 'HTML', 'Download PDF', 'Download HTML', 'Creating the PDF…', 'Could not create the PDF.', 'Could not create the file.'];
  for (const [loc, b] of Object.entries(blocks)) {
    for (const k of keys) {
      const m = b.match(new RegExp(`^\\s*'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': '([^']+)',`, 'm'));
      assert.ok(m, `${loc} lacks '${k}'`);
      if (/PDF|HTML/.test(k)) assert.match(m[1], /PDF|HTML|файл|archivo|arquivo|ファイル/, `${loc} '${k}' should keep PDF/HTML in Latin`);
    }
  }
  assert.ok(!/'⬇ Download PDF'/.test(src), 'the old button key is gone');
});
