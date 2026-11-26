"""픽셀 경매 디펜스 — 실구동 QA (로컬 HTTP + Playwright)
확인 항목
  1) 콘솔 에러 / 페이지 에러 0건
  2) 타이틀 → 서바이벌 진입 → 입찰 → 동시 오픈 → 웨이브 진행
  3) 유닛 선택/강화/판매/이동 상호작용
  4) 동점 유찰(골드 반환) 실제 처리 경로
  5) 20웨이브 완주(가상 시계) 및 결과 화면
  6) 협력 모드 진입·전투·기여도 표시
  7) 모바일(390x844) 레이아웃
  8) 스크린샷: preview-auction.png / preview-battle.png (+ docs/)
"""
import threading, functools, http.server, socketserver, os, sys, json, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
os.makedirs(DOCS, exist_ok=True)
PORT = 8899

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright

results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + ((" — " + str(detail)) if detail else ""))

def state(pg):
    return pg.evaluate("PAD.state()")

def to_screen(box, lx, ly):
    return (box["x"] + lx / 780 * box["width"], box["y"] + ly / 520 * box["height"])

def slot_screen(box, field_x, field_y, scale=1.6, ox=6, oy=132):
    return to_screen(box, ox + field_x * scale, oy + field_y * scale)

console_errors, page_errors = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'),args=["--no-sandbox", "--disable-dev-shm-usage"])

    # ---------- 데스크톱 ----------
    page = browser.new_page(viewport={"width": 1280, "height": 860}, device_scale_factor=1)
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.goto(f"http://localhost:{PORT}/index.html", wait_until="load")
    page.wait_for_timeout(700)

    check("타이틀 렌더", page.is_visible("#titleLayer") and page.is_visible("#btnSurvival"))
    page.screenshot(path=os.path.join(DOCS, "preview-title.png"))

    # 방법 보기 토글
    page.click("#btnHowto")
    page.wait_for_timeout(150)
    check("게임 방법 토글", page.is_visible("#howtoBox"))
    page.click("#btnHowtoClose")

    # 서바이벌 시작
    page.click("#btnSurvival")
    page.wait_for_timeout(500)
    st = state(page)
    check("서바이벌 경매 진입", st["phase"] == "auction" and st["mode"] == "survival", st["phase"])
    check("시작 골드 30 / 라이프 14", st["gold"] == 30 and st["lives"] == 14, f"{st['gold']}G {st['lives']}♥")

    # 입찰 조작
    page.click("[data-bid='10']")
    page.click("[data-bid='5']")
    page.wait_for_timeout(200)
    bid_after = page.inner_text("#bidNum")
    check("빠른 배팅 버튼(+10/+5)", bid_after == "15", bid_after)
    page.click("[data-bid='-10']")
    page.wait_for_timeout(120)
    check("빠른 배팅 마이너스", page.inner_text("#bidNum") == "5", page.inner_text("#bidNum"))
    page.click("#btnAllin")
    page.wait_for_timeout(120)
    check("올인 버튼", page.inner_text("#bidNum") == "30", page.inner_text("#bidNum"))
    # 되돌려 15로
    page.evaluate("PAD.bid(15)")
    page.wait_for_timeout(150)

    # 경매 스크린샷 (입찰 중 화면)
    page.screenshot(path=os.path.join(ROOT, "preview-auction.png"))
    auction_png = os.path.join(ROOT, "preview-auction.png")

    # 동시 오픈
    page.click("#btnConfirm")
    page.wait_for_timeout(400)
    check("동시 오픈 연출 진입", state(page)["phase"] == "reveal", state(page)["phase"])
    page.wait_for_timeout(1600)
    cards = page.eval_on_selector_all(".bid-card.open", "els => els.length")
    check("4인 입찰가 동시 공개", cards == 4, cards)
    page.screenshot(path=os.path.join(DOCS, "preview-reveal.png"))
    outcome = page.evaluate("PAD.G.auction.outcome")
    check("공개 후 낙찰/유찰 판정", outcome and outcome["type"] in ("sold", "unsold", "pass"), outcome)
    page.click("#revealLayer")  # 스킵
    page.wait_for_timeout(600)
    st = state(page)
    check("전투 진입", st["phase"] == "battle", st["phase"])

    # 전투 진행
    page.wait_for_timeout(4200)
    st = state(page)
    check("웨이브 적 스폰", st["enemies"] > 0, st["enemies"])
    page.screenshot(path=os.path.join(ROOT, "preview-battle.png"))
    battle_png = os.path.join(ROOT, "preview-battle.png")

    # 일시정지 / 배속 / 음소거
    page.click("#btnMenu")
    page.wait_for_timeout(150)
    paused_visible = page.is_visible("#menuLayer")
    page.click("#btnResume")
    page.wait_for_timeout(150)
    check("메뉴 일시정지/재개", paused_visible and not page.is_visible("#menuLayer"))
    page.click("#btnSpeed")
    page.wait_for_timeout(100)
    fast = page.evaluate("PAD.G.speed")
    page.click("#btnSpeed"); page.click("#btnSpeed")
    page.wait_for_timeout(100)
    check("배속 순환 ×1→×2→×3→×1", fast == 2 and page.evaluate("PAD.G.speed") == 1, fast)
    page.click("#btnSound")
    page.wait_for_timeout(100)
    check("음소거 토글", page.evaluate("PAD.G.muted") is True)
    page.click("#btnSound")

    # 유닛 상호작용: 첫 슬롯 유닛 선택 → 강화
    box = page.locator("#cv").bounding_box()
    unit_slots = page.evaluate("PAD.G.players[0].field.slots.filter(s=>s.unit).map(s=>({x:s.x,y:s.y,i:s.idx}))")
    check("내 유닛 슬롯 존재", len(unit_slots) >= 1, unit_slots)
    if unit_slots:
        ux, uy = slot_screen(box, unit_slots[0]["x"], unit_slots[0]["y"])
        page.mouse.click(ux, uy)
        page.wait_for_timeout(250)
        check("탭으로 유닛 선택", page.is_visible("#selActions"), page.inner_text("#selName"))
        gold_before = state(page)["gold"]
        page.click("#btnUpgrade")
        page.wait_for_timeout(250)
        st2 = state(page)
        starred = page.evaluate("PAD.G.players[0].field.units.some(u=>u.owner===0 && u.star>=2)")
        check("강화(★2) 동작", starred and st2["gold"] < gold_before, f"{gold_before}->{st2['gold']}")
        # 이동: 선택된 유닛을 빈 슬롯으로
        empty = page.evaluate("PAD.G.players[0].field.slots.filter(s=>!s.unit).map(s=>({x:s.x,y:s.y,i:s.idx}))")
        if empty:
            ex, ey = slot_screen(box, empty[0]["x"], empty[0]["y"])
            page.mouse.click(ex, ey)
            page.wait_for_timeout(200)
            moved = page.evaluate("PAD.G.players[0].field.slots.filter(s=>s.unit).length")
            check("빈 슬롯 탭으로 이동", moved == len(unit_slots), moved)
        # 판매
        units_now = page.evaluate("PAD.G.players[0].field.units.filter(u=>u.owner===0).length")
        page.evaluate("PAD.G.sel={uid:PAD.G.players[0].field.units[0].uid}")
        page.wait_for_timeout(150)
        g0 = state(page)["gold"]
        page.click("#btnSell")
        page.wait_for_timeout(250)
        units_after = page.evaluate("PAD.G.players[0].field.units.filter(u=>u.owner===0).length")
        check("판매(환불) 동작", units_after == units_now - 1 and state(page)["gold"] > g0,
              f"units {units_now}->{units_after}, gold {g0}->{state(page)['gold']}")

    # 웨이브 클리어까지
    for _ in range(40):
        if state(page)["phase"] in ("auction", "result"):
            break
        page.wait_for_timeout(500)
    check("웨이브 1 클리어 후 다음 경매", state(page)["wave"] >= 2, state(page)["wave"])

    # ---------- 동점 유찰 (실제 처리 경로) ----------
    st = state(page)
    if st["phase"] != "auction":
        page.evaluate("PAD.G.wave=1; PAD.startGame? 0:0")
    page.evaluate("PAD.startGame('survival')")
    page.wait_for_timeout(400)
    gold_before = state(page)["gold"]
    units_before = page.evaluate("PAD.G.players[0].field.units.filter(u=>u.owner===0).length")
    res = page.evaluate("PAD.forceBids([9,9,4,0])")
    page.wait_for_timeout(200)
    st = state(page)
    check("동점 → 유찰 판정", res["outcome"]["type"] == "unsold", res["outcome"])
    check("유찰 시 골드 반환(차감 없음)", res["gold"][0] == gold_before, f"{gold_before} -> {res['gold'][0]}")
    units_after = page.evaluate("PAD.G.players[0].field.units.filter(u=>u.owner===0).length")
    check("유찰 시 유닛 지급 없음", units_after == units_before, f"{units_before} -> {units_after}")
    check("유찰 연출 표시", "유찰" in page.inner_text("#revealOutcome"), page.inner_text("#revealOutcome").replace("\n", " / "))

    # 단일 최고가 낙찰 검증
    res2 = page.evaluate("PAD.forceBids([0,12,12,5])")
    check("동점 2명(12G)도 유찰", res2["outcome"]["type"] == "unsold", res2["outcome"])
    res3 = page.evaluate("PAD.forceBids([0,12,5,7])")
    check("단독 최고가 낙찰", res3["outcome"]["type"] == "sold" and res3["outcome"]["price"] == 12, res3["outcome"])
    page.evaluate("PAD.resolveBids([5,5,3,0]).type === 'unsold' && PAD.resolveBids([0,0,0,0]).type === 'pass'")
    check("resolveBids 단위 규칙", page.evaluate(
        "PAD.resolveBids([5,5,3,0]).type==='unsold' && PAD.resolveBids([0,0,0,0]).type==='pass' && PAD.resolveBids([2,1,0,0]).winner===0"))

    page.close()

    # ---------- 20웨이브 완주 (가상 시계, 최대 3회 시도) ----------
    full = browser.new_page(viewport={"width": 1100, "height": 820})
    full.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    full.on("pageerror", lambda e: page_errors.append(str(e)))
    full.clock.install()
    full.goto(f"http://localhost:{PORT}/index.html", wait_until="load")
    full.clock.run_for(300)

    best = {"wave": 0, "phase": "", "lives": 0}
    cleared = False
    attempts = []
    for attempt in range(3):
        if attempt == 0:
            full.click("#btnSurvival")
            full.clock.run_for(200)
        else:
            full.evaluate("PAD.startGame('survival')")
            full.clock.run_for(200)
        full.evaluate("PAD.setSpeed(3)")
        for step in range(550):
            st = state(full)
            if st["phase"] == "auction":
                full.evaluate("""() => {
                    const p = PAD.G.players[0];
                    const val = PAD.LOTS[PAD.G.auction.key].cost;
                    const bid = Math.min(p.gold, Math.round(val * 1.25 + 2 + 1.6 * PAD.G.wave));
                    PAD.bid(bid); PAD.confirm();
                }""")
            elif st["phase"] == "augment":
                full.locator("#augOptions button").first.click()
            elif st["phase"] == "battle":
                full.evaluate("""() => {
                    const p = PAD.G.players[0];
                    if (p.gold < 16) return;
                    const ups = p.field.units.filter(u => u.owner === 0 && u.star < 3).sort((a, b) => a.star - b.star);
                    if (!ups.length) return;
                    const u = ups[0];
                    const cost = u.star === 1 ? 12 : 22;
                    if (p.gold >= cost + 4) {
                        PAD.G.sel = { uid: u.uid };
                        document.getElementById('btnUpgrade').click();
                    }
                }""")
            if st["phase"] == "result":
                break
            full.clock.run_for(1500)
        st = state(full)
        attempts.append((st["wave"], st["phase"], st["lives"]))
        if st["wave"] > best["wave"] or (st["wave"] == best["wave"] and st["lives"] > best["lives"]):
            best = {"wave": st["wave"], "phase": st["phase"], "lives": st["lives"]}
        if st["phase"] == "result":
            full.screenshot(path=os.path.join(DOCS, "preview-result-try%d.png" % attempt))
            if st["wave"] == 20 and st["lives"] > 0:
                cleared = True
                full.screenshot(path=os.path.join(DOCS, "preview-result.png"))
                break

    if not cleared:
        for a in range(3):
            f = os.path.join(DOCS, "preview-result-try%d.png" % a)
            if os.path.exists(f):
                import shutil; shutil.copyfile(f, os.path.join(DOCS, "preview-result.png"))
    check("결과 화면 도달", best["phase"] == "result", f"시도 {attempts}")
    check("웨이브 20 완주 경로 동작", cleared, f"시도 {attempts}")
    st = state(full)
    check("결과 화면 표시", full.is_visible("#resultLayer"), full.inner_text("#resultTitle"))
    full.screenshot(path=os.path.join(DOCS, "preview-result.png"))
    full.close()

    # ---------- 협력 모드 ----------
    coop = browser.new_page(viewport={"width": 1280, "height": 860})
    coop.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    coop.on("pageerror", lambda e: page_errors.append(str(e)))
    coop.goto(f"http://localhost:{PORT}/index.html", wait_until="load")
    coop.wait_for_timeout(500)
    coop.click("#btnCoop")
    coop.wait_for_timeout(400)
    st = state(coop)
    check("협력 모드 경매 진입", st["phase"] == "auction" and st["mode"] == "coop", st["phase"])
    check("협력 코어 라이프", st["lives"] == 60, st["lives"])
    coop.evaluate("PAD.bid(12)"); coop.click("#btnConfirm")
    coop.wait_for_timeout(2000)
    coop.evaluate("PAD.skipReveal()")
    coop.wait_for_timeout(4500)
    st = state(coop)
    check("협력 전투 진행", st["phase"] == "battle", st["phase"])
    rows = coop.eval_on_selector_all(".coop-row", "els => els.length")
    check("기여도 4인 표시", rows == 4, rows)
    check("협력 코어 HP 표시", coop.inner_text("#lifeNum") == str(st["lives"]), coop.inner_text("#lifeNum"))
    coop.screenshot(path=os.path.join(DOCS, "preview-coop.png"))
    coop.close()

    # ---------- 모바일 ----------
    mob = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mob.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    mob.on("pageerror", lambda e: page_errors.append(str(e)))
    mob.goto(f"http://localhost:{PORT}/index.html", wait_until="load")
    mob.wait_for_timeout(600)
    mob.screenshot(path=os.path.join(DOCS, "preview-mobile-title.png"))
    mob.tap("#btnSurvival")
    mob.wait_for_timeout(600)
    overflow = mob.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("모바일 가로 오버플로 없음", overflow <= 1, overflow)
    body_scroll = mob.evaluate("document.body.scrollHeight - window.innerHeight")
    check("모바일 세로 한 화면", body_scroll <= 2, body_scroll)
    check("모바일 캔버스 표시", mob.is_visible("#cv"))
    mob.screenshot(path=os.path.join(DOCS, "preview-mobile-auction.png"))
    mob.evaluate("PAD.bid(10)"); mob.tap("#btnConfirm")
    mob.wait_for_timeout(2000)
    mob.evaluate("PAD.skipReveal()")
    mob.wait_for_timeout(3000)
    mob.screenshot(path=os.path.join(DOCS, "preview-mobile-battle.png"))
    check("모바일 전투 화면", state(mob)["phase"] == "battle", state(mob)["phase"])
    mob.close()

    browser.close()

httpd.shutdown()

check("콘솔 에러 0건", len(console_errors) == 0, console_errors[:5])
check("페이지 에러 0건", len(page_errors) == 0, page_errors[:5])
check("스크린샷 저장", os.path.exists(os.path.join(ROOT, "preview-auction.png")) and os.path.exists(os.path.join(ROOT, "preview-battle.png")))

failed = [r for r in results if not r[1]]
print("\n==== SUMMARY ====")
print(f"{len(results)-len(failed)}/{len(results)} PASS")
for n, ok, d in results:
    if not ok:
        print("  FAIL:", n, d)
sys.exit(1 if failed else 0)
