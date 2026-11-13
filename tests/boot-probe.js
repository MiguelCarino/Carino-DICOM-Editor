/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Injected by tests/run.sh ahead of every app script: records the first boot error, so a suite
// that never reports can say why it died. A file because the page's CSP forbids inline script.
window.addEventListener('error', (e) => {
  if (document.getElementById('BOOTERR')) return;
  const p = document.createElement('pre'); p.id = 'BOOTERR';
  p.textContent = e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno;
  document.documentElement.appendChild(p);
});
