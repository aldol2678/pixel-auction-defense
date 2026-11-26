"""Check the visible, hittable menu bounds (the page width alone misses clipping)."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

url = (Path(__file__).resolve().parents[1] / 'index.html').as_uri()
controls = ['.logo-sub', '.logo', '#btnSurvival', '#btnCoop', '.room-entry', '#btnHowto']
def check_menu(page):
    for selector in controls:
        assert page.locator(selector).evaluate("""el => {
          const r = el.getBoundingClientRect();
          return [[r.left+r.width/2,r.top+2],[r.left+r.width/2,r.bottom-2],
            [r.left+2,r.top+r.height/2],[r.right-2,r.top+r.height/2],
            [r.left+r.width/2,r.top+r.height/2]].every(([x,y]) =>
            el.contains(document.elementFromPoint(x,y)));
        }"""), selector
    assert page.locator('#panel').is_hidden()
    assert page.locator('#titleLayer img').evaluate_all("images => images.every(i=>i.complete && i.naturalWidth>0)")
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), args=['--no-sandbox'])
    for width,height in [(320,568),(360,640),(390,720),(412,780),(844,390),(1280,860)]:
        page = browser.new_page(viewport={'width':width,'height':height},has_touch=True)
        page.goto(url);page.wait_for_timeout(250)
        check_menu(page)
        page.tap('#btnMenu')
        assert page.locator('#menuLayer').is_visible() and page.locator('#btnRestart').is_hidden()
        page.tap('#menuSound');assert page.locator('#btnSound').get_attribute('aria-pressed') == 'false'
        page.tap('#menuSound');page.tap('#btnResume')
        assert page.locator('#menuLayer').is_hidden()
        page.tap('#btnMenu');page.keyboard.press('Escape')
        assert page.locator('#menuLayer').is_hidden()
        page.tap('#btnMenu');page.tap('#menuHelp')
        assert page.locator('#howtoBox').is_visible()
        page.tap('#btnHowtoClose')
        for mode in ['#btnSurvival','#btnCoop']:
            page.tap(mode);assert page.locator('#auctionPanel').is_visible()
            assert page.locator('#unitFaction img').evaluate("img=>img.decode().then(()=>img.naturalWidth>0)")
            page.tap('#btnMenu');assert page.evaluate('PAD.G.paused')
            page.keyboard.press('ArrowUp');assert page.evaluate("PAD.G.phase === 'auction'")
            page.tap('#btnResume');assert page.locator('#menuLayer').is_hidden()
            page.tap('#btnMenu');page.tap('#btnQuit')
            check_menu(page)
        print(f'{width}x{height} title / hit test / hamburger / sound / close / help / both modes / return PASS', flush=True)
        page.close()
    browser.close()
