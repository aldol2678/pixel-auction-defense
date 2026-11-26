"""Build the deployable Cloudflare module using only Python's standard library."""
import base64
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Both modes ship the same match markup. Room entry and networking are online-only.
solo = (ROOT / 'index.html').read_text()
match = solo[solo.index('<div id="app">'):solo.index('<script src=')]
shell = (ROOT / 'tools/online-shell.html').read_text()
(ROOT / 'online.html').write_text(shell.replace('<!-- MATCH -->', match.replace('<div id="app">','<div id="app" hidden>')))
assets = {}
asset_paths = ['index.html', 'online.html', 'style.css', 'online.css', 'kit.css', 'js/art.js',
             'js/data.js', 'js/combat.js', 'js/sound.js', 'js/placement.js', 'js/loadout.js', 'js/auction-ui.js', 'js/game.js', 'js/online.js']
asset_paths += [path.relative_to(ROOT).as_posix() for path in sorted((ROOT / 'icons').glob('*.svg'))]
for path in asset_paths:
    content = (ROOT / path).read_bytes()
    mime = {'html':'text/html', 'css':'text/css', 'js':'text/javascript', 'svg':'image/svg+xml'}[path.split('.')[-1]]
    assets['/'+path] = [mime+'; charset=utf-8', base64.b64encode(gzip.compress(content, mtime=0)).decode()]
source = 'const ASSETS = '+json.dumps(assets,separators=(',',':'))+';\n'
source += """
function serveAsset(path,method){
  if(method!=='GET' && method!=='HEAD')return new Response(null,{status:405});
  const key=path==='/'?'/index.html':path==='/online'?'/online.html':path;
  if(!Object.hasOwn(ASSETS,key))return new Response('Not found',{status:404});
  const [mime,data]=ASSETS[key];
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  return new Response(method==='HEAD'?null:new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
    {headers:{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
"""
for file in ['js/data.js', 'js/combat.js', 'server/match.js', 'server/worker.js']:
    source += '\n'+(ROOT / file).read_text()+'\n'
out = ROOT / 'dist' / 'worker.mjs'
out.parent.mkdir(exist_ok=True)
out.write_text(source)
print(out, out.stat().st_size)
