'use strict';

// Candidate coordinates stay on this client until the player confirms a move.
function placementPreview(getSelection, move) {
  const controls = document.getElementById('placement');
  const toggle = document.getElementById('previewToggle');
  const options = document.getElementById('previewOptions');
  const picker = document.getElementById('previewSlot');
  const confirm = document.getElementById('previewConfirm');
  let unit = null, target = null;

  function sync() {
    const selected = getSelection();
    if (!selected || selected.id !== unit) { unit = null; target = null; }
    const free = selected ? selected.slots.filter(s => !s.unit) : [];
    controls.hidden = !selected || !free.length;
    if (controls.hidden) { unit = null; target = null; }
    if (!free.some(s => s.idx === target)) target = null;
    const active = unit !== null;
    document.getElementById('moveHint').textContent = active ? '위치를 비교한 뒤 이동 확정' : '빈 슬롯을 눌러 이동';
    toggle.setAttribute('aria-pressed', String(active));
    toggle.textContent = active ? '미리보기 취소' : '배치 미리보기';
    options.hidden = !active;
    if (active) {
      const markup = '<option value="">비교할 빈칸 선택</option>' + selected.slots.map((s,i) =>
        s.unit ? '' : '<option value="'+s.idx+'">'+(i+1)+'번 칸</option>').join('');
      if (picker.dataset.options !== markup) { picker.innerHTML = markup; picker.dataset.options = markup; }
      picker.value = target === null ? '' : String(target);
    }
    confirm.disabled = target === null;
  }
  toggle.onclick = () => {
    unit = unit === null ? getSelection()?.id ?? null : null;
    target = null;
    sync();
  };
  function choose(slot) {
    if (unit === null) return false;
    target = slot?.idx ?? null;
    sync();
    return true;
  }
  picker.onchange = () => choose(getSelection()?.slots.find(s => String(s.idx) === picker.value));
  confirm.onclick = () => {
    sync();
    if (target === null) return;
    const slot = getSelection().slots.find(s => s.idx === target);
    unit = null; target = null;
    move(slot);
    sync();
  };
  function draw(ctx, slotList, id, type, range) {
    if (id !== unit || target === null) return;
    const slot = slotList.find(s => s.idx === target && !s.unit);
    if (!slot) return;
    ART.drawRange(ctx, slot.x, slot.y, range, true);
    ctx.save();
    ctx.globalAlpha = .58;
    ART.draw(ctx, type, slot.x, slot.y+3, 1.8);
    ctx.restore();
  }
  function drawHint(ctx,x,y) {
    const text = unit === null ? '빈 칸을 눌러 이동' : '빈 칸을 눌러 비교';
    ctx.save();
    ctx.font = 'bold 14px system-ui, sans-serif';
    const width = Math.ceil(ctx.measureText(text).width) + 12;
    const left = Math.min(480-width-2, Math.max(2,x-width/2));
    const top = Math.max(1,y-55);
    ctx.fillStyle='#241b38';ctx.fillRect(left,top,width,21);
    ctx.strokeStyle='#91f3ce';ctx.strokeRect(left+.5,top+.5,width-1,20);
    ctx.fillStyle='#defff3';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(text,left+width/2,top+10);
    ctx.restore();
  }
  return {sync, choose, draw, drawHint, get active() { return unit !== null; }};
}
