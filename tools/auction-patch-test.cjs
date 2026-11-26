const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const code=['js/data.js','js/combat.js','server/match.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n');
const {makeMatch,roomCombat,view,advance,bidComparison,chargeStage,auctionForecast}=
  vm.runInNewContext(code+'\n;({makeMatch,roomCombat,view,advance,bidComparison,chargeStage,auctionForecast})',{crypto:require('node:crypto').webcrypto});
for(const mode of ['survival','coop']){
 const seats=Array.from({length:4},(_,i)=>({online:true,name:'P'+i,token:'s'+i,seq:18}));
 const room={mode,seats,code:'ABCD',expires:1800000},G=room.game=makeMatch(room,mode,0,123);
 const sim=roomCombat(G);
 let previous;
 for(let wave=1;wave<=10;wave++){
   if(previous)assert.equal(G.key,previous);
   const snapshot=view(room,1,100);
   assert(!('deck' in snapshot));assert(!('offers' in snapshot));
   for(let i=0;i<4;i++)assert.equal(snapshot.nextKey,view(room,i,100).nextKey);
   if(wave===10)assert.equal(snapshot.nextKey,null);
   previous=snapshot.nextKey;
   G.phase='waveend';G.deadline=0;advance(room,100);
 }
 const f=G.players[0].field;
 G.wave=5;const split=sim.spawnEnemy(f,'kingslime');
 split.x=200;split.y=90;assert.equal(split.pattern,'split');
 sim.damageEnemy(f,split,split.hp*3,{credit:0});sim.killEnemy(f,split);
 const children=f.enemies.filter(e=>e.small);
 assert.equal(children.length,3);assert(children.every(e=>e.x===200 && e.hp===e.maxHp && e.hp<split.maxHp));
 assert.equal(new Set(children.map(e=>e.netId)).size,3);
 for(const phase of [2,3.3,4.05]){
   G.wave=10;const field=sim.makeField(0,mode);field.active=true;
   const e=sim.spawnEnemy(field,'kingslime');e.x=80;e.y=e.lane=180;e.t=phase;e.speed=20;e.slowT=1;e.slowAmt=0.5;
   sim.updateField(field,0.1);assert.equal(e.pattern,'charge');
   assert(Math.abs((e.x-80)-(phase>4?2.2:1))<1e-6);
 }
 G.phase='result';seats[0].ready=true;seats[1].ready=true;advance(room,102);
 assert.equal(room.game,G);seats[2].ready=true;seats[3].online=false;advance(room,105);
 assert.equal(room.roundId,1);assert.equal(room.code,'ABCD');assert.equal(room.game.wave,1);assert.equal(room.game.history.length,0);
 assert(room.game.players.every(p=>p.gold===30 && p.stats.kills===0));
 assert(seats.every((s,i)=>!s.ready && s.seq===18 && s.token==='s'+i));
 console.log(mode+': one-lot forecast for 10 waves, secret bids, split once, distinct IDs, telegraph/dash with slow, rematch quorum and reset PASS');
}
assert.equal(chargeStage(3.3),'warn');assert.equal(chargeStage(4.1),'dash');assert.equal(chargeStage(5),'');
assert.equal(bidComparison([17,16,16,0],{type:'sold',winner:0,price:17}),'2위 16G · 1G 차이');
assert.equal(bidComparison([0,0,3,0],{type:'sold',winner:2,price:3}),'단독 입찰');
assert.equal(bidComparison([8,8,0,0],{type:'unsold'}),'');
assert.equal(bidComparison([0,0,0,0],{type:'pass'}),'');
assert(auctionForecast(9,'archer').includes('돌격왕'));assert(auctionForecast(4,'archer').includes('분열왕'));
console.log('runner-up tie, sole bidder, unsold, pass, pre-boss hints PASS');
