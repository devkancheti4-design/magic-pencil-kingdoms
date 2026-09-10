'use strict';
/* World rendering in the cartoon's flat style: pastel colours, bold outlines, wallpaper sky, iris vignette. */
window.MP = window.MP || {};
(function (MP) {
const VIEW_W = 1280, VIEW_H = 720, GROUND_Y = 620, OUT = '#2a2438';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const BIOMES = {
  meadow: { sky: '#c4ecf6', hillFar: '#a6dbe6', hill: '#9ad48f', ground: '#7fc46e', ground2: '#5fae63', props: ['tree', 'tree', 'bush', 'flower', 'rock'], treeFill: '#8fd07a', treeFill2: '#6cbf5f', trunk: '#b98352', weather: 'pollen' },
  mud:    { sky: '#e8d9b8', hillFar: '#d8c6a0', hill: '#c9a877', ground: '#b8925c', ground2: '#96743f', props: ['dead', 'puddle', 'rock', 'reed', 'dead'], treeFill: '#c9a877', treeFill2: '#a88a5c', trunk: '#7a5a3a', weather: 'rain' },
  forest: { sky: '#c8ecd8', hillFar: '#9fd6b3', hill: '#6fbf8a', ground: '#5faa6a', ground2: '#478c55', props: ['pine', 'pine', 'bush', 'mushroom', 'pine'], treeFill: '#4f9f68', treeFill2: '#3c8452', trunk: '#8a5a3a', weather: 'leaves' },
  ash:    { sky: '#e6c9bd', hillFar: '#caa79a', hill: '#a88c86', ground: '#8c7b78', ground2: '#6b5d5a', props: ['burnt', 'rock', 'burnt', 'ember', 'burnt'], treeFill: '#5a4a48', treeFill2: '#3a2f2e', trunk: '#3a2f2e', weather: 'embers' },
  snow:   { sky: '#dff0fc', hillFar: '#c9dcf0', hill: '#eef5fb', ground: '#f3f8fc', ground2: '#d5e3f0', props: ['snowpine', 'snowpine', 'snowman', 'rock', 'snowpine'], treeFill: '#5fae8c', treeFill2: '#4a9678', trunk: '#8a5a3a', weather: 'snow' },
  throne: { sky: '#cfb8e6', hillFar: '#b39ad1', hill: '#8f74b0', ground: '#7a5f9c', ground2: '#5b4478', props: ['thorn', 'thorn', 'skull', 'crystal', 'thorn'], treeFill: '#3a2a4a', treeFill2: '#2b1f33', trunk: '#2b1f33', weather: 'sparks' },
};
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`; }
function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

let kingdoms = [], worldW = 7200, layers = null, clouds = [], weather = [], weatherKind = null, wallpaper = null;

function kingdomAt(x) { for (const k of kingdoms) if (x >= k.left && x < k.right) return k; return x < 0 ? kingdoms[0] : kingdoms[kingdoms.length - 1]; }
function biomeAt(x) { return BIOMES[kingdomAt(x).biome]; }
function biomeColor(x, prop) {
  const k = kingdomAt(x), B = 220, c = BIOMES[k.biome][prop], idx = kingdoms.indexOf(k);
  const dl = x - k.left, dr = k.right - x;
  if (dl < B && idx > 0) return mix(BIOMES[kingdoms[idx - 1].biome][prop], c, smooth(0.5 + dl / B / 2));
  if (dr < B && idx < kingdoms.length - 1) return mix(c, BIOMES[kingdoms[idx + 1].biome][prop], smooth(0.5 - dr / B / 2));
  return c;
}
function outline(g, w, a) { g.strokeStyle = OUT; g.lineWidth = w || 3; g.lineJoin = 'round'; g.lineCap = 'round'; g.globalAlpha = a == null ? 1 : a; }

/* ---------- pre-rendered layers ---------- */
function hillLayer(p, seedA, base, amp, prop, seed) {
  const w = Math.ceil(worldW * p + VIEW_W), c = document.createElement('canvas'); c.width = w; c.height = VIEW_H;
  const g = c.getContext('2d'); const tops = [];
  for (let x = 0; x <= w + 8; x += 6) {
    const wx = x / p;
    const hh = amp * (0.55 + 0.3 * Math.sin(wx * 0.0021 + seedA) + 0.25 * Math.sin(wx * 0.0063 + seedA * 2.3) + 0.12 * Math.sin(wx * 0.017 + seedA * 5.1));
    const y = base - hh; tops.push({ x, y });
    g.fillStyle = biomeColor(wx, prop); g.fillRect(x, y, 7, VIEW_H - y);
  }
  outline(g, 3.5, 0.55); g.beginPath(); tops.forEach((t, i) => i ? g.lineTo(t.x, t.y) : g.moveTo(t.x, t.y)); g.stroke(); g.globalAlpha = 1;
  return { c, p };
}
const NEAR_TOP = 300;
function buildNear() {
  const p = 1, w = Math.ceil(worldW + VIEW_W), c = document.createElement('canvas'); c.width = w; c.height = VIEW_H - NEAR_TOP;
  const g = c.getContext('2d'); g.translate(0, -NEAR_TOP);
  const rnd = mulberry32(7);
  for (let x = 0; x < w; x += 6) { g.fillStyle = biomeColor(x, 'ground'); g.fillRect(x, GROUND_Y, 7, 44); g.fillStyle = biomeColor(x, 'ground2'); g.fillRect(x, GROUND_Y + 44, 7, VIEW_H - GROUND_Y); }
  outline(g, 4, 0.7); g.beginPath(); g.moveTo(0, GROUND_Y); g.lineTo(w, GROUND_Y); g.stroke();
  outline(g, 2, 0.25); g.beginPath(); g.moveTo(0, GROUND_Y + 44); g.lineTo(w, GROUND_Y + 44); g.stroke(); g.globalAlpha = 1;
  for (let x = 0; x < w; x += 10 + rnd() * 14) { const b = biomeAt(x); if (b === BIOMES.snow || b === BIOMES.ash || b === BIOMES.throne) continue; outline(g, 2, 0.35); g.beginPath(); g.moveTo(x, GROUND_Y); g.lineTo(x - 3 + rnd() * 6, GROUND_Y - 6 - rnd() * 7); g.moveTo(x + 5, GROUND_Y); g.lineTo(x + 7, GROUND_Y - 5 - rnd() * 5); g.stroke(); }
  g.globalAlpha = 1;
  const avoid = kingdoms.map(k => k.x);
  for (let x = 60; x < worldW - 60; x += 80 + rnd() * 120) {
    if (avoid.some(ax => Math.abs(ax - x) < 220)) continue;
    if (kingdoms.some(k => Math.abs(k.left + 70 - x) < 60 && k.left > 0)) continue;
    const b = biomeAt(x); drawProp(g, b.props[Math.floor(rnd() * b.props.length)], x, GROUND_Y, b, rnd);
  }
  return { c, p, top: NEAR_TOP };
}
function drawProp(g, kind, x, y, b, rnd) {
  const s = 0.75 + rnd() * 0.6;
  g.save(); g.translate(x, y); g.scale(s, s); outline(g, 3.5);
  const shadow = () => { g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(0, 3, 28, 6, 0, 0, Math.PI * 2); g.fill(); };
  const circ = (cx, cy, r, f) => { g.fillStyle = f; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke(); };
  switch (kind) {
    case 'tree': shadow(); g.fillStyle = b.trunk; g.beginPath(); g.rect(-7, -62, 14, 62); g.fill(); g.stroke(); circ(0, -92, 38, b.treeFill); circ(-24, -74, 22, b.treeFill2); circ(24, -76, 24, b.treeFill2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-12, -104, 9, 0, Math.PI * 2); g.fill(); break;
    case 'pine': case 'snowpine': shadow(); g.fillStyle = b.trunk; g.beginPath(); g.rect(-6, -40, 12, 40); g.fill(); g.stroke(); for (let i = 0; i < 3; i++) { const yy = -30 - i * 30, ww = 44 - i * 9; g.fillStyle = i % 2 ? b.treeFill2 : b.treeFill; g.beginPath(); g.moveTo(0, yy - 46); g.lineTo(-ww, yy); g.lineTo(ww, yy); g.closePath(); g.fill(); g.stroke(); if (kind === 'snowpine') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, yy - 46); g.lineTo(-ww * 0.5, yy - 22); g.lineTo(0, yy - 14); g.lineTo(ww * 0.5, yy - 22); g.closePath(); g.fill(); } } break;
    case 'dead': shadow(); outline(g, 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(2, -70); g.stroke(); outline(g, 5); for (const [x1, y1, x2, y2] of [[1, -45, -28, -75], [2, -60, 26, -90], [-28, -75, -40, -95], [2, -70, -10, -105]]) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); } break;
    case 'burnt': shadow(); outline(g, 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -60); g.stroke(); outline(g, 4); g.beginPath(); g.moveTo(0, -40); g.lineTo(-22, -62); g.moveTo(0, -55); g.lineTo(18, -75); g.stroke(); g.fillStyle = '#ff8c3a'; g.beginPath(); g.arc(-2, -20, 3.5, 0, Math.PI * 2); g.arc(4, -34, 2.5, 0, Math.PI * 2); g.fill(); break;
    case 'thorn': g.fillStyle = b.treeFill; g.beginPath(); g.moveTo(-30, 0); for (let i = 0; i < 7; i++) g.lineTo(-30 + i * 10, i % 2 ? -20 - rnd() * 20 : -60 - rnd() * 40); g.lineTo(30, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(200,120,255,0.45)'; g.beginPath(); g.arc(0, -50, 8, 0, Math.PI * 2); g.fill(); break;
    case 'bush': g.fillStyle = b.treeFill2; for (const [dx, dy, r] of [[-14, -12, 14], [12, -14, 15], [0, -22, 16]]) { g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill(); } g.beginPath(); g.moveTo(-28, -8); g.arc(-14, -12, 14, Math.PI, Math.PI * 1.6); g.arc(0, -22, 16, Math.PI * 1.2, Math.PI * 1.85); g.arc(12, -14, 15, Math.PI * 1.4, Math.PI * 2.1); g.lineTo(27, 0); g.lineTo(-28, 0); g.closePath(); g.stroke(); break;
    case 'rock': g.fillStyle = '#b9b3ad'; g.beginPath(); g.moveTo(-22, 0); g.lineTo(-16, -18); g.lineTo(0, -26); g.lineTo(18, -16); g.lineTo(24, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-12, -15); g.lineTo(0, -21); g.lineTo(5, -12); g.closePath(); g.fill(); break;
    case 'flower': for (let i = 0; i < 4; i++) { const fx = -22 + i * 14; outline(g, 2.5); g.beginPath(); g.moveTo(fx, 0); g.lineTo(fx, -16); g.stroke(); g.fillStyle = ['#ff8fa3', '#f6e39b', '#c9b6e8', '#ffffff'][i]; g.beginPath(); g.arc(fx, -19, 6, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#f7b880'; g.beginPath(); g.arc(fx, -19, 2.2, 0, Math.PI * 2); g.fill(); } break;
    case 'puddle': g.fillStyle = '#9fb8e8'; g.beginPath(); g.ellipse(0, 4, 34, 8, 0, 0, Math.PI * 2); g.fill(); outline(g, 2.5, 0.6); g.stroke(); g.globalAlpha = 1; break;
    case 'reed': outline(g, 3); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-12 + i * 6, 0); g.lineTo(-14 + i * 6 + (i % 2) * 4, -30 - i * 4); g.stroke(); } break;
    case 'mushroom': g.fillStyle = '#f3e7d3'; g.beginPath(); g.rect(-5, -16, 10, 16); g.fill(); g.stroke(); g.fillStyle = '#e06666'; g.beginPath(); g.arc(0, -16, 14, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-5, -22, 2.5, 0, Math.PI * 2); g.arc(5, -20, 2.5, 0, Math.PI * 2); g.fill(); break;
    case 'ember': g.fillStyle = '#ff8c3a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-20 + rnd() * 40, -rnd() * 10, 2 + rnd() * 2, 0, Math.PI * 2); g.fill(); } break;
    case 'snowman': for (const [dy, r] of [[-16, 17], [-42, 13], [-62, 10]]) circ(0, dy, r, '#ffffff'); g.fillStyle = OUT; g.beginPath(); g.arc(-3.5, -64, 1.8, 0, Math.PI * 2); g.arc(3.5, -64, 1.8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f7b880'; g.beginPath(); g.moveTo(0, -61); g.lineTo(12, -59); g.lineTo(0, -57); g.closePath(); g.fill(); g.stroke(); break;
    case 'skull': circ(0, -14, 12, '#eee6d8'); g.fillStyle = '#eee6d8'; g.beginPath(); g.rect(-7, -6, 14, 8); g.fill(); g.stroke(); g.fillStyle = OUT; g.beginPath(); g.arc(-4.5, -15, 3.2, 0, Math.PI * 2); g.arc(4.5, -15, 3.2, 0, Math.PI * 2); g.fill(); break;
    case 'crystal': g.fillStyle = '#c9b6e8'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-6, -40); g.lineTo(2, -52); g.lineTo(10, -30); g.lineTo(14, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(-6, -40); g.lineTo(2, -52); g.lineTo(2, -10); g.closePath(); g.fill(); break;
  }
  g.restore();
}
function buildWallpaper() {
  const c = document.createElement('canvas'); c.width = 56; c.height = 40; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(40,30,80,0.13)'; g.lineWidth = 2;
  for (const [ox, oy] of [[0, 0], [28, 20]]) { g.beginPath(); g.arc(ox + 14, oy + 6, 13, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); g.beginPath(); g.arc(ox + 14, oy + 2, 4, 0, Math.PI * 2); g.stroke(); }
  return c;
}
function init(ks, ww) {
  kingdoms = ks; worldW = ww;
  layers = { far: hillLayer(0.3, 1.3, 505, 150, 'hillFar', 1), mid: hillLayer(0.6, 2.9, 590, 95, 'hill', 2), near: buildNear() };
  wallpaper = buildWallpaper();
  const rnd = mulberry32(3); clouds = []; const cw = worldW * 0.2 + VIEW_W;
  for (let i = 0; i < 40; i++) clouds.push({ x: rnd() * cw, y: 50 + rnd() * 230, s: 0.6 + rnd() * 1.2, v: 3 + rnd() * 8, w: cw });
  weather = []; weatherKind = null;
}

/* ---------- live ---------- */
function skyColor(cam) { return biomeColor(cam.x + VIEW_W / 2, 'sky'); }
function drawSky(ctx, cam, time) {
  ctx.fillStyle = skyColor(cam); ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const pat = ctx.createPattern(wallpaper, 'repeat');
  ctx.save(); ctx.translate(-(cam.x * 0.1) % 56, 0); ctx.fillStyle = pat; ctx.fillRect(-56, 0, VIEW_W + 112, GROUND_Y); ctx.restore();
  const sx = 1000 - cam.x * 0.03, sy = 105;
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(sx, sy, 62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(sx, sy, 40, 0, Math.PI * 2); ctx.fill(); outline(ctx, 3, 0.5); ctx.stroke(); ctx.globalAlpha = 1;
  for (const c of clouds) {
    let lx = (c.x + time * c.v) % c.w; let x = lx - cam.x * 0.2; if (x < -220) x += c.w; if (x > VIEW_W + 220 || x < -220) continue;
    ctx.save(); ctx.translate(x, c.y); ctx.scale(c.s, c.s);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-50, 12); ctx.arc(-30, 4, 20, Math.PI, Math.PI * 1.55); ctx.arc(-4, -10, 28, Math.PI * 1.2, Math.PI * 1.9); ctx.arc(26, 0, 22, Math.PI * 1.3, Math.PI * 2.05); ctx.lineTo(48, 12); ctx.closePath(); ctx.fill(); outline(ctx, 3, 0.45); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
  }
}
function blit(ctx, layer, cam) { const sx = clamp(cam.x * layer.p, 0, layer.c.width - VIEW_W); ctx.drawImage(layer.c, sx, 0, VIEW_W, layer.c.height, 0, layer.top || 0, VIEW_W, layer.c.height); }
function drawBackground(ctx, cam, time) {
  drawSky(ctx, cam, time);
  blit(ctx, layers.far, cam); blit(ctx, layers.mid, cam); blit(ctx, layers.near, cam);
  for (const k of kingdoms) {
    const l = k.left - cam.x, r = k.right - cam.x; if (r < 0 || l > VIEW_W) continue;
    ctx.fillStyle = k.owner === 'player' ? 'rgba(46,204,113,0.55)' : 'rgba(231,76,60,0.5)';
    ctx.fillRect(Math.max(0, l), GROUND_Y + 30, Math.min(VIEW_W, r) - Math.max(0, l), 6);
    if (k.left > 0 && l > -80 && l < VIEW_W + 80) drawSignpost(ctx, l + 70, GROUND_Y, k, time);
  }
}
function drawSignpost(ctx, x, gy, k, time) {
  ctx.save(); ctx.translate(x, gy); outline(ctx, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(0, 3, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b98352'; ctx.beginPath(); ctx.rect(-5, -80, 10, 80); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0b077'; ctx.beginPath(); ctx.moveTo(-60, -76); ctx.lineTo(52, -76); ctx.lineTo(66, -61); ctx.lineTo(52, -46); ctx.lineTo(-60, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = OUT; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k.name, -2, -56);
  ctx.fillStyle = k.owner === 'player' ? '#5fd37f' : '#ef6b6b'; ctx.beginPath(); ctx.moveTo(4, -104); for (let i = 0; i <= 5; i++) ctx.lineTo(4 + i * 7, -104 + Math.sin(time * 6 + i) * 2.5); ctx.lineTo(4 + 35, -90); for (let i = 5; i >= 0; i--) ctx.lineTo(4 + i * 7, -90 + Math.sin(time * 6 + i) * 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawCastle(ctx, x, gy, team, level, hpRatio, time, name, seed) {
  const P = team === 'player' ? { wall: '#f2e6c8', wall2: '#e2d2ac', roof: '#7fc46e', flag: '#5fd37f', gate: '#6b4a2b', win: '#f6e39b' } : { wall: '#b9a3d6', wall2: '#9f88bd', roof: '#e8a7bd', flag: '#ef6b6b', gate: '#2b1f33', win: '#ff9a8a' };
  const rnd = mulberry32(seed || 1);
  ctx.save(); ctx.translate(x, gy); outline(ctx, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0, 5, 150, 12, 0, 0, Math.PI * 2); ctx.fill();
  const tower = (tx, tw, th) => {
    ctx.fillStyle = P.wall; ctx.beginPath(); ctx.rect(tx - tw / 2, -th, tw, th); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.wall2; for (let i = 0; i < Math.floor(tw / 14); i++) if (i % 2 === 0) { ctx.beginPath(); ctx.rect(tx - tw / 2 + i * 14, -th - 11, 12, 11); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = P.roof; ctx.beginPath(); ctx.moveTo(tx - tw / 2 - 10, -th - 11); ctx.lineTo(tx, -th - 11 - tw * 0.95); ctx.lineTo(tx + tw / 2 + 10, -th - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.win; ctx.beginPath(); ctx.arc(tx, -th * 0.6, 7, Math.PI, 0); ctx.lineTo(tx + 7, -th * 0.6 + 14); ctx.lineTo(tx - 7, -th * 0.6 + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  const ww = 230, wh = 105;
  ctx.fillStyle = P.wall; ctx.beginPath(); ctx.rect(-ww / 2, -wh, ww, wh); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 0.25; for (let yy = -wh + 18; yy < 0; yy += 20) { ctx.beginPath(); ctx.moveTo(-ww / 2 + 8, yy); ctx.lineTo(ww / 2 - 8, yy); ctx.stroke(); } ctx.globalAlpha = 1;
  ctx.fillStyle = P.wall2; for (let i = 0; i < ww / 18; i++) if (i % 2 === 0) { ctx.beginPath(); ctx.rect(-ww / 2 + i * 18, -wh - 13, 14, 13); ctx.fill(); ctx.stroke(); }
  tower(-ww / 2, 58, 185); tower(ww / 2, 58, 185); tower(0, 84, 165);
  ctx.fillStyle = P.gate; ctx.beginPath(); ctx.arc(0, -34, 26, Math.PI, 0); ctx.lineTo(26, 0); ctx.lineTo(-26, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  const fy = -165 - 11 - 84 * 0.95 - 40;
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.rect(-2, fy, 4, 44); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.flag; ctx.beginPath(); ctx.moveTo(2, fy); for (let i = 0; i <= 6; i++) ctx.lineTo(2 + i * 8, fy + Math.sin(time * 7 + i * 0.9) * 3); ctx.lineTo(50, fy + 18); for (let i = 6; i >= 0; i--) ctx.lineTo(2 + i * 8, fy + 20 + Math.sin(time * 7 + i * 0.9) * 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (team !== 'player') { ctx.beginPath(); ctx.moveTo(12, fy + 5); ctx.lineTo(30, fy + 15); ctx.moveTo(30, fy + 5); ctx.lineTo(12, fy + 15); ctx.stroke(); ctx.strokeStyle = 'rgba(214,60,60,0.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 14; i++) ctx.lineTo(-90 + i * 12, -60 + Math.sin(i * 2.1) * 12); ctx.stroke(); }
  const dmg = 1 - hpRatio; outline(ctx, 2.5);
  if (dmg > 0.15) { const n = Math.floor(dmg * 14); for (let i = 0; i < n; i++) { let cx = -100 + rnd() * 200, cy = -wh + rnd() * wh * 0.8; ctx.beginPath(); ctx.moveTo(cx, cy); for (let j = 0; j < 4; j++) { cx += (rnd() - 0.5) * 24; cy += rnd() * 16; ctx.lineTo(cx, cy); } ctx.stroke(); } }
  if (dmg > 0.5) for (let i = 0; i < 5; i++) { const ph = (time * 0.4 + i * 0.2 + rnd()) % 1; ctx.globalAlpha = 0.6 * (1 - ph); ctx.fillStyle = '#9a96a8'; ctx.beginPath(); ctx.arc(-60 + i * 30 + Math.sin(time + i) * 10, -wh - 20 - ph * 120, 10 + ph * 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.fillStyle = '#fff';
  const label = `${name}${level ? '  ' + '★'.repeat(Math.min(5, level)) : ''}`; ctx.strokeText(label, 0, fy - 20); ctx.fillText(label, 0, fy - 20);
  ctx.restore();
}
function drawForeground(ctx, cam, time, dt) {
  const kind = biomeAt(cam.x + VIEW_W / 2).weather;
  if (kind !== weatherKind) { weatherKind = kind; weather = []; for (let i = 0; i < 60; i++) weather.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, p: Math.random() * 6, s: 0.5 + Math.random() }); }
  ctx.save();
  for (const f of weather) {
    switch (kind) {
      case 'snow': f.y += (20 + f.s * 25) * dt; f.x += Math.sin(time + f.p) * 20 * dt; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(f.x, f.y, 1.5 + f.s * 1.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'embers': f.y -= (25 + f.s * 30) * dt; f.x += Math.sin(time * 2 + f.p) * 25 * dt; ctx.fillStyle = `rgba(255,${120 + f.s * 60},30,${0.5 + 0.4 * Math.sin(time * 5 + f.p)})`; ctx.beginPath(); ctx.arc(f.x, f.y, 1 + f.s * 1.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'sparks': f.y -= 12 * dt; f.x += Math.sin(time * 1.5 + f.p) * 18 * dt; ctx.fillStyle = `rgba(200,120,255,${0.4 + 0.4 * Math.sin(time * 3 + f.p)})`; ctx.beginPath(); ctx.arc(f.x, f.y, 1.2 + f.s, 0, Math.PI * 2); ctx.fill(); break;
      case 'rain': f.y += (380 + f.s * 200) * dt; f.x -= 60 * dt; ctx.strokeStyle = 'rgba(80,90,140,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - 2, f.y - 12); ctx.stroke(); break;
      case 'leaves': f.y += (18 + f.s * 14) * dt; f.x += Math.sin(time * 1.3 + f.p) * 30 * dt; ctx.fillStyle = 'rgba(90,150,60,0.7)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 4, 2, time + f.p, 0, Math.PI * 2); ctx.fill(); break;
      default: f.y -= 6 * dt; f.x += Math.sin(time + f.p) * 10 * dt; ctx.fillStyle = 'rgba(255,255,220,0.6)'; ctx.beginPath(); ctx.arc(f.x, f.y, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    if (f.y > VIEW_H + 10) { f.y = -10; f.x = Math.random() * VIEW_W; } if (f.y < -10) { f.y = VIEW_H + 10; f.x = Math.random() * VIEW_W; }
    if (f.x < -10) f.x = VIEW_W + 10; if (f.x > VIEW_W + 10) f.x = -10;
  }
  // cartoon iris vignette
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2 - 40, VIEW_H * 0.5, VIEW_W / 2, VIEW_H / 2 - 40, VIEW_H * 1.02);
  v.addColorStop(0, 'rgba(30,20,60,0)'); v.addColorStop(1, 'rgba(30,20,60,0.42)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}
MP.world = { init, drawBackground, drawCastle, drawForeground, kingdomAt, biomeAt, BIOMES, VIEW_W, VIEW_H, GROUND_Y };
})(window.MP);
