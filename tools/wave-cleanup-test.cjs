const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = ['js/data.js', 'js/combat.js', 'server/match.js']
  .map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
const {makeMatch, roomCombat, view} = vm.runInNewContext(source+';({makeMatch,roomCombat,view})');
for (const mode of ['survival', 'coop']) {
  const room = {mode, marketVersion:4, seats:Array.from({length:4}, (_,i)=>({name:'P'+i, online:true}))};
  const g = room.game = makeMatch(room, mode, 0, 123);
  const sim = roomCombat(g);
  sim.prepareBattle();
  g.phase = 'battle';
  const field = g.players[0].field;
  field.queue.length = 0;
  const enemy = sim.spawnEnemy(field,'slime');
  const archer = field.units[0];
  enemy.x = archer.x; enemy.y = archer.y; enemy.hp = 1;
  sim.fire(field, archer, enemy);
  sim.fire(field, archer, enemy);
  archer.recoil = 1;
  sim.updateField(field, 0.1);
  assert.equal(g.players[archer.owner].stats.kills, 1);
  assert.equal(field.cleared, true);
  for (const effect of ['fx','nums','parts','shots']) assert.equal(field[effect].length,0,mode+' '+effect);
  assert.equal(archer.recoil,0);
  if(mode==='survival') assert.equal(g.players[1].field.active,true);
  assert.equal(view(room,0,0).fields[0].shots.length,0);
  sim.prepareBattle();
  const poisoned = sim.spawnEnemy(field,'slime');
  field.queue.length=0;
  poisoned.hp=1; poisoned.poisonT=1; poisoned.poisonDps=100; poisoned.poisonOwner=0;
  sim.updateField(field,0.1);
  assert.equal(field.active,false);
  assert.equal(field.enemies.length,0);
  assert.equal(field.fx.length,0);
  console.log(mode+' final kill, clean field, personal kill credit PASS');
}
