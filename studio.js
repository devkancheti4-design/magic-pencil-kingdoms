'use strict';
/* Design Studio: pen, crayon, bucket fill, eraser, mirror, undo. Save masterpieces to the library and stamp them into the world. */
window.MP = window.MP || {};
(function (MP) {
const SW = 1280, SH = 720, LS_KEY = 'magicpencil.library.v1';
const PEN_WIDTHS = [2, 3, 5, 8], CRAYON_WIDTHS = [14, 22, 34];
const $ = id => document.getElementById(id);
const canvas = $('studioCanvas'), ctx = canvas.getContext('2d');
canvas.width = SW; canvas.height = SH;

let strokes = [], cur = null, undoStack = [], redoStack = [], color = '#1f1f1f', penW = 3, crayonW = 22, tool = 'pen', mirror = false, grid = false;
let editingId = null, isOpen = false, hover = null, down = false, library = [];

function load() { try { library = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); if (!Array.isArray(library)) library = []; } catch (e) { library = []; } }
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(library)); } catch (e) { MP.game && MP.game.toast('Could not save library (storage full?)'); } }

function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * SW / r.width, y: (e.clientY - r.top) * SH / r.height }; }
function snapshot() { undoStack.push(strokes.slice()); if (undoStack.length > 200) undoStack.shift(); redoStack = []; }
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = '#fbf7ec'; ctx.fillRect(0, 0, SW, SH);
  if (grid) { ctx.strokeStyle = 'rgba(80,120,200,0.18)'; ctx.lineWidth = 1; for (let x = 0; x <= SW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SH); ctx.stroke(); } for (let y = 0; y <= SH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SW, y); ctx.stroke(); } }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.fillText('tips: legs = vertical lines reaching the bottom · close an outline, then use the bucket to colour it in · crayon for scribbly colouring', 12, SH - 14);
  if (mirror) { ctx.strokeStyle = 'rgba(46,204,113,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SW / 2, 0); ctx.lineTo(SW / 2, SH); ctx.stroke(); ctx.setLineDash([]); }
  const all = cur ? strokes.concat(cur.twin ? [cur, cur.twin] : [cur]) : strokes;
  MP.paint.drawShape(ctx, all, {});
  if ((tool === 'eraser' || tool === 'bucket') && hover) { ctx.strokeStyle = tool === 'eraser' ? 'rgba(200,60,60,0.8)' : 'rgba(40,120,220,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hover.x, hover.y, tool === 'eraser' ? 14 : 6, 0, Math.PI * 2); ctx.stroke(); }
}
function pointInPoly(p, pts) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside; }
function isClosedLine(s) { if ((s.kind || 'line') !== 'line' || s.pts.length < 8) return false; let len = 0; for (let i = 1; i < s.pts.length; i++) len += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y); const gap = Math.hypot(s.pts[0].x - s.pts[s.pts.length - 1].x, s.pts[0].y - s.pts[s.pts.length - 1].y); return len > 70 && gap < Math.max(16, len * 0.09); }
function bucketAt(p) {
  let best = null, ba = 1e12;
  for (const s of strokes) { if (!isClosedLine(s) || !pointInPoly(p, s.pts)) continue; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of s.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } const a = (x1 - x0) * (y1 - y0); if (a < ba) { ba = a; best = s; } }
  if (!best) { MP.game.toast('Bucket needs a closed outline – draw a loop, then click inside it.'); return; }
  snapshot();
  strokes = strokes.filter(s => !(s.kind === 'fill' && s.src === best));
  strokes.unshift({ kind: 'fill', pts: best.pts.map(q => ({ x: q.x, y: q.y })), color, src: best });
  if (mirror) { const tw = strokes.find(s => s !== best && isClosedLine(s) && pointInPoly({ x: SW - p.x, y: p.y }, s.pts)); if (tw) { strokes = strokes.filter(s => !(s.kind === 'fill' && s.src === tw)); strokes.unshift({ kind: 'fill', pts: tw.pts.map(q => ({ x: q.x, y: q.y })), color, src: tw }); } }
}
function eraseAt(p) {
  const keep = strokes.filter(s => s.kind === 'fill' ? !pointInPoly(p, s.pts) : !s.pts.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 14 + (s.kind === 'crayon' ? s.width / 2 : 0)));
  if (keep.length !== strokes.length) { if (!down.snap) { snapshot(); down.snap = true; } strokes = keep; }
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const p = pos(e); down = { snap: false };
  if (tool === 'eraser') { eraseAt(p); render(); updateStats(); return; }
  if (tool === 'bucket') { bucketAt(p); render(); updateStats(); return; }
  const kind = tool === 'crayon' ? 'crayon' : 'line', width = tool === 'crayon' ? crayonW : penW;
  cur = { kind, pts: [p], color, width };
  if (mirror) cur.twin = { kind, pts: [{ x: SW - p.x, y: p.y }], color, width };
  render();
});
canvas.addEventListener('pointermove', e => {
  const p = pos(e); hover = p;
  if (down && tool === 'eraser') { eraseAt(p); render(); return; }
  if (cur) { const l = cur.pts[cur.pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) >= 1.5) { cur.pts.push(p); if (cur.twin) cur.twin.pts.push({ x: SW - p.x, y: p.y }); } }
  render();
});
function endStroke() {
  if (cur) { snapshot(); strokes.push({ kind: cur.kind, pts: cur.pts, color: cur.color, width: cur.width }); if (cur.twin) strokes.push(cur.twin); cur = null; updateStats(); }
  if (down && tool === 'eraser') updateStats();
  down = false; render();
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', () => { hover = null; if (!cur) render(); });
function undo() { if (!undoStack.length) return; redoStack.push(strokes); strokes = undoStack.pop(); render(); updateStats(); }
function redo() { if (!redoStack.length) return; undoStack.push(strokes); strokes = redoStack.pop(); render(); updateStats(); }
function clearAll() { if (!strokes.length) return; snapshot(); strokes = []; render(); updateStats(); }

function cleanStrokes(src) { return src.map(s => ({ kind: s.kind || 'line', pts: s.pts.map(p => ({ x: p.x, y: p.y })), color: s.color, width: s.width })); }
function scaledStrokes(src, size) {
  const shape = MP.analyze(src); const f = size / Math.max(shape.w, shape.h);
  return src.map(s => ({ kind: s.kind || 'line', pts: s.pts.map(p => ({ x: (p.x - shape.cx) * f, y: (p.y - shape.cy) * f })), color: s.color, width: Math.max(1, (s.width || 3) * Math.min(1.4, Math.max(0.5, f * 2))) }));
}
function updateStats() {
  const el = $('studioStats');
  if (!strokes.length) { el.innerHTML = '<div class="muted">Draw something. The stats of your creation appear here as you work.<br><br>Outline with the pen, colour in with the bucket or crayon – like the magic pen in the cartoon.</div>'; return; }
  const size = +$('studioSize').value, spec = MP.parseWish($('studioName').value);
  const shape = MP.analyze(scaledStrokes(strokes, size)), st = MP.buildStats(spec, shape);
  let html = `<div class="big">${MP.TYPE_NAMES[st.type]}${spec.count > 1 ? ' ×' + spec.count : ''}</div><div class="muted">${st.desc}</div>`;
  html += `<table><tr><td>HP</td><td>${st.hp}</td></tr><tr><td>Damage</td><td>${st.dmg}${st.elem ? ' ' + st.elem : ''}</td></tr><tr><td>Speed</td><td>${st.speed}</td></tr>`;
  if (st.range) html += `<tr><td>Range</td><td>${Math.round(st.range)}</td></tr>`;
  html += `<tr><td>Order</td><td>${st.stance}</td></tr><tr><td>Legs</td><td>${shape.legs}</td></tr><tr><td>Spikes</td><td>${shape.spikes}</td></tr><tr><td>Coloured in</td><td>${shape.hasFill ? 'yes' : shape.closed ? 'closed' : 'no'}</td></tr><tr><td>Strokes</td><td>${shape.strokeCount}</td></tr><tr><td>Size alive</td><td>${Math.round(shape.w)}×${Math.round(shape.h)}</td></tr></table>`;
  html += `<div><b>Why:</b> ${st.notes.join(' · ')}</div>`;
  if (spec.rider) html += `<div class="muted">Will mount the nearest free horse.</div>`;
  if (st.flying) html += `<div class="muted">Flies.</div>`;
  el.innerHTML = html;
}
function thumb(src) {
  const c = document.createElement('canvas'); c.width = 192; c.height = 108; const g = c.getContext('2d');
  g.fillStyle = '#fbf7ec'; g.fillRect(0, 0, 192, 108);
  const shape = MP.analyze(src); const f = Math.min(170 / shape.w, 90 / shape.h);
  g.translate(96, 54); g.scale(f, f); g.translate(-shape.cx, -shape.cy);
  MP.paint.drawShape(g, src.map(s => ({ kind: s.kind || 'line', pts: s.pts, color: s.color, width: Math.max(1.5 / f, s.width || 3) })), {});
  return c.toDataURL('image/png');
}
function saveCurrent() {
  if (!strokes.length) { MP.game.toast('Draw something first.'); return null; }
  const name = $('studioName').value.trim() || 'masterpiece';
  const d = { id: editingId || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), name, size: +$('studioSize').value, strokes: cleanStrokes(strokes).map(s => ({ kind: s.kind, pts: s.pts.map(p => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })), color: s.color, width: s.width })), thumb: thumb(strokes), created: Date.now() };
  const i = library.findIndex(x => x.id === d.id); if (i >= 0) library[i] = d; else library.push(d);
  editingId = d.id; persist(); renderLibrary(); MP.game.toast(`"${name}" saved to your library.`); return d;
}
function renderLibrary() {
  const el = $('library'); el.innerHTML = '';
  if (!library.length) { el.innerHTML = '<div class="empty">Your library is empty. Open the Studio and design something – then stamp it anywhere in your kingdoms.</div>'; return; }
  for (const d of library) {
    const item = document.createElement('div'); item.className = 'item'; item.title = `${d.name} – click to place`;
    const img = new Image(); img.src = d.thumb || (d.thumb = thumb(cleanStrokes(d.strokes))); img.width = 96; img.height = 54; item.appendChild(img);
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = d.name; item.appendChild(lbl);
    const e = document.createElement('button'); e.className = 'e'; e.textContent = '✎'; e.title = 'Edit in Studio'; e.onclick = ev => { ev.stopPropagation(); open(d); }; item.appendChild(e);
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.title = 'Delete'; x.onclick = ev => { ev.stopPropagation(); if (confirm(`Delete "${d.name}" from your library?`)) { library = library.filter(q => q.id !== d.id); persist(); renderLibrary(); } }; item.appendChild(x);
    item.onclick = () => MP.game.startPlacement(d);
    el.appendChild(item);
  }
}
function exportLibrary() { const blob = new Blob([JSON.stringify(library)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'magic-pencil-library.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function importLibrary(file) {
  const r = new FileReader();
  r.onload = () => { try { const arr = JSON.parse(r.result); if (!Array.isArray(arr)) throw 0; let n = 0; for (const d of arr) { if (!d || !d.id || !Array.isArray(d.strokes)) continue; if (!library.some(q => q.id === d.id)) { library.push(d); n++; } } persist(); renderLibrary(); MP.game.toast(`Imported ${n} design${n === 1 ? '' : 's'}.`); } catch (e) { MP.game.toast('That file is not a Magic Pencil library.'); } };
  r.readAsText(file);
}
function open(design) {
  isOpen = true; $('studio').classList.remove('hidden'); MP.game.setStudioPause(true);
  if (design) { editingId = design.id; strokes = cleanStrokes(design.strokes); $('studioName').value = design.name; $('studioSize').value = design.size || 160; }
  else { editingId = null; strokes = []; $('studioName').value = ''; }
  undoStack = []; redoStack = []; cur = null; $('studioSizeVal').textContent = $('studioSize').value + 'px';
  render(); updateStats(); setTimeout(() => $('studioName').focus(), 50);
}
function close() { isOpen = false; $('studio').classList.add('hidden'); MP.game.setStudioPause(false); }

function buildTools() {
  const cg = $('colorGroup');
  MP.paint.PALETTE.forEach(c => { const b = document.createElement('button'); b.className = 'swatch'; b.style.background = c; b.title = c; b.onclick = () => { color = c; if (tool === 'eraser') tool = 'pen'; syncTools(); }; cg.appendChild(b); });
  const wg = $('widthGroup');
  PEN_WIDTHS.forEach(w => { const b = document.createElement('button'); b.className = 'widthBtn pen'; b.dataset.w = w; b.title = `Pen ${w}`; const i = document.createElement('i'); i.style.height = w + 'px'; b.appendChild(i); b.onclick = () => { penW = w; tool = 'pen'; syncTools(); }; wg.appendChild(b); });
  CRAYON_WIDTHS.forEach(w => { const b = document.createElement('button'); b.className = 'widthBtn crayon'; b.dataset.w = w; b.title = `Crayon ${w}`; const i = document.createElement('i'); i.style.height = Math.min(18, w / 2) + 'px'; i.style.opacity = '0.6'; b.appendChild(i); b.onclick = () => { crayonW = w; tool = 'crayon'; syncTools(); }; wg.appendChild(b); });
  $('toolPen').onclick = () => { tool = 'pen'; syncTools(); };
  $('toolCrayon').onclick = () => { tool = 'crayon'; syncTools(); };
  $('toolBucket').onclick = () => { tool = 'bucket'; syncTools(); };
  $('toolEraser').onclick = () => { tool = 'eraser'; syncTools(); };
  $('toolMirror').onclick = () => { mirror = !mirror; syncTools(); render(); };
  $('toolGrid').onclick = () => { grid = !grid; syncTools(); render(); };
  $('toolUndo').onclick = undo; $('toolRedo').onclick = redo; $('toolClear').onclick = clearAll;
  $('studioSave').onclick = saveCurrent;
  $('studioPlace').onclick = () => { const d = saveCurrent(); if (d) { close(); MP.game.startPlacement(d); } };
  $('studioClose').onclick = close;
  $('studioName').addEventListener('input', updateStats);
  $('studioSize').addEventListener('input', () => { $('studioSizeVal').textContent = $('studioSize').value + 'px'; updateStats(); });
  $('btnNewDesign').onclick = () => open(null);
  $('btnExport').onclick = exportLibrary;
  $('importFile').addEventListener('change', e => { if (e.target.files[0]) importLibrary(e.target.files[0]); e.target.value = ''; });
  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    const typing = e.target === $('studioName');
    if (e.key === 'Escape') { e.preventDefault(); if (typing) $('studioName').blur(); else close(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (typing) { e.stopPropagation(); return; }
    const k = e.key.toLowerCase();
    if (k === 'b') tool = 'pen'; else if (k === 'c') tool = 'crayon'; else if (k === 'g') tool = 'bucket'; else if (k === 'e') tool = 'eraser'; else if (k === 'm') { mirror = !mirror; render(); }
    else if (k === '[' || k === ']') { const list = tool === 'crayon' ? CRAYON_WIDTHS : PEN_WIDTHS; const curW = tool === 'crayon' ? crayonW : penW; const ni = Math.max(0, Math.min(list.length - 1, list.indexOf(curW) + (k === ']' ? 1 : -1))); if (tool === 'crayon') crayonW = list[ni]; else penW = list[ni]; }
    syncTools(); e.stopPropagation();
  }, true);
  syncTools();
}
function syncTools() {
  document.querySelectorAll('#colorGroup .swatch').forEach(b => b.classList.toggle('on', b.title === color));
  document.querySelectorAll('#widthGroup .widthBtn.pen').forEach(b => b.classList.toggle('on', +b.dataset.w === penW && tool === 'pen'));
  document.querySelectorAll('#widthGroup .widthBtn.crayon').forEach(b => b.classList.toggle('on', +b.dataset.w === crayonW && tool === 'crayon'));
  $('toolPen').classList.toggle('on', tool === 'pen'); $('toolCrayon').classList.toggle('on', tool === 'crayon'); $('toolBucket').classList.toggle('on', tool === 'bucket'); $('toolEraser').classList.toggle('on', tool === 'eraser');
  $('toolMirror').classList.toggle('on', mirror); $('toolGrid').classList.toggle('on', grid);
  canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'bucket' ? 'pointer' : 'crosshair';
}
MP.studio = { init() { load(); buildTools(); renderLibrary(); }, open, close, get isOpen() { return isOpen; }, get library() { return library; }, scaledStrokes };
})(window.MP);
