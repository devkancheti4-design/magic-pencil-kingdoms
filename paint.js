'use strict';
/* Crayon renderer: every living drawing (and the studio) is painted with this – scratchy outlines, crayon fills. */
window.MP = window.MP || {};
(function (MP) {
const PALETTE = ['#1f1f1f', '#2a2438', '#1c3a6e', '#4a2c1a', '#1f4d2e', '#7a1f2b', '#e8a7bd', '#a9d9ee', '#cfe3b5', '#c9b6e8', '#f6e39b', '#f7b880', '#b9e5e0', '#f0c8dc', '#9fb8e8', '#ffffff'];
const patCache = new WeakMap();
let tile = null;
function makeTile() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d');
  for (let i = 0; i < 300; i++) {
    g.strokeStyle = `rgba(30,20,40,${0.05 + Math.random() * 0.15})`; g.lineWidth = 0.6 + Math.random() * 1.3;
    const x = Math.random() * 96, y = Math.random() * 96, a = -0.7 + Math.random() * 0.5, l = 3 + Math.random() * 10;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.25})`; g.fillRect(Math.random() * 96, Math.random() * 96, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  return c;
}
function pattern(ctx) { if (!tile) tile = makeTile(); let p = patCache.get(ctx); if (!p) { p = ctx.createPattern(tile, 'repeat'); patCache.set(ctx, p); } return p; }

/* strokes: [{kind:'line'|'crayon'|'fill', pts, color, width, top?, legIdx?}]
   o: {time, wob, moving, walkPhase, glow, lineColor, defaultColor} */
function drawShape(ctx, strokes, o) {
  o = o || {};
  const time = o.time || 0, wob = o.wob || 0, base = ctx.globalAlpha;
  const paths = strokes.map((s, si) => {
    let cos = 1, sin = 0, top = null;
    if (s.top && o.moving) { const ang = Math.sin(o.walkPhase * 2 + (s.legIdx % 2) * Math.PI) * 0.45; cos = Math.cos(ang); sin = Math.sin(ang); top = s.top; }
    const p = new Path2D(), pts = s.pts;
    for (let i = 0; i < pts.length; i++) {
      let x = pts[i].x, y = pts[i].y;
      if (top) { const dx = x - top.x, dy = y - top.y; x = top.x + dx * cos - dy * sin; y = top.y + dx * sin + dy * cos; }
      if (wob) { x += Math.sin(time * 9 + i * 0.9 + si * 2) * wob; y += Math.cos(time * 7 + i * 1.1 + si) * wob; }
      if (o.slither) x += Math.sin(time * 6 + y * 0.06 + si) * 5;
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    if (pts.length === 1) p.lineTo(pts[0].x + 0.5, pts[0].y);
    if (s.kind === 'fill') p.closePath();
    return p;
  });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.glow) { ctx.strokeStyle = o.glow; for (let i = 0; i < strokes.length; i++) { const s = strokes[i]; if (s.kind === 'fill') { ctx.fillStyle = o.glow; ctx.fill(paths[i]); } ctx.lineWidth = (s.width || 3) + 9; ctx.stroke(paths[i]); } }
  const pat = pattern(ctx);
  for (let i = 0; i < strokes.length; i++) { const s = strokes[i]; if (s.kind !== 'fill') continue; ctx.fillStyle = s.color || '#e8a7bd'; ctx.fill(paths[i]); ctx.globalAlpha = base * 0.7; ctx.fillStyle = pat; ctx.fill(paths[i]); ctx.globalAlpha = base; }
  for (let i = 0; i < strokes.length; i++) { const s = strokes[i]; if (s.kind !== 'crayon') continue; ctx.lineWidth = s.width || 22; ctx.globalAlpha = base * 0.62; ctx.strokeStyle = s.color || '#e8a7bd'; ctx.stroke(paths[i]); ctx.globalAlpha = base * 0.5; ctx.strokeStyle = pat; ctx.stroke(paths[i]); ctx.globalAlpha = base; }
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i]; if (s.kind && s.kind !== 'line') continue;
    const w = s.width || 3;
    ctx.strokeStyle = o.lineColor || s.color || o.defaultColor || '#1f1f1f'; ctx.lineWidth = w; ctx.stroke(paths[i]);
    ctx.save(); ctx.translate(0.9, 0.7); ctx.globalAlpha = base * 0.35; ctx.lineWidth = w * 0.55; ctx.stroke(paths[i]); ctx.restore();
  }
}
MP.paint = { drawShape, pattern, PALETTE };
})(window.MP);
