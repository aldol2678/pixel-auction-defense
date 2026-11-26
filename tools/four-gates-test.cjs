const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = ['js/data.js','js/combat.js','server/match.js'].map(file => fs.readFileSync(path.join(__dirname,'..',file),'utf8')).join('\n');
const rules = vm.runInNewContext(source+';({makeMatch,roomCombat,advance,act,view,GATE_PATHS})');
function room(version,mode='coop'){
  const seats=Array.from({length:4},(_,i)=>({name:String(i),online:true,token:'seat'+i}));
  const r={code:'TEST',marketVersion:version,mode,seats};
  r.game=rules.makeMatch(r,mode,100,321);
  return r;
}
for(const mode of ['coop','survival']){
  const r=room(4,mode),g=r.game;
  for(const time of [100,5099]){
    for(const t of ['bid','confirm'])assert.equal(rules.act(r,0,{t,wave:1,amount:19},time),false);
    rules.advance(r,time);assert.equal(g.phase,'auction');
  }
  assert.equal(g.deadline-g.opensAt,10000);
  for(let i=0;i<4;i++)assert(rules.act(r,i,{t:'confirm',wave:1,amount:i<2?19:0},5100));
  assert.equal(rules.view(r,2,5100).ownOffer.amount,0);
  rules.advance(r,5100);assert.equal(g.history[0].outcome.type,'unsold');
  assert(g.players.every(p=>p.gold===30));
  const old=room(3,mode);assert(rules.act(old,0,{t:'confirm',wave:1,amount:19},100));
  const sf=room(4,'survival');sf.game.wave=5;assert.equal(rules.roomCombat(sf.game).buildQueue().filter(t=>t==='kingslime').length,1);
}
for(const wave of [5,10,15,20]){
  const old=room(3),gOld=old.game;gOld.wave=wave;
  const oldSim=rules.roomCombat(gOld);oldSim.prepareBattle();
  assert.equal(gOld.arena.queue.filter(t=>t==='kingslime').length,1);
  const oldHP=oldSim.spawnEnemy(gOld.arena,'kingslime').maxHp;
  const test=room(4),g=test.game,sim=rules.roomCombat(g);g.wave=wave;sim.prepareBattle();
  const arena=g.arena;arena.queue=arena.queue.filter(t=>t==='kingslime');assert.equal(arena.queue.length,4);
  arena.spawnT=0;sim.updateField(arena,0);
  const bosses=arena.enemies.slice();assert.equal(bosses.length,4);
  for(let i=0;i<4;i++){
    const boss=bosses[i];assert.equal(boss.route,i);assert.equal(boss.gateBoss,true);
    assert.equal(boss.x,rules.GATE_PATHS[i][0][0]);assert.equal(boss.y,rules.GATE_PATHS[i][0][1]);
    if(wave===20)sim.damageEnemy(arena,boss,boss.hp*.55,{ignoreArmor:true});
  }
  const total=bosses.reduce((n,e)=>n+e.maxHp,0);assert(Math.abs(total-oldHP*.9)<=2);
  sim.coreLeak(arena,bosses[0]);assert.equal(g.coreHp,59);
  assert(!g.players.some(p=>p.choices?.length));sim.killEnemy(arena,bosses[1]);
  for(const p of g.players){assert.equal(p.choices.length,3);sim.chooseAugment(p,p.choices[0]);}
  sim.killEnemy(arena,bosses[2]);sim.coreLeak(arena,bosses[3]);
  assert.equal(arena.lastBoss.kills,2);assert.equal(arena.lastBoss.escapes,2);
  assert(g.players.every(p=>!p.choices.length && p.augments.length===1));
  if([10,20].includes(wave))assert.equal(arena.enemies.filter(e=>e.type==='armored').length,3);
  if(wave===20)assert.equal(arena.enemies.filter(e=>e.type==='ghost').length,2);
  console.log('W'+wave,'four gates, former HP',oldHP,'new combined HP',total,'single reward PASS');
}
for(const wave of [5,20]){
  for(const killAll of [true,false]){
    const g=room(4).game,sim=rules.roomCombat(g);g.wave=wave;sim.prepareBattle();
    const f=g.arena;f.queue=f.queue.filter(k=>k==='kingslime');f.spawnT=0;sim.updateField(f,0);
    for(const e of f.enemies.slice()){
      if(wave===20 && killAll)sim.damageEnemy(f,e,e.hp*.55,{ignoreArmor:true});
      if(killAll)sim.killEnemy(f,e);else sim.coreLeak(f,e);
    }
    assert.equal(g.coreHp,killAll?60:56);assert.equal(f.lastBoss.kills,killAll?4:0);
    assert(g.players.every(p=>killAll?p.choices.length===3:!p.choices?.length));
    if(wave===5 && killAll)assert.equal(f.enemies.filter(e=>e.small).length,3);
    if(wave===20 && killAll)assert.equal(f.enemies.filter(e=>e.type==='ghost').length,2);
  }
}
console.log('All escapes: 4 total damage, no augment. All kills: one offer per player; pooled summons PASS');
