const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=['js/data.js','js/combat.js','server/match.js'].map(f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8')).join('\n');
const a=vm.runInNewContext(src+';({makeMatch,roomCombat,FORK_PATHS,GATE_PATHS,forkFor,walkRoute})');
const length=pts=>pts.slice(1).reduce((n,[x,y],i)=>n+Math.hypot(x-pts[i][0],y-pts[i][1]),0);
assert.equal(length(a.FORK_PATHS[0]),length(a.FORK_PATHS[1]));
assert(a.GATE_PATHS.every(p=>Math.abs(length(p)-length(a.GATE_PATHS[0]))<1e-8));
function setup(mode,version,seed=42){
 const r={marketVersion:version,seats:[0,1,2,3].map(i=>({name:'test'+i,online:true}))};
 const g=a.makeMatch(r,mode,0,seed);return [g,a.roomCombat(g)];
}
for(const mode of ['survival','coop']){
 const [g,s]=setup(mode,3),f=g.players[0].field;g.wave=20;s.prepareBattle();
 const boss=s.spawnEnemy(f,'kingslime'),points=(mode==='coop'?a.GATE_PATHS:a.FORK_PATHS)[boss.route];
 assert(!a.walkRoute(boss,points,100));s.damageEnemy(f,boss,boss.hp*.55,{ignoreArmor:true});
 for(const e of f.enemies.filter(e=>e.type==='ghost')){
   assert.equal(e.route,boss.route);assert.equal(e.nextPoint,boss.nextPoint);assert.equal(e.x,boss.x);
   assert(a.walkRoute(e,points,1000));assert.equal(e.y,points.at(-1)[1]);
 }
 g.wave=5;const split=s.spawnEnemy(f,'kingslime');s.killEnemy(f,split);
 assert(f.enemies.filter(e=>e.small).every(e=>e.route===split.route && e.nextPoint===split.nextPoint));
 const gates=Array.from({length:4},()=>s.spawnEnemy(f,'bat').route);
 if(mode==='coop')assert.equal(new Set(gates).size,4);
}
assert.equal(a.forkFor(6,'ghost'),0);assert.equal(a.forkFor(6,'bat'),1);
function bench(slot,seed,normalized){
 const [g,s]=setup('survival',3,seed),p=g.players[0],f=p.field;g.wave=6;s.prepareBattle();
 const u=s.createUnit(p,'lavagolem',f.slots[slot]);p.bag.push('spring');s.equip(p,u.uid,'spring');s.recomputeField(f);
 let first=null;
 for(let frame=0;frame<3600&&!f.cleared;frame++){
   // Equal-time control: scale individual travel speed once, at spawn.
   if(normalized)for(const e of f.enemies)if(!e.adjusted){e.speed*=length(a.FORK_PATHS[0])/432;e.adjusted=true;}
   s.updateField(f,1/30);
   if(first===null&&u.recoil>0)first=frame/30;
 }
 assert(f.cleared);return [first,14-f.lives];
}
for(const normalized of [false,true])for(const slot of [2,3,4,7]){
 const trials=Array.from({length:24},(_,i)=>bench(slot,i+1,normalized));
 console.log(normalized?'equal-travel-time':'actual', 'slot',slot,'avg first shot (s), leaks',...[0,1].map(i=>(trials.reduce((n,row)=>n+row[i],0)/trials.length).toFixed(2)));
}
console.log('Fork and gate geometry, spawn forecast, boss summons and W6 trials PASS');
