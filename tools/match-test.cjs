const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const sources=['js/data.js','js/combat.js','server/match.js'].map(k=>fs.readFileSync(path.join(root,k),'utf8')).join('\n');
const api=vm.runInNewContext(sources+'\n;({makeMatch,advance,act,view})');
for(const mode of ['coop','survival']){
  const seats=Array.from({length:4},(_,i)=>({name:'P'+i,online:true,token:'seat'+i,seq:0}));
  const room={code:'ABCD',host:0,mode,seats,expires:1800000};
  let now=0;room.game=api.makeMatch(room,mode,0,123);
  function input(i,t,props){return api.act(room,i,{wave:room.game.wave,t,...props},now);}
  assert(input(0,'confirm',{amount:13}));assert(!input(0,'bid',{amount:7}));
  assert.equal(api.view(room,2,now).ownOffer.amount,0);
  assert(!JSON.stringify(api.view(room,2,now)).includes('"amount":13'));
  assert(!input(2,'move',{unit:1,slot:0}));
  for(let i=1;i<4;i++)assert(input(i,'confirm',{amount:i===1?13:0}));
  api.advance(room,now);assert.equal(room.game.phase,'reveal');
  assert.equal(room.game.history[0].outcome.type,'unsold');
  assert(room.game.players.every(p=>p.gold===30));
  let prev=0;
  while(room.game.phase!=='result'&&now<1500000){
    now+=500;const G=room.game;
    if(G.phase==='auction'&&G.wave!==prev){
      prev=G.wave;
      for(let i=0;i<4;i++)if(G.players[i].field.alive){
        const player=G.players[i],bidder=(G.wave%4)===i;
        input(i,'confirm',{amount:bidder?Math.min(12,player.gold):0});
      }
    }
    if(G.phase==='battle')for(let i=0;i<4;i++){
      const u=G.players[i].field.units.find(u=>u.owner===i&&u.star<3);
      if(u)input(i,'upgrade',{unit:u.uid});
    }
    api.advance(room,now);
    if(G.phase==='battle')JSON.stringify(api.view(room,1,now));
  }
  assert.equal(room.game.phase,'result');assert.equal(room.game.wave,10);
  console.log(mode,room.game.wave,room.game.coreHp,room.game.players.map(p=>[p.field.lives,p.stats.kills]));
}
