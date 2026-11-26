const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = ['js/data.js','js/combat.js','server/match.js'].map(file => fs.readFileSync(path.join(__dirname,'..',file),'utf8')).join('\n');
const rules = vm.runInNewContext(source+';({makeMatch,roomCombat,view,act,GATE_PATHS})');
function match(mode='coop',version=4){
  const seats=Array.from({length:4},(_,i)=>({name:String(i),online:true,token:'seat'+i}));
  const room={code:'TEST',marketVersion:version,mode,seats};
  room.game=rules.makeMatch(room,mode,0,121);
  return room;
}
const room=match(),g=room.game,sim=rules.roomCombat(g),f=g.arena;
g.wave=5;g.phase='battle';sim.prepareBattle();sim.prepareBattle();
assert.equal(f.gateHistory.length,1);
assert.equal(rules.view(room,0,0).gateHistory.length,0);
const initial=g.coreHp=5;f.shield=3;
function leak(type,route,power,extra={}){
  const e=sim.spawnEnemy(f,type);
  Object.assign(e,{route,leak:power},extra);
  sim.coreLeak(f,e);sim.coreLeak(f,e);
}
leak('ghost',0,2);leak('kingslime',2,3,{gateBoss:true});leak('armored',1,3);leak('slime',3,1);
g.phase='result';
const row=rules.view(room,2,0).gateHistory[0];
assert.deepEqual(Array.from(row.gates,x=>x.damage),[0,4,1,0]);
assert.equal(row.gates[0].blocked,3);assert.equal(row.gates[0].enemies.ghost,1);
assert.equal(row.gates[2].enemies.kingslime,1);assert.equal(row.gates[1].enemies.armored,1);
assert.equal(Object.keys(row.gates[3].enemies).length,0);
assert.equal(initial-g.coreHp,row.gates.reduce((total,x)=>total+x.damage,0));
g.wave=10;g.phase='battle';sim.prepareBattle();g.coreHp=30;f.shield=0;
leak('slime',3,1,{small:true});sim.checkpointRecovery();g.phase='waveend';
assert.equal(g.coreHp,43);assert.equal(f.gateHistory[1].gates[3].damage,2);
assert.equal(f.gateHistory[1].gates[3].enemies.smallSlime,1);
g.wave++;g.phase='auction';assert.equal(rules.view(room,0,0).gateHistory.length,2);
sim.prepareBattle();g.phase='battle';assert.equal(rules.view(room,0,0).gateHistory.length,2);
g.phase='waveend';assert(f.gateHistory[2].gates.every(x=>x.damage===0));
for(const sample of [match('survival'),match('coop',2)]){
  rules.roomCombat(sample.game).prepareBattle();sample.game.phase='waveend';
  assert.equal(rules.view(sample,0,0).gateHistory.length,0);
}
console.log('Gate leaks, shields, overkill, duplicate and post-loss leaks, boss, offspring, checkpoint, settled and legacy history PASS');
for(const mode of ['coop','survival']){
 const r=match(mode),g=r.game,p=g.players[0],s=rules.roomCombat(g),u=s.playerSlots(p).find(x=>x.unit).unit;
 g.phase='battle';u.star=2;p.relics=['banner','compass','clock'];p.augments=['precision','haste'];
 const empty=s.playerSlots(p).filter(x=>!x.unit);s.createUnit(p,'scout',empty[0]);s.createUnit(p,'alchemist',empty[1]);s.recomputeField(p.field);
 p.bag=['scope','spring','blade','lens','scope'];assert(s.equip(p,u.uid,'spring'));
 for(const key of ['scope','lens','blade',null,'spring']){
  const before=JSON.stringify([u.gear,p.bag]);
  const data=rules.view(r,0,0).inventory.units.find(x=>x.id===u.uid);
  const expected=data.projected[key||'empty'];
  assert(!rules.view(r,1,0).inventory.units.some(x=>x.id===u.uid));
  assert.equal(JSON.stringify([u.gear,p.bag]),before);
  assert(rules.act(r,0,{t:'equip',wave:g.wave,unit:u.uid,key},0));
  assert.equal(expected.range,s.unitRange(u));assert.equal(expected.interval,s.unitRate(u));assert.equal(expected.damage,s.unitDamage(u));
 }
}
console.log('Both modes: private unit previews equal real combat stats on equip, swap and unequip with stars, relics, traits and augments PASS');
