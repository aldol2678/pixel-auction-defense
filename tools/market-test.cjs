const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=['js/data.js','js/combat.js','server/match.js'].map(s=>fs.readFileSync(path.join(__dirname,'..',s),'utf8')).join('\n');
const api=vm.runInNewContext(source+'\n;({makeMatch,roomCombat,advance,act,view,UNIT_KEYS,LOTS,GEAR,RELICS,AUGMENTS,ROSTER})',{crypto:require('node:crypto').webcrypto});
function room(mode,seed){
 const r={mode,host:0,code:'ABCD',seats:Array.from({length:4},(_,i)=>({online:true,token:'p'+i,name:'p'+i}))};
 r.game=api.makeMatch(r,mode,0,seed);return r;
}
const all=new Set();
for(let seed=1;seed<=128;seed++){
 const g=room('coop',seed).game, deck=[g.key,...g.deck], kinds=deck.map(k=>api.LOTS[k].kind||'unit');
 assert.equal(new Set(deck).size,10);
 for(const [kind,n] of [['unit',6],['gear',2],['relic',2]])assert.equal(kinds.filter(k=>k===kind).length,n);
 deck.forEach(k=>all.add(k));
}
assert.equal(all.size,22);assert.equal(api.UNIT_KEYS.length,15);
for(const mode of ['coop','survival']){
 const r=room(mode,7),g=r.game,s=api.roomCombat(g),p=g.players[0],q=g.players[1],u=p.field.units.find(u=>u.owner===0);
 function action(i,t,extras={}){return api.act(r,i,{t,wave:g.wave,...extras},0);}
 assert.equal(p.field.traits.shooter,1);
 for(const key of api.UNIT_KEYS){assert.equal(api.ROSTER[key].length,2);assert.ok(api.LOTS[key].dmg>0);}
 // Resolve gear, relic, and a tied item through the same auction settlement.
 for(const [key,prices] of [['scope',[9,1,0,0]],['banner',[8,1,0,0]],['blade',[4,4,0,0]]]){
   g.phase='auction';g.key=key;g.offers=r.seats.map(()=>({amount:0,locked:false}));
   prices.forEach((amount,i)=>assert(action(i,'confirm',{amount})));api.advance(r,0);
   assert.equal(g.phase,'reveal');
 }
 assert.equal(p.gold,13);assert.deepEqual([...p.bag],['scope']);assert.deepEqual([...p.relics],['banner']);
 for(const phase of ['reveal','waveend']){
   g.phase=phase;
   assert(action(0,'equip',{unit:u.uid,key:'scope'}));assert(!action(0,'upgrade',{unit:u.uid}));
   assert(action(0,'equip',{unit:u.uid,key:null}));
 }
 g.phase='result';assert(!action(0,'equip',{unit:u.uid,key:'scope'}));
 g.phase='battle';const base=s.unitRange(u);assert(!action(1,'equip',{unit:u.uid,key:'scope'}));
 assert(action(0,'equip',{unit:u.uid,key:'scope'}));assert.equal(s.unitRange(u),base+28);
 assert(!action(0,'equip',{unit:u.uid,key:'scope'}));
 assert(action(0,'equip',{unit:u.uid,key:null}));assert.equal(s.unitRange(u),base);
 assert(action(0,'equip',{unit:u.uid,key:'scope'}));s.acquireUnit(p,'spring');assert(action(0,'equip',{unit:u.uid,key:'spring'}));
 assert.deepEqual([...p.bag],['scope']);assert(s.unitRate(u)<api.LOTS.archer.rate);
 assert(Math.abs(s.unitDamage(u)-7*1.16)<1e-8);
 s.acquireUnit(p,'archer');assert.equal(u.gear,'spring');assert(action(0,'sell',{unit:u.uid}));assert(p.bag.includes('spring'));
 g.wave=5;const f=p.field;
 const leak=s.spawnEnemy(f,'kingslime');if(mode==='coop')s.coreLeak(f,leak);else s.leak(f,leak);
 assert.equal(p.choices.length,0);
 assert.equal(api.view(r,0,0).lastBoss.killed,false);
 for(const wave of [5,10]){
   g.wave=wave;g.phase='battle';g.lastStep=0;
   const boss=s.spawnEnemy(f,'kingslime');s.killEnemy(f,boss);
   assert.equal(api.view(r,0,0).lastBoss.wave,wave);assert.equal(api.view(r,0,0).lastBoss.killed,true);
   assert.equal(Boolean(api.view(r,1,0).lastBoss),mode==='coop');
   assert.equal(new Set(p.choices).size,3);assert(p.choices.every(k=>!p.augments.includes(k)));
   const offers=[...p.choices];s.killEnemy(f,boss);assert.deepEqual([...p.choices],offers);
   assert.equal(q.choices.length,mode==='coop'?3:0);
   api.advance(r,100);assert.equal(g.phase,'augment');
   assert(!action(0,'augment',{key:'invalid'}));assert(action(0,'augment',{key:offers[1]}));assert(!action(0,'augment',{key:offers[1]}));
   if(mode==='coop'){api.advance(r,200);assert.equal(g.phase,'augment');}
   api.advance(r,21100);assert.equal(g.phase,'battle');
   if(wave===10)assert(f.enemies.filter(e=>e.type==='armored'&&!e.dead).length>=3);
 }
 assert.equal(p.augments.length,2);
 g.phase='result';r.seats.forEach(s=>s.ready=true);api.advance(r,22000);
 assert(r.game.players.every(p=>!p.augments.length&&!p.bag.length&&!p.relics.length));
 console.log(mode,'market settlement, gear swap/sale, range, relic ownership, boss kill/leak, choice, timeout, final guard and rematch PASS');
}
console.log('128 seeded decks, 15 units, 4 gear, 3 relics PASS');
{
 const r=room('survival',19),g=r.game,s=api.roomCombat(g),p=g.players[0],f=p.field;
 function add(k){return s.acquireUnit(p,k).unit;}
 const archer=f.units[0];add('cannoneer');add('drone');add('paladin');
 assert.equal(s.income(p),2);assert.equal(s.unitRange(archer),128);
 assert.equal(s.unitRate(archer),api.LOTS.archer.rate*.85);
 add('frostgolem');s.prepareBattle();assert.equal(f.shield,1);
 const hp=f.lives;s.leak(f,s.spawnEnemy(f,'slime'));assert.equal(f.lives,hp);assert.equal(f.shield,0);
 s.leak(f,s.spawnEnemy(f,'slime'));assert.equal(f.lives,hp-1);
}
{
 const r=room('survival',21),g=r.game,s=api.roomCombat(g),p=g.players[0],f=p.field;
 const warden=s.acquireUnit(p,'warden').unit;s.acquireUnit(p,'firemage');
 const target=s.spawnEnemy(f,'slime');target.hp=1000;
 s.fire(f,warden,target);assert.equal(target.hp,988);s.fire(f,warden,target);assert(Math.abs(target.hp-(988-12*1.08))<1e-6);
 const thunder=s.acquireUnit(p,'thunder').unit;s.acquireUnit(p,'drone');
 const armored=s.spawnEnemy(f,'armored');armored.hp=1000;f.enemies=[armored];
 for(let i=1;i<=3;i++){const hp=armored.hp;s.fire(f,thunder,armored);assert(Math.abs(hp-armored.hp-(16*(i===3?1.2:1)-1))<1e-6);}
}
console.log('Six traits: income, range/rate, per-wave shield, elemental mark, workshop armor and caster counter PASS');
