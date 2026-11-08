// Writes sbom.spdx.json: an SPDX 2.3 software bill of materials for everything in this tree that
// someone else wrote — the vendored bundles, the WebAssembly codecs and the C libraries compiled
// into them, the OCR engine and model, and the web fonts. Run from the repo root:
//
//     node tools/make-sbom.mjs           # rewrite sbom.spdx.json
//     node tools/make-sbom.mjs --check   # exit 1 if it is stale (a vendored file changed)
//
// Why a file and not a lockfile: nothing here is installed by a package manager. Every bundle was
// copied in by hand (vendor/README.md says how), so npm audit, Dependabot and every scanner that
// reads a lockfile see none of it. An SBOM is the one place a scanner, a hospital's procurement
// review or a CVE triage can find "which OpenJPEG is in this build" without reading the README.
//
// The table below is the authority on names, versions and licences, and vendor/README.md is where
// a person reads them; keep the two in step. What this script adds is the files themselves: each
// one is hashed (SHA-1, which SPDX 2.3 requires for a file, and SHA-256), so a swapped or
// half-refreshed bundle shows up as a stale SBOM rather than going unnoticed. --check is that test.
//
// Deterministic on purpose: the document namespace is derived from the content, and `created` is
// carried over from the existing file unless the content changed. Re-running on an unchanged tree
// is a no-op, so the file only shows up in a diff when what it describes did.
//
// The same tree is vendored into Carino DICOM (pacs/web/editor/), so this file travels with it and
// that repo's own SBOM folds it in. The Electron desktop build is not covered: its dependencies are
// in desktop/package-lock.json, which `npm sbom` reads directly. Node only — never loaded by the page.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'sbom.spdx.json';
const npm = (name, version) => ({
  downloadLocation: `https://registry.npmjs.org/${name}/-/${name.split('/').pop()}-${version}.tgz`,
  purl: `pkg:npm/${name.replace('@', '%40')}@${version}`,
});
const gh = (repo, ref) => ({
  downloadLocation: `git+https://github.com/${repo}@${ref}`,
  purl: `pkg:github/${repo}@${ref}`,
});

// id: SPDXRef suffix. files: paths (or directory prefixes) under the repo root that are this
// package's shipped bytes. within: the package it is compiled or bundled into (CONTAINS), rather
// than shipped as files of its own.
const PACKAGES = [
  { id: 'dcmjs', name: 'dcmjs', version: '0.29.8', license: 'MIT', ...npm('dcmjs', '0.29.8'),
    files: ['vendor/dcmjs.min.js'], comment: 'jsDelivr build of build/dcmjs.js' },
  { id: 'pako', name: 'pako', version: '2.0.4', license: 'MIT AND Zlib', ...npm('pako', '2.0.4'), within: 'dcmjs' },
  { id: 'loglevelnext', name: 'loglevelnext', version: 'NOASSERTION', license: 'MPL-2.0',
    downloadLocation: 'git+https://github.com/shellscape/loglevelnext', purl: 'pkg:npm/loglevelnext', within: 'dcmjs',
    comment: 'major version 3, bundled into dcmjs; see vendor/README.md on MPL-2.0 alongside the host licence' },
  { id: 'core-js', name: 'core-js', version: 'NOASSERTION', license: 'MIT',
    downloadLocation: 'git+https://github.com/zloirock/core-js', purl: 'pkg:npm/core-js', within: 'dcmjs',
    comment: 'via @babel/runtime-corejs3, bundled into dcmjs' },
  { id: 'jpeg-lossless-decoder-js', name: 'jpeg-lossless-decoder-js', version: '2.1.2', license: 'MIT',
    ...npm('jpeg-lossless-decoder-js', '2.1.2'), files: ['vendor/lossless-min.js'] },
  { id: 'codec-openjpeg', name: '@cornerstonejs/codec-openjpeg', version: '1.3.6', license: 'MIT',
    ...npm('@cornerstonejs/codec-openjpeg', '1.3.6'), files: ['vendor/openjpegwasm.js', 'vendor/openjpegwasm.wasm'],
    comment: 'full build (decoder and encoder); also decodes HTJ2K (Part 15)' },
  { id: 'openjpeg', name: 'OpenJPEG', version: '2.5.4', license: 'BSD-2-Clause', ...gh('uclouvain/openjpeg', 'v2.5.4'),
    cpe: 'cpe:2.3:a:uclouvain:openjpeg:2.5.4:*:*:*:*:*:*:*', within: 'codec-openjpeg',
    comment: 'version as reported by the module (getVersion)' },
  { id: 'codec-charls', name: '@cornerstonejs/codec-charls', version: '1.2.3', license: 'MIT',
    ...npm('@cornerstonejs/codec-charls', '1.2.3'), files: ['vendor/charlswasm.js', 'vendor/charlswasm.wasm'],
    comment: 'full build (decoder and encoder)' },
  { id: 'charls', name: 'CharLS', version: '2.4.1', license: 'BSD-3-Clause', ...gh('team-charls/charls', '2.4.1'),
    cpe: 'cpe:2.3:a:team-charls:charls:2.4.1:*:*:*:*:*:*:*', within: 'codec-charls',
    comment: 'version as reported by the module (getVersion)' },
  { id: 'html2canvas', name: 'html2canvas', version: '1.4.1', license: 'MIT', ...npm('html2canvas', '1.4.1'),
    files: ['vendor/html2canvas.min.js'] },
  { id: 'tslib', name: 'tslib', version: 'NOASSERTION', license: '0BSD', purl: 'pkg:npm/tslib',
    downloadLocation: 'git+https://github.com/microsoft/tslib', within: 'html2canvas' },
  { id: 'tesseract-js', name: 'tesseract.js', version: '7.0.0', license: 'Apache-2.0', ...npm('tesseract.js', '7.0.0'),
    files: ['vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js'] },
  { id: 'regenerator-runtime', name: 'regenerator-runtime', version: 'NOASSERTION', license: 'MIT',
    purl: 'pkg:npm/regenerator-runtime', downloadLocation: 'git+https://github.com/facebook/regenerator', within: 'tesseract-js' },
  { id: 'buffer', name: 'buffer', version: 'NOASSERTION', license: 'MIT', purl: 'pkg:npm/buffer',
    downloadLocation: 'git+https://github.com/feross/buffer', within: 'tesseract-js' },
  { id: 'ieee754', name: 'ieee754', version: 'NOASSERTION', license: 'BSD-3-Clause', purl: 'pkg:npm/ieee754',
    downloadLocation: 'git+https://github.com/feross/ieee754', within: 'tesseract-js' },
  { id: 'zlibjs', name: 'zlib.js', version: 'NOASSERTION', license: 'MIT', purl: 'pkg:npm/zlibjs',
    downloadLocation: 'git+https://github.com/imaya/zlib.js', within: 'tesseract-js' },
  { id: 'tesseract-js-core', name: 'tesseract.js-core', version: '7.0.0', license: 'Apache-2.0',
    ...npm('tesseract.js-core', '7.0.0'),
    files: ['vendor/tesseract/tesseract-core-lstm.js', 'vendor/tesseract/tesseract-core-lstm.wasm',
            'vendor/tesseract/tesseract-core-simd-lstm.js', 'vendor/tesseract/tesseract-core-simd-lstm.wasm'] },
  // Compiled into both tesseract.js-core .wasm files, at the submodule commits v7.0.0 pins.
  { id: 'tesseract', name: 'Tesseract OCR', version: 'NOASSERTION', license: 'Apache-2.0',
    downloadLocation: 'git+https://github.com/tesseract-ocr/tesseract', within: 'tesseract-js-core' },
  { id: 'leptonica', name: 'Leptonica', version: '4af068b5', license: 'BSD-2-Clause', ...gh('DanBloomberg/leptonica', '4af068b5'), within: 'tesseract-js-core' },
  { id: 'zlib', name: 'zlib', version: '21767c65', license: 'Zlib', ...gh('madler/zlib', '21767c65'), within: 'tesseract-js-core' },
  { id: 'libpng', name: 'libpng', version: 'a37d4836', license: 'libpng-2.0', ...gh('glennrp/libpng', 'a37d4836'), within: 'tesseract-js-core' },
  { id: 'libjpeg', name: 'libjpeg (IJG)', version: '9a', license: 'IJG', ...gh('LuaDist/libjpeg', '6c0fcb8d'), within: 'tesseract-js-core' },
  { id: 'libtiff', name: 'libtiff', version: 'b51bb157', license: 'libtiff',
    downloadLocation: 'git+https://gitlab.com/libtiff/libtiff@b51bb157', within: 'tesseract-js-core' },
  { id: 'libwebp', name: 'libwebp', version: '20ef03ee', license: 'BSD-3-Clause', ...gh('webmproject/libwebp', '20ef03ee'), within: 'tesseract-js-core' },
  { id: 'giflib', name: 'giflib', version: 'fa376720', license: 'MIT', ...gh('mirrorer/giflib', 'fa376720'), within: 'tesseract-js-core' },
  { id: 'openlibm', name: 'OpenLibm', version: 'ae2d9169', license: 'NOASSERTION', ...gh('JuliaMath/openlibm', 'ae2d9169'),
    within: 'tesseract-js-core', comment: 'MIT, BSD and ISC by file, some public domain: vendor/tesseract/LICENSE-tesseract-core-libs.txt' },
  { id: 'tessdata-fast', name: 'tessdata_fast eng.traineddata', version: '4.0.0', license: 'Apache-2.0',
    ...gh('tesseract-ocr/tessdata_fast', '87416418'), files: ['vendor/tesseract/eng.traineddata.gz'],
    comment: 'gzip -9 -n of eng.traineddata, last changed in commit 923915d4' },
  { id: 'ibm-plex', name: 'IBM Plex Sans and IBM Plex Mono', version: 'NOASSERTION', license: 'OFL-1.1',
    downloadLocation: 'git+https://github.com/IBM/plex', files: ['fonts/IBMPlex'], comment: 'subsetted WOFF2' },
  { id: 'red-hat-fonts', name: 'Red Hat Display and Red Hat Text', version: 'NOASSERTION', license: 'OFL-1.1',
    downloadLocation: 'git+https://github.com/RedHatOfficial/RedHatFont', files: ['fonts/RedHat'], comment: 'subsetted WOFF2' },
];

const ROOT_VERSION = JSON.parse(readFileSync('desktop/package.json', 'utf8')).version;

const sha = (alg, buf) => createHash(alg).update(buf).digest('hex');
const ref = (id) => `SPDXRef-Package-${id}`;

// Every file a package names, expanded from a directory-style prefix like 'fonts/IBMPlex'.
function expand(spec) {
  if (existsSync(spec)) return [spec];
  const slash = spec.lastIndexOf('/');
  const dir = spec.slice(0, slash), stem = spec.slice(slash + 1);
  return readdirSync(dir).filter(f => f.startsWith(stem) && f.endsWith('.woff2')).sort().map(f => `${dir}/${f}`);
}

function build(created) {
  const packages = [{
    SPDXID: ref('carino-dicom-editor'), name: 'Carino DICOM Editor', versionInfo: ROOT_VERSION,
    downloadLocation: 'git+https://github.com/MiguelCarino/Carino-DICOM-Editor',
    licenseConcluded: 'MPL-2.0', licenseDeclared: 'MPL-2.0', copyrightText: 'Copyright (c) 2026 Miguel Carino',
    filesAnalyzed: false, supplier: 'Person: Miguel Carino',
    comment: 'Only third-party components are listed below; the editor\'s own sources are not enumerated.',
  }];
  const files = [];
  const relationships = [{ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: ref('carino-dicom-editor') }];
  let n = 0;
  for (const p of PACKAGES) {
    const pkg = {
      SPDXID: ref(p.id), name: p.name, versionInfo: p.version, downloadLocation: p.downloadLocation || 'NOASSERTION',
      licenseConcluded: p.license, licenseDeclared: p.license, copyrightText: 'NOASSERTION', filesAnalyzed: false,
      supplier: 'NOASSERTION',
    };
    const refs = [];
    if (p.purl) refs.push({ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: p.purl });
    if (p.cpe) refs.push({ referenceCategory: 'SECURITY', referenceType: 'cpe23Type', referenceLocator: p.cpe });
    if (refs.length) pkg.externalRefs = refs;
    if (p.comment) pkg.comment = p.comment;
    packages.push(pkg);
    relationships.push(p.within
      ? { spdxElementId: ref(p.within), relationshipType: 'CONTAINS', relatedSpdxElement: ref(p.id) }
      : { spdxElementId: ref('carino-dicom-editor'), relationshipType: 'CONTAINS', relatedSpdxElement: ref(p.id) });
    for (const path of (p.files || []).flatMap(expand)) {
      const buf = readFileSync(path);
      const id = `SPDXRef-File-${++n}`;
      files.push({
        SPDXID: id, fileName: './' + path,
        checksums: [{ algorithm: 'SHA1', checksumValue: sha('sha1', buf) },
                    { algorithm: 'SHA256', checksumValue: sha('sha256', buf) }],
        licenseConcluded: p.license, licenseInfoInFiles: ['NOASSERTION'], copyrightText: 'NOASSERTION',
      });
      relationships.push({ spdxElementId: ref(p.id), relationshipType: 'CONTAINS', relatedSpdxElement: id });
    }
    if (p.files && !(p.files.flatMap(expand)).length) throw new Error(`${p.id}: no files match ${p.files.join(', ')}`);
    // A package that CONTAINS files must say it analysed them (SPDX 2.3 7.8), and then carry the
    // verification code: SHA-1 over its files' sorted SHA-1s (7.9).
    if (p.files) {
      const mine = files.slice(files.length - p.files.flatMap(expand).length);
      pkg.filesAnalyzed = true;
      pkg.licenseInfoFromFiles = ['NOASSERTION'];
      pkg.packageVerificationCode = {
        packageVerificationCodeValue: sha('sha1', mine.map(f => f.checksums[0].checksumValue).sort().join('')),
      };
    }
  }
  const body = { packages, files, relationships };
  const digest = sha('sha256', JSON.stringify(body)).slice(0, 32);
  return {
    spdxVersion: 'SPDX-2.3', dataLicense: 'CC0-1.0', SPDXID: 'SPDXRef-DOCUMENT',
    name: `Carino DICOM Editor ${ROOT_VERSION} third-party components`,
    documentNamespace: `https://dcm.carino.systems/spdx/carino-dicom-editor-${ROOT_VERSION}-${digest}`,
    creationInfo: { created, creators: ['Tool: tools/make-sbom.mjs'] },
    ...body,
  };
}

const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
let doc = build(old?.creationInfo?.created || new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
if (old && old.documentNamespace !== doc.documentNamespace)
  doc = build(new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
const text = JSON.stringify(doc, null, 2) + '\n';

if (process.argv.includes('--check')) {
  if (!old || old.documentNamespace !== doc.documentNamespace) {
    console.error(`${OUT} is stale: a vendored file or the component table changed. Run node tools/make-sbom.mjs.`);
    process.exit(1);
  }
  console.error(`${OUT} is current (${doc.packages.length} packages, ${doc.files.length} files).`);
} else {
  writeFileSync(OUT, text);
  console.error(`wrote ${OUT}: ${doc.packages.length} packages, ${doc.files.length} files.`);
}
