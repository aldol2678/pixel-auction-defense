const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const source=['js/data.js','js/combat.js','server/match.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n');
const a=vm.runInNewContext(source+'\n;({makeMatch,view,advance,act,roomCombat,LOTS,WAVES,MAX_WAVES,bossStance,ENEMIES,BOTS,lotAdvice})',{crypto:require('node:crypto').webcrypto});
function room(mode,version,seed=123){
  const r={mode,marketVersion:version,code:'ABCD',roundId:0,seats:Array.from({length:4},(_,i)=>({name:'P'+i,online:true,token:'test'+i}))};
  r.game=a.makeMatch(r,mode,0,seed);return r;
}
for(const version of [0,1,2]) {
  const r=room('survival',version),g=r.game,length=version===2?20:10;
  if(version===1)delete g.maxWaves; // saved pre-update state
  let forecast,section=[];
  for(let wave=1;wave<=length;wave++){
    const snapshot=a.view(r,0,wave);
    assert.equal(snapshot.wave,wave);assert.equal(snapshot.maxWaves,length);
    if(wave>1)assert.equal(snapshot.key,forecast);
    forecast=snapshot.nextKey;assert.equal(forecast===null,wave===length);
    section.push(snapshot.key);
    if(wave%10===0){
      assert.equal(new Set(section).size,10);
      if(version>0){const kinds=section.map(k=>a.LOTS[k].kind||'unit');assert.deepEqual(['unit','gear','relic'].map(k=>kinds.filter(v=>v===k).length),[6,2,2]);}
      section=[];
    }
    g.phase='waveend';g.deadline=0;a.advance(r,wave);
  }
  assert.equal(g.phase,'result');
  r.seats.forEach(s=>s.ready=true);a.advance(r,50000);
  assert.equal(r.game.wave,1);assert.equal(a.view(r,0,50000).maxWaves,length);
}
for(const mode of ['survival','coop']) {
  for(const version of [1,2]){
    const {game:g}=room(mode,version),sim=a.roomCombat(g),p=g.players[1];
    for(let wave=1;wave<=g.maxWaves;wave++){
      g.wave=wave;
      for(const [type,def] of Object.entries(a.ENEMIES)){
        const e=sim.spawnEnemy(p.field,type);
        const growth=1+.30*Math.min(9,wave-1)+.13*Math.max(0,wave-10);
        assert.equal(e.maxHp,Math.round(def.hp*(growth*(mode==='coop'?1.5:1))*(version===2?.85:1)));
        assert.equal(e.hp,e.maxHp);
      }
    }
    if(mode==='survival'){
      p.field.alive=false;
      assert.equal(sim.botBid(a.BOTS[0],p,{key:'archer'}),0);
    }
    const merge=sim.lotPreview(p,'archer');
    assert.match(a.lotAdvice(merge),/합성/);
  }
}
console.log('Wave HP for all enemies and modes, legacy HP, eliminated bot and merge preview PASS');
for(const mode of ['coop','survival']) {
  const r=room(mode,2),g=r.game,s=a.roomCombat(g),p=g.players[0],f=p.field;
  for(const wave of [5,10,15,20]){
    g.wave=wave;f.enemies=[];
    const e=s.spawnEnemy(f,'kingslime');
    if(wave===15){
      assert.equal(a.bossStance(e),'shield');let hp=e.hp;s.damageEnemy(f,e,100,{ignoreArmor:true});assert.equal(hp-e.hp,65);
      e.t=2;hp=e.hp;s.damageEnemy(f,e,100,{ignoreArmor:true});assert.equal(hp-e.hp,100);
    }
    if(wave===20){
      s.damageEnemy(f,e,e.hp*.52,{ignoreArmor:true});assert.equal(a.bossStance(e),'enraged');
      assert.equal(f.enemies.filter(x=>x.type==='ghost').length,2);s.damageEnemy(f,e,1,{ignoreArmor:true});
      assert.equal(f.enemies.filter(x=>x.type==='ghost').length,2);
      f.queue=[];f.active=true;e.x=10;e.y=e.lane=180;e.speed=20;const x=e.x;s.updateField(f,.1);
      assert(Math.abs(e.x-x-2.7)<1e-6);
    }
    s.killEnemy(f,e);assert.equal(new Set(p.choices).size,3);assert(p.choices.every(k=>!p.augments.includes(k)));
    s.chooseAugment(p,p.choices[0]);
    if(wave===20)assert.equal(f.enemies.filter(e=>e.type==='armored').length,3);
  }
  assert.equal(p.augments.length,4);
  for(const wave of [10,15]){
    g.wave=wave;g.coreHp=49;f.lives=6;
    g.players[1].field.alive=mode==='coop';
    s.checkpointRecovery();
    if(mode==='coop')assert.equal(g.coreHp,60);else {assert.equal(f.lives,10);assert(!g.players[1].field.alive);}
  }
}
console.log('New/legacy lengths, rematch, all forecasts, 6/2/2 per chapter, four distinct augments, checkpoints, shields, final summons and haste PASS');
function play(mode,seed,version=2) {
  const r=room(mode,version,seed),g=r.game,seen=new Set(),augs=[];
  for(let now=0;now<1500000 && g.phase!=='result';now+=500){
    const act=(p,t,extra)=>a.act(r,p.id,{t,wave:g.wave,...extra},now);
    if(g.phase==='auction') {
      seen.add(g.wave);
      const alive=g.players.filter(p=>p.field.alive);
      const bidder=alive[(g.wave-1)%alive.length];
      for(const p of alive)if(!g.offers[p.id].locked)act(p,'confirm',{amount:p===bidder?Math.min(5,p.gold):0});
    }
    if(g.phase==='battle')for(const p of g.players){
      if(!p.field.alive)continue;
      const own=p.field.units.filter(u=>u.owner===p.id);
      if(p.bag.length && own.some(u=>!u.gear))act(p,'equip',{unit:own.find(u=>!u.gear).uid,key:p.bag[0]});
      const u=own.find(u=>u.star<3);
      if(u && p.gold>=(u.star===1?12:22))act(p,'upgrade',{unit:u.uid});
    }
    if(g.phase==='augment')for(const p of g.players)if(p.choices.length){
      augs.push([g.wave,p.id]);act(p,'augment',{key:p.choices[0]});
    }
    a.advance(r,now);
  }
  assert.equal(g.phase,'result');
  return {wave:g.wave,won:g.wave===20&&(mode==='coop'?g.coreHp>0:g.players.some(p=>p.field.alive)),augs:[...new Set(augs.map(x=>x[0]))],history:g.history.length};
}
for(const mode of ['coop','survival']){
  const trials=[7,13,37,123,569,867].map(seed=>play(mode,seed));
  console.log(mode,JSON.stringify(trials));
  assert(trials.some(t=>t.won && t.history===20));
}

for(const mode of ['survival','coop']){
 const trials=[7,13,37,123,569,867].map(seed=>play(mode,seed,3));console.log('new routes',mode,JSON.stringify(trials));
 assert(trials.some(t=>t.won && t.history===20));
}

for(const mode of ['coop','survival']){
  const results=[7,13,37,123,569,867].map(seed=>play(mode,seed,4));
  console.log('Four-gate release',mode,JSON.stringify(results));
  assert(results.some(t=>t.history===20 && t.won));
}
