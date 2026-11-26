'use strict';
function showLotCard(key) {
  const d = LOTS[key], fac = FACTIONS[d.faction] || FACTIONS[d.kind==='gear'?'tech':'holy'];
  $('unitName').textContent = d.name;
  $('unitRarity').textContent = d.rarity === 1 ? '★ 일반' : d.rarity === 2 ? '★★ 희귀' : '★★★ 전설';
  $('unitRarity').className = 'unit-rarity ' + (d.rarity === 1 ? '' : d.rarity === 2 ? 'rare' : 'legend');
  $('unitFaction').querySelector('img').src = 'icons/' + fac.key + '.svg';
  $('unitFaction').querySelector('span').textContent = d.kind?lotLabel(key):fac.name;
  $('unitFaction').style.background = fac.color;
  $('unitCost').textContent = '가치 ' + d.cost + 'G';
  const dps = Math.round(d.dmg / d.rate);
  $('unitStat').textContent = d.kind?(d.kind==='gear'?'유닛 장착':'보유 즉시 발동'):`공 ${d.dmg} · ${d.rate}초 · DPS ${dps}`;
  let desc = d.desc;
  if (d.splash) desc += ` (범위 ${d.splash})`;
  if (d.slow) desc += ' · 슬로우';
  if (d.poison) desc += ' · 독';
  if (d.chain) desc += ' · 연쇄 3';
  $('unitDesc').textContent = desc;
  drawUnitPreview(key,0);
}

function drawUnitPreview(key,time) {
  const c = $('unitPreview'), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#241b3c'; g.fillRect(0, 0, c.width, c.height);
  const spr = ART.sprite(key);
  if (spr) {
    const s = 5;
    const bob = Math.sin(time * 3) * 2;
    g.drawImage(spr, Math.round((c.width - 16 * s) / 2), Math.round((c.height - 16 * s) / 2 + bob), 16 * s, 16 * s);
  }
}

