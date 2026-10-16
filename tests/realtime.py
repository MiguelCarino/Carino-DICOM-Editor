#!/usr/bin/env python3
"""Runs one test page in headless Chromium on the REAL clock, for run.sh.

run.sh normally dumps the DOM after --virtual-time-budget, and that clock only
waits for the page's own main thread and network. OCR runs in a Web Worker, so
the virtual clock sees an idle page, skips straight to the end of the budget and
dumps the DOM a fraction of a second in, long before the engine has loaded. A
suite marked '@realtime' in its first lines is run here instead: the page is
driven over the DevTools protocol (--remote-debugging-pipe, so no websocket
library and no npm) and polled until it writes <pre id="TESTOUT">.

Because it is already on the protocol, it also watches every request the page
AND its workers make, which an in-page check cannot (a worker's fetches are not
in the page's performance timeline), and appends one assertion: nothing left
the origin the page was served from.

    python3 tests/realtime.py CHROME URL [TIMEOUT_SECONDS]

Prints the TESTOUT lines (or BOOTERR:<message>) on stdout.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit


def main():
    chrome, url = sys.argv[1], sys.argv[2]
    timeout = float(sys.argv[3]) if len(sys.argv) > 3 else 180.0
    origin = '{0.scheme}://{0.netloc}'.format(urlsplit(url))

    # The pipe protocol: Chromium reads commands on fd 3 and writes on fd 4,
    # each message JSON terminated by a NUL byte.
    to_chrome_r, to_chrome_w = os.pipe()
    from_chrome_r, from_chrome_w = os.pipe()
    profile = tempfile.mkdtemp(prefix='dcm-realtime-')

    def wire_fds():
        os.dup2(to_chrome_r, 3)
        os.dup2(from_chrome_w, 4)

    proc = subprocess.Popen(
        [chrome, '--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
         '--remote-debugging-pipe', '--user-data-dir=' + profile, 'about:blank'],
        pass_fds=(3, 4), preexec_fn=wire_fds,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.close(to_chrome_r)
    os.close(from_chrome_w)
    out_f = os.fdopen(to_chrome_w, 'wb', buffering=0)
    in_f = os.fdopen(from_chrome_r, 'rb', buffering=0)

    buf = b''
    next_id = [0]
    requests = []

    def send(method, params=None, session=None):
        next_id[0] += 1
        msg = {'id': next_id[0], 'method': method, 'params': params or {}}
        if session:
            msg['sessionId'] = session
        out_f.write(json.dumps(msg).encode() + b'\0')
        return next_id[0]

    def handle_event(msg):
        method, p = msg.get('method'), msg.get('params', {})
        if method == 'Network.requestWillBeSent':
            requests.append((msg.get('sessionId'), p['request']['url']))
        elif method == 'Target.attachedToTarget':
            # A worker (or iframe) the page started: watch its network too, then
            # let it run — it was paused at start so no request slips past.
            child = p['sessionId']
            send('Network.enable', session=child)
            send('Target.setAutoAttach', {'autoAttach': True, 'waitForDebuggerOnStart': True,
                                          'flatten': True}, session=child)
            send('Runtime.runIfWaitingForDebugger', session=child)

    def call(method, params=None, session=None, wait=30.0):
        nonlocal buf
        want = send(method, params, session)
        end = time.time() + wait
        while time.time() < end:
            while b'\0' not in buf:
                chunk = in_f.read(1 << 16)
                if not chunk:
                    raise RuntimeError('Chromium closed the pipe')
                buf += chunk
            raw, buf = buf.split(b'\0', 1)
            msg = json.loads(raw)
            if msg.get('id') == want:
                if 'error' in msg:
                    raise RuntimeError('%s: %s' % (method, msg['error']))
                return msg.get('result', {})
            if 'method' in msg:
                handle_event(msg)
        raise RuntimeError(method + ' timed out')

    result = ''
    try:
        target = call('Target.createTarget', {'url': 'about:blank'})['targetId']
        page = call('Target.attachToTarget', {'targetId': target, 'flatten': True})['sessionId']
        call('Network.enable', session=page)
        call('Target.setAutoAttach', {'autoAttach': True, 'waitForDebuggerOnStart': True,
                                      'flatten': True}, session=page)
        call('Page.navigate', {'url': url}, session=page)
        probe = ('(() => { const t = document.getElementById("TESTOUT");'
                 ' if (t) return t.textContent;'
                 ' const b = document.getElementById("BOOTERR");'
                 ' return b ? "BOOTERR:" + b.textContent : null; })()')
        end = time.time() + timeout
        while time.time() < end:
            r = call('Runtime.evaluate', {'expression': probe, 'returnByValue': True}, session=page)
            v = r.get('result', {}).get('value')
            if v is not None:
                result = v
                break
            time.sleep(0.5)
        else:
            result = 'FAIL :: suite finished within %d s on the real clock' % timeout

        if not result.startswith('BOOTERR:'):
            # data: and blob: never touch the network; everything else must be ours.
            urls = [u for _, u in requests if not u.startswith(('data:', 'blob:'))]
            away = [u for u in urls if not (u == origin or u.startswith(origin + '/'))]
            workers = sum(1 for s, _ in requests if s != page)
            result += '\n%s :: runner: every request stayed on %s (%d requests, %d from workers)%s' % (
                'FAIL' if away else 'PASS', origin, len(urls), workers,
                (' :: ' + ' | '.join(away[:5])) if away else '')
    except Exception as e:  # report, do not hang run.sh
        result = 'FAIL :: real-clock runner :: %s' % e
    finally:
        proc.kill()
        proc.wait()
        shutil.rmtree(profile, ignore_errors=True)
    print(result.strip())


if __name__ == '__main__':
    main()
