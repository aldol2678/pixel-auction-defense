'use strict';
function nicknameField(id) {
  const input=document.getElementById(id), key='pixel-auction.nickname';
  try { input.value=playerNickname(localStorage.getItem(key)); } catch {}
  function save() {
    const name=playerNickname(input.value);
    try { localStorage.setItem(key,name); } catch {}
    return name;
  }
  input.addEventListener('input',save);
  input.addEventListener('change',()=>{input.value=save();});
  return save;
}

function traitButton(key,counts,withCategory=false) {
  const trait=TRAITS[key],count=counts?.[key]||0,tier=traitLevel(counts,key);
  const progress=tier?count+'종 · '+tier+'단계 활성':count+'/2종 · 대기';
  return '<button type="button" class="trait-tag" data-trait="'+key+'" aria-haspopup="dialog" data-active="'+!!tier+'">'+
    (withCategory?'<small>'+trait.category+'</small> ':'')+'<strong>'+trait.name+'</strong> <span>'+progress+'</span></button>';
}

function renderSynergies(counts, legacyLabels) {
  const row=document.getElementById('synRow');
  const active=[], pending=[];
  for(const [key, trait] of Object.entries(TRAITS)){
    const count=counts?.[key]||0;
    const tier=traitLevel(counts,key);
    if(tier){
      active.push('<li>'+traitButton(key,counts)+'<span>'+trait.effects[tier-1]+'</span></li>');
    }else if(count){
      pending.push(traitButton(key,counts));
    }
  }
  if(!counts)for(const label of legacyLabels||[])active.push('<li>'+label+'</li>');
  const html=(active.length?'<ul>'+active.join('')+'</ul>':'<p>같은 계열이나 직업의 서로 다른 유닛 2종을 모으면 활성화돼.</p>')+
    (pending.length?'<div class="trait-tags">'+pending.join('')+'</div>':'');
  if(row.dataset.last!==html){row.innerHTML=html;row.dataset.last=html;}
}

function loadoutUI(onEquip,onChoose,onInspect,boardUnitAt,fieldMembers) {
  const by=id=>document.getElementById(id);
  const panel=by('loadout'),dialog=by('augmentDialog'),options=by('augOptions');
  const portraits=new Map();
  const icon=key=>'icons/gear-'+key+'.svg';
  let offer='',sending=false,busy=false,model=null,chosen=null,holder=null,team=false;
  function html(node,value){if(node.dataset.last!==value){node.innerHTML=value;node.dataset.last=value;}}
  function portrait(key){
    if(!portraits.has(key))portraits.set(key,ART.sprite(key).toDataURL());
    return portraits.get(key);
  }
  const traitDialog=by('traitDialog');
  let openTrait=null;
  function paintTrait(){
    const trait=TRAITS[openTrait];
    const counts=model?.counts;
    if(!trait || !counts)return;
    const tier=traitLevel(counts,openTrait), count=counts[openTrait]||0;
    by('traitTitle').textContent=trait.name+' · '+trait.category;
    const members=fieldMembers().filter(u=>ROSTER[u.key].includes(openTrait));
    const lines=members.map(u=>{
      let effect='현재 효과 없음';
      if(tier){
        effect=trait.effects[tier-1];
        if(openTrait==='shooter' && u.interval>0)effect+=' · 현재 '+Number((1/u.interval).toFixed(2))+'회/초, 사거리 '+u.range;
        if(openTrait==='frontier')effect='소유자 정산 +'+tier+'G · 같은 소유자는 한 번만 지급';
        if(openTrait==='guard')effect='방어선의 보호막 활성에 기여 · 웨이브 시작 시 피해 '+tier+' 흡수';
      }
      const label=(u.mine?'내 유닛':(u.owner+1)+'P')+(u.mine && u.id===holder?' · 선택 중':'');
      return '<li><img src="'+portrait(u.key)+'" alt=""><div><strong>'+UNITS[u.key].name+' '+STAR[u.star].label+'</strong> <small>'+label+'</small><p>'+effect+'</p></div></li>';
    });
    const stages=trait.effects.map((effect,i)=>'<li class="'+(tier===i+1?'current':'')+'"><b>'+[2,trait.max][i]+'종'+(tier===i+1?' · 적용 중':'')+'</b><span>'+effect+'</span></li>').join('');
    html(by('traitBody'),'<p class="trait-status">현재 '+count+'종 · '+(tier?tier+'단계 활성':'활성까지 '+(2-count)+'종')+'</p>'+
      '<ul class="trait-stages">'+stages+'</ul><h3>배치 유닛별 효과</h3>'+
      (lines.length?'<ul class="trait-members">'+lines.join('')+'</ul>':'<p>이 시너지의 유닛이 아직 전장에 없어.</p>'));
  }
  document.getElementById('app').addEventListener('click',e=>{
    const button=e.target.closest('button[data-trait]');
    if(!button || !model?.counts || !Object.hasOwn(TRAITS,button.dataset.trait))return;
    openTrait=button.dataset.trait;paintTrait();traitDialog.showModal();
  });
  traitDialog.addEventListener('close',()=>{openTrait=null;});
  function comparison(wearer){
    if(!model?.canEquip || !wearer || (!chosen&&!wearer.gear))return null;
    const after=wearer.projected?.[chosen||'empty'];
    return after && wearer.current ? {before:wearer.current,after}:null;
  }
  function paint(){
    if(!model)return;
    const {bag,relics,augments,units,counts,canEquip}=model;
    if(chosen&&!bag.includes(chosen))chosen=null;
    const wearer=units.find(u=>u.id===holder);
    if(!wearer)holder=null;
    by('dragHint').hidden=!canEquip||!bag.length||!units.length;
    by('loadoutTitle').textContent='장비함 · 보관 '+bag.length;
    html(by('kitBag'),[...new Set(bag)].map(k=>{
      const n=bag.filter(v=>v===k).length;
      return '<button class="socket" data-gear="'+k+'" aria-label="'+GEAR[k].name+' 보관 '+n+'" aria-pressed="'+(chosen===k)+'"><img src="'+icon(k)+'" alt="">'+(n>1?'<small>×'+n+'</small>':'')+'</button>';
    }).join(''));
    html(by('kitUnits'),units.map(u=>{
      const title=UNITS[u.key].name+' · '+(u.gear?GEAR[u.gear].name:'빈 슬롯');
      return '<button class="socket" data-holder="'+u.id+'" title="'+title+'" aria-label="'+title+'" aria-pressed="'+(u.id===holder)+'"><img src="'+portrait(u.key)+'" alt="">'+(u.gear?'<img class="worn" src="'+icon(u.gear)+'" alt="">':'<i class="empty"></i>')+'</button>';
    }).join(''));
    const info=by('kitInfo');
    info.hidden=!chosen&&!wearer;
    const k=chosen||wearer?.gear;
    let detail=k?'<b>'+GEAR[k].name+'</b> · '+GEAR[k].desc:'미장착';
    if(wearer?.current){
      const def=UNITS[wearer.key], stats=wearer.current;
      const num=value=>String(Number(value.toFixed(2)));
      const gear=wearer.gear?GEAR[wearer.gear]:null;
      detail='<strong>'+def.name+' '+(STAR[wearer.star]?.label||'')+'</strong> · '+FACTIONS[def.faction].name+
        (counts?'<div class="trait-tags">'+ROSTER[wearer.key].map(key=>traitButton(key,counts,true)).join('')+'</div>'+
          ROSTER[wearer.key].filter(key=>traitLevel(counts,key)).map(key=>'<p class="unit-trait-effect"><b>'+TRAITS[key].name+'</b> · '+TRAITS[key].effects[traitLevel(counts,key)-1]+'</p>').join(''):'')+
        '<div class="unit-stats"><span>공격력 <b>'+num(stats.damage)+'</b></span><span>공격속도 <b>'+num(1/stats.interval)+'회/초</b></span><span>사거리 <b>'+num(stats.range)+'</b></span></div>'+
        '<p>장착 장비 · '+(gear?gear.name+' ('+gear.desc+')':'없음')+'</p>'+
        (chosen?'<p>선택 장비 · '+GEAR[chosen].name+'</p>':'');
    }
    if(chosen && !wearer)detail+=' · 장착할 유닛을 눌러줘';
    if(chosen && wearer?.gear)detail+='<p>교체 시 보관함으로 이동 · '+GEAR[wearer.gear].name+'</p>';
    const change=comparison(wearer);
    if(change){
      const {before,after}=change;
      const format=value=>Number(value.toFixed(2));
      detail+='<div class="kit-compare"><b>'+(chosen?'장착':'해제')+' 전 → 후</b>'+
        [['damage','공격력',''],['interval','공격 간격','초'],['range','사거리','']].map(([key,label,unit])=>
          '<span>'+label+' '+format(before[key])+unit+' → <strong>'+format(after[key])+unit+'</strong></span>').join('')+'</div>';
      if(before.range!==after.range)detail+='<p class="range-key"><span>민트 점선 · 현재</span> / <span>금색 점선 · 변경 후</span></p>';
    }
    if(canEquip && wearer && k)detail+='<button data-apply '+(busy?'disabled':'')+'>'+(chosen?(wearer.gear?'교체':'장착'):'해제')+'</button>';
    html(info,detail+'<button data-close>닫기</button>');
    by('teamToggle').setAttribute('aria-expanded',String(team));
    by('teamInfo').hidden=!team;
    if(team){
      const effects=(keys,defs)=>keys.map(k=>defs[k].name+' · '+defs[k].desc).join(' / ')||'없음';
      html(by('teamInfo'),'<p><b>유물</b> '+effects(relics,RELICS)+'</p><p><b>증강</b> '+effects(augments,AUGMENTS)+'</p>'+(model.inBattle?'':Object.entries(counts||{}).map(([k,n])=>'<p>'+traitButton(k,counts)+' '+(n<2?'':TRAITS[k].effects[traitLevel(counts,k)-1])+'</p>').join('')));
    }
  }
  panel.onclick=async e=>{
    const b=e.target.closest('button');if(!b||!model||busy)return;
    if(b.id==='teamToggle'){team=!team;chosen=null;holder=null;onInspect(null);}
    else if(b.dataset.gear){chosen=chosen===b.dataset.gear?null:b.dataset.gear;team=false;}
    else if(b.dataset.holder){holder=Number(b.dataset.holder);team=false;onInspect(holder);}
    else if(b.hasAttribute('data-close')){holder=null;chosen=null;onInspect(null);}
    else if(b.hasAttribute('data-apply')&&model.canEquip){
      busy=true;paint();
      try{await onEquip(holder,chosen);}finally{busy=false;chosen=null;}
    }
    paint();
  };
  const bagRow=by('kitBag');
  let drag=null, skipClick=false;
  function dropTarget(x,y){
    const node=document.elementFromPoint(x,y);
    const chip=node?.closest('[data-holder],[data-uid],#unitRow [data-id]');
    const id=chip?Number(chip.dataset.holder??chip.dataset.uid??chip.dataset.id):
      node===by('cv')?boardUnitAt(x,y):null;
    return model?.units.some(u=>u.id===id)?id:null;
  }
  function highlight(id){
    panel.querySelector('.drop-target')?.classList.remove('drop-target');
    if(id!=null)by('kitUnits').querySelector('[data-holder="'+id+'"]')?.classList.add('drop-target');
  }
  function clearDrag(){
    if(!drag)return;
    const pointer=drag.pointer;
    drag.ghost?.remove();highlight(null);drag=null;
    if(bagRow.hasPointerCapture(pointer))bagRow.releasePointerCapture(pointer);
  }
  bagRow.addEventListener('dragstart',e=>e.preventDefault());
  bagRow.addEventListener('pointerdown',e=>{
    const key=e.target.closest('[data-gear]')?.dataset.gear;
    if(!key||!model?.canEquip||busy||drag||!e.isPrimary||e.button!==0)return;
    skipClick=false;
    drag={pointer:e.pointerId,key,x:e.clientX,y:e.clientY,ghost:null};
  });
  window.addEventListener('pointermove',e=>{
    if(!drag || e.pointerId!==drag.pointer)return;
    if(!drag.ghost){
      if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
      bagRow.setPointerCapture(e.pointerId);
      const ghost=document.createElement('img');
      ghost.className='gear-drag';ghost.src=icon(drag.key);ghost.alt='';
      document.body.append(ghost);drag.ghost=ghost;
    }
    drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
    const target=dropTarget(e.clientX,e.clientY);
    highlight(target);drag.ghost.classList.toggle('ready',target!=null);
  });
  window.addEventListener('pointerup',async e=>{
    if(!drag||e.pointerId!==drag.pointer)return;
    const {key,ghost}=drag;
    const target=ghost?dropTarget(e.clientX,e.clientY):null;
    skipClick=!!ghost;clearDrag();
    if(target==null||busy||!model?.canEquip||!model.bag.includes(key))return;
    busy=true;chosen=null;holder=target;team=false;onInspect(target);paint();
    try{await onEquip(target,key);}finally{busy=false;paint();}
  });
  for(const event of ['pointercancel','lostpointercapture'])bagRow.addEventListener(event,e=>{
    if(e.pointerId===drag?.pointer && (event==="pointercancel"||e.target===bagRow))clearDrag();
  });
  window.addEventListener('blur',clearDrag);
  bagRow.addEventListener('click',e=>{if(skipClick){skipClick=false;e.stopPropagation();}},true);
  let signature='';
  function render(inventory,units,counts,phase,lastBoss,selection,lotKey){
    const playing=!!inventory && !['title','lobby'].includes(phase);
    panel.hidden=!playing;
    if(playing){
      model={bag:inventory.bag||[],relics:inventory.relics||[],augments:inventory.augments||[],units,counts,inBattle:phase==='battle',canEquip:equipmentPhase(phase)};
      const next=JSON.stringify(model);
      if(signature!==next || holder!==selection){signature=next;holder=selection??null;paint();}
    }else{signature='';model=null;holder=null;chosen=null;team=false;}
    const lot=by('lotTraits');
    lot.hidden=!(phase==='auction' && counts && ROSTER[lotKey]);
    if(!lot.hidden)html(lot,ROSTER[lotKey].map(key=>traitButton(key,counts,true)).join(''));
    if(traitDialog.open){
      if(!playing || !counts || ['augment','result'].includes(phase))traitDialog.close();
      else paintTrait();
    }
    const choices=phase==='augment'?inventory?.choices||[]:[];
    const nextOffer=choices.join(',');
    if(nextOffer!==offer){
      offer=nextOffer;sending=false;
      options.innerHTML=choices.map(k=>'<button data-aug="'+k+'"><strong>'+AUGMENTS[k].name+'</strong><span>'+AUGMENTS[k].desc+'</span></button>').join('');
    }
    if(choices.length){
      by('augTitle').textContent=(BOSS_PATTERNS[lastBoss?.wave]?.name||'보스')+' 처치 · 증강 선택';
      if(!dialog.open)dialog.showModal();
    }
    if(!choices.length && dialog.open)dialog.close();
  }
  dialog.oncancel=e=>e.preventDefault();
  options.onclick=async e=>{
    const btn=e.target.closest('[data-aug]');
    if(!btn||sending)return;
    sending=true;try{await onChoose(btn.dataset.aug);}finally{sending=false;}
  };
  render.drawGearRange=(ctx,slots)=>{
    if(holder===null || !model)return false;
    const change=comparison(model.units.find(u=>u.id===holder));
    if(!change || change.before.range===change.after.range)return false;
    const slot=slots.find(s=>(s.unit?.uid??s.unit?.id)===holder);
    if(!slot)return false;
    ART.drawRange(ctx,slot.x,slot.y,change.before.range);
    ART.drawRange(ctx,slot.x,slot.y,change.after.range,true);
    return true;
  };
  render.inspect=id=>{
    const own=model?.units.some(u=>u.id===id)?id:null;
    if(holder!==own){holder=own;team=false;paint();}
  };
  return render;
}

// Keep the last completed wave available through the next auction and battle.
const renderGateReport=(()=>{
  const box=document.getElementById('gateReport'),picker=document.getElementById('gateWave');
  const summary=document.getElementById('gateSummary'),details=document.getElementById('gateDetails');
  const buttons=GATE_NAMES.map(name=>{
    const item=document.createElement('details'),heading=document.createElement('summary'),body=document.createElement('p');
    item.append(heading,body);details.append(item);
    return {item,heading,body,name};
  });
  let history=[],latest=0,follow=true,signature='';
  function show(){
    const row=history.find(r=>r.wave===Number(picker.value));
    if(!row)return;
    const next=JSON.stringify(row);
    if(next===signature)return;
    signature=next;
    const damage=row.gates.reduce((sum,g)=>sum+g.damage,0);
    const hit=row.gates.map((g,i)=>g.damage?GATE_NAMES[i]+' −'+g.damage:'').filter(Boolean);
    summary.textContent='관문 기록 · W'+row.wave+' 코어 '+(damage?'−'+damage:'피해 0')+(hit.length?' · '+hit.join(' · '):'');
    row.gates.forEach((gate,i)=>{
      const {heading,body,name}=buttons[i];
      const leaks=Object.entries(gate.enemies);
      heading.textContent=name+' · 피해 '+gate.damage+' · 돌파 '+leaks.reduce((sum,[,n])=>sum+n,0)+'마리';
      const troops=leaks.map(([key,n])=>{
        const label=key==='smallSlime'?'분열 슬라임':ENEMIES[key]?.boss?BOSS_PATTERNS[row.wave]?.name:ENEMIES[key]?.name;
        return (label||key)+' ×'+n;
      });
      body.textContent=(troops.join(' · ')||'돌파한 적 없음')+(gate.blocked?' · 보호막 흡수 '+gate.blocked:'');
    });
  }
  picker.onchange=()=>{follow=Number(picker.value)===latest;show();};
  return rows=>{
    box.hidden=!rows.length;
    if(!rows.length){
      if(latest){box.open=false;picker.replaceChildren();buttons.forEach(b=>b.item.open=false);}
      history=[];latest=0;follow=true;signature='';return;
    }
    history=rows;
    if(rows.at(-1).wave!==latest){
      const prior=picker.value;latest=rows.at(-1).wave;
      picker.replaceChildren(...rows.slice().reverse().map(r=>new Option('W'+r.wave,r.wave)));
      picker.value=follow?String(latest):prior;
    }
    show();
  };
})();
