const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const code = ['js/data.js','js/combat.js','server/match.js'].map(f => fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n');
const api = vm.runInNewContext(code+'\n;({makeMatch,roomCombat,view,bidPreviewText})');
for (const mode of ['survival','coop']) {
  const room = {mode,code:'ABCD',seats:[0,1,2,3].map(i=>({name:String(i),online:true}))};
  const g = room.game = api.makeMatch(room, mode, 0, 7);
  const p = g.players[0], sim = api.roomCombat(g);
  const own = sim.playerSlots(p);
  function check(key, kind, synergy) {
    g.key = key;
    const before = [p.gold,g.uid,p.field.units.length,g.seed];
    const preview = api.view(room,0,0).lotPreview;
    assert.deepEqual([p.gold,g.uid,p.field.units.length,g.seed],before);
    assert.equal(preview.kind,kind);
    assert.equal(Boolean(preview.synergy),synergy);
    const text = api.bidPreviewText(key,p.gold,12,preview);
    assert.equal(api.bidPreviewText(key,p.gold,0,preview),'패스 시 잔액 '+p.gold+'G');
    p.gold -= 12;
    const result = sim.acquireUnit(p,key);
    assert.equal(result.kind,kind);
    assert.ok(text.includes('잔액 '+p.gold+'G'));
    if(kind==='merged') assert.equal(preview.star,result.unit.star);
    if(synergy) for(const change of preview.synergy.split(' · ')) assert.ok(p.field.synLabels.some(l=>l.startsWith(change.replace(' 활성','')+' ·')));
    if(kind==='sold') assert.equal(preview.refund,result.refund);
    p.gold=30;
  }
  check('archer','merged',false);
  check('archer','merged',false);
  check('cannoneer','placed',true);
  check('drone','placed',true);
  for(const slot of own.filter(s=>!s.unit))sim.createUnit(p,'firemage',slot);
  sim.recomputeField(p.field);
  check('thunder','sold',false);
  check('archer','sold',false);
  check('cannoneer','merged',false);
  if(mode==='coop') {
    const q=g.players[1], free=sim.playerSlots(q).find(s=>!s.unit);
    sim.createUnit(q,'cannoneer',free);
    const lot=sim.lotPreview(q,'drone');
    assert.equal(lot.kind,'placed');assert.equal(lot.synergy,'');
  }
  console.log(mode,'pass, place, merge, full board refund, 3-star, shared field thresholds, projection vs settlement PASS');
}
