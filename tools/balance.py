"""밸런스 시뮬레이션: 렌더 없이 update()만 돌려 자동 플레이 결과를 본다."""
import threading, functools, http.server, socketserver, os, json, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 8816), functools.partial(Q, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright

opts = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
runs = int(sys.argv[2]) if len(sys.argv) > 2 else 5

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
    pg = b.new_page(viewport={"width": 900, "height": 760})
    errs, perrs = [], []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: perrs.append(str(e)))
    pg.goto("http://localhost:8816/index.html", wait_until="load")
    pg.wait_for_timeout(300)
    for i in range(runs):
        r = pg.evaluate("(o)=>PAD.autoPlay(o)", opts)
        print(f"#{i+1} wave={r['wave']} phase={r['phase']} lives={r['lives']} gold={r['gold']} kills={r['kills']} units=[{r['units']}]")
        print("    bots:", [(x['name'], x['lives'], x['units'], x['kills']) for x in r['bots']])
        for e in r['log']:
            if e.get('ev') == 'end':
                print(f"    W{e['wave']} end lives={e['lives']} gold={e['gold']} units=[{e['units']}]")
            else:
                print(f"    W{e['wave']} bid {e['buy']} {e['bid']}G (gold {e['gold']})")
    print("ERRS", errs[:3], "PERRS", perrs[:3])
    b.close()
httpd.shutdown()
