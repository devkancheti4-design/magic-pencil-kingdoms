'use strict';
/* Magic Pencil: Kingdoms of Paper – world, units, kingdoms, camera, input, HUD. */
window.MP = window.MP || {};
(function (MP) {
const W = 1280, H = 720, GROUND_Y = 620, SKY_MIN = 60, SKY_MAX = 430, WORLD_W = 7200, MINI_H = 40, UNIT_CAP = 220;
const PLAYER_COLOR = '#1fb35c', PLAYER_GLOW = 'rgba(90,255,160,0.38)', ENEMY_COLOR = '#d63c3c', ENEMY_GLOW = 'rgba(255,90,80,0.32)';
const KINGDOM_DEFS = [
  { name: 'Greenhaven', x: 520, left: 0, right: 1080, level: 0, biome: 'meadow' },
  { name: 'Mudlands', x: 1650, left: 1080, right: 2220, level: 1, biome: 'mud' },
  { name: 'Thornwood', x: 2800, left: 2220, right: 3380, level: 2, biome: 'forest' },
  { name: 'Ashpeak', x: 3950, left: 3380, right: 4540, level: 3, biome: 'ash' },
  { name: 'Frostmere', x: 5100, left: 4540, right: 5700, level: 4, biome: 'snow' },
  { name: 'Roach Throne', x: 6420, left: 5700, right: 7200, level: 5, biome: 'throne' },
];
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;
const $ = id => document.getElementById(id);
const clamp = MP.clamp, rand = (a, b) => a + Math.random() * (b - a);
let nextId = 1;

/* ---------------- state ---------------- */
let units = [], projectiles = [], particles = [], kingdoms = [];
let score = 0, kills = 0, captured = 1, time = 0, lastT = 0, speed = 1, studioPaused = false, phase = 'menu', selected = null, won = false, invasionT = 60;
const cam = { x: 0, tx: 0, shake: 0 };
const pointer = { x: 0, y: 0, sx: 0, sy: 0, down: false, startX: 0, startY: 0, moved: 0, button: 0 };
const keys = new Set();
let sketch = null, placing = null, pan = null, banner = null, lastKingdomId = -1;
const activePointers = new Map();

function makeUnit(o) {
  return Object.assign({ id: nextId++, team: 'player', dead: false, deathT: 0, hp: 50, maxHp: 50, dmg: 0, speed: 0, range: 0, cd: 1, cdT: rand(0, 0.4),
    flying: false, static: false, special: null, stance: 'attack', elem: null, facing: 1, baseFacing: 1, walkPhase: rand(0, 6), moving: false, flash: 0,
    attackAnim: 0, rider: null, mount: null, vy: 0, falling: false, stuckT: 0, slowT: 0, burnT: 0, burnDps: 0, stunT: 0, spawnT: 0.7, targetable: true,
    lane: rand(-22, 22), color: PLAYER_COLOR, glow: PLAYER_GLOW, label: '', type: 'creature', canHitFlyers: false, w: 40, h: 40, x: 0, y: 0, strokes: [],
    notes: [], healT: 0, patrolBase: 0, proj: null, splash: 0, blast: 0, healRate: 0, healRadius: 0, lure: 0, uses: 0, stun: 0, lineWidth: 3, hoverPhase: rand(0, 6), post: null, castle: false, kingdom: null, desc: '', arms: 1, author: null, anims: {}, rollAngle: 0 }, o);
}
const groundY = u => GROUND_Y + u.lane - u.h / 2 - (u.anims && u.anims.hover ? 55 : 0);
const alive = u => !u.dead;
const kingdomAt = x => MP.world.kingdomAt(x);
const canPlaceAt = x => kingdomAt(x).owner === 'player';

/* ---------------- the roaches' magic-pen army (pink soldiers, tanks, planes, a dragon) ---------------- */
const E_OUT = '#3a2a4a', PINK = '#e8a7bd', PALEGREEN = '#cfe3b5', LIGHTBLUE = '#a9d9ee', LAVENDER = '#c9b6e8', INKDARK = '#3a3140';
const jit = (pts, j) => pts.map(p => ({ x: p.x + rand(-j, j), y: p.y + rand(-j, j) }));
const scl = (pts, sc) => pts.map(p => ({ x: p.x * sc, y: p.y * sc }));
const circ = (cx, cy, r, n) => { const o = []; n = n || 18; for (let i = 0; i <= n; i++) o.push({ x: cx + Math.cos(i / n * Math.PI * 2) * r, y: cy + Math.sin(i / n * Math.PI * 2) * r }); return o; };
const L = (pts, w) => ({ kind: 'line', pts, color: E_OUT, width: w || 3 });
const F = (pts, color) => ({ kind: 'fill', pts, color });
function soldierStrokes(sc, club) {
  const head = jit(scl(circ(0, -36, 12), sc), 0.8), body = jit(scl([{ x: -9, y: -22 }, { x: -12, y: 2 }, { x: -7, y: 10 }, { x: 7, y: 10 }, { x: 12, y: 2 }, { x: 9, y: -22 }, { x: -9, y: -22 }], sc), 0.8);
  const st = [F(head, PINK), F(body, PINK), L(head), L(body), L(jit(scl([{ x: -5, y: 10 }, { x: -9, y: 40 }], sc), 0.6)), L(jit(scl([{ x: 5, y: 10 }, { x: 9, y: 40 }], sc), 0.6)),
    L(jit(scl([{ x: -8, y: -14 }, { x: -22, y: -2 }], sc), 0.6)), L(jit(scl([{ x: 8, y: -14 }, { x: -14, y: -10 }], sc), 0.6)),
    L(scl([{ x: -6, y: -39 }, { x: -6, y: -37 }], sc), 2.5), L(scl([{ x: 3, y: -39 }, { x: 3, y: -37 }], sc), 2.5), L(scl([{ x: -9, y: -44 }, { x: -3, y: -42 }], sc), 2), L(scl([{ x: 6, y: -42 }, { x: 0, y: -44 }], sc), 2), L(scl([{ x: -4, y: -30 }, { x: 2, y: -30 }], sc), 2)];
  if (club) st.push(L(jit(scl([{ x: -22, y: -2 }, { x: -40, y: -34 }], sc), 0.6), 5), F(scl(circ(-42, -38, 8, 10), sc), '#8a6a4a'), L(scl(circ(-42, -38, 8, 10), sc)));
  else st.push(L(jit(scl([{ x: -34, y: 12 }, { x: -6, y: -34 }], sc), 0.5), 3.5), L(scl([{ x: -30, y: 6 }, { x: -24, y: 12 }], sc), 3));
  return st;
}
function tankStrokes(sc) {
  const hull = jit(scl([{ x: -48, y: -6 }, { x: -44, y: -24 }, { x: 44, y: -24 }, { x: 50, y: -6 }, { x: -48, y: -6 }], sc), 1), turret = jit(scl([{ x: -18, y: -24 }, { x: -14, y: -40 }, { x: 18, y: -40 }, { x: 22, y: -24 }, { x: -18, y: -24 }], sc), 0.8);
  const treads = jit(scl([{ x: -52, y: 0 }, { x: -58, y: 8 }, { x: -52, y: 18 }, { x: 52, y: 18 }, { x: 58, y: 8 }, { x: 52, y: 0 }, { x: -52, y: 0 }], sc), 1);
  const st = [F(hull, PALEGREEN), F(turret, PALEGREEN), F(treads, '#9fb883'), L(treads, 3.5), L(hull, 3.5), L(turret, 3), L(jit(scl([{ x: -16, y: -34 }, { x: -70, y: -40 }], sc), 0.6), 5)];
  for (const wx of [-34, 0, 34]) { st.push(F(scl(circ(wx, 9, 8, 12), sc), '#d9e6c9'), L(scl(circ(wx, 9, 8, 12), sc), 2.5), L(scl(circ(wx, 9, 3, 8), sc), 2)); }
  st.push(L(scl([{ x: -30, y: -14 }, { x: -20, y: -14 }], sc), 2.5), L(scl([{ x: 10, y: -14 }, { x: 20, y: -14 }], sc), 2.5));
  return st;
}
function planeStrokes(sc) {
  const fus = jit(scl([{ x: -60, y: 0 }, { x: -40, y: -8 }, { x: 30, y: -10 }, { x: 56, y: -4 }, { x: 56, y: 6 }, { x: 30, y: 10 }, { x: -40, y: 8 }, { x: -60, y: 0 }], sc), 1);
  const wingU = jit(scl([{ x: -4, y: -9 }, { x: 8, y: -46 }, { x: 22, y: -9 }, { x: -4, y: -9 }], sc), 0.8), wingD = jit(scl([{ x: -4, y: 9 }, { x: 8, y: 46 }, { x: 22, y: 9 }, { x: -4, y: 9 }], sc), 0.8);
  const st = [F(fus, LIGHTBLUE), F(wingU, LIGHTBLUE), F(wingD, LIGHTBLUE), L(wingU), L(wingD), L(fus, 3.5)];
  for (const wx of [-22, -8, 6, 20]) st.push(L(scl(circ(wx, 0, 3.5, 10), sc), 2));
  for (const [ax, ay] of [[-26, -24], [-16, -36], [-26, 24], [-16, 36]]) st.push(L(scl([{ x: ax, y: ay }, { x: ax - 16, y: ay }, { x: ax - 12, y: ay - 3 }, { x: ax - 16, y: ay }, { x: ax - 12, y: ay + 3 }], sc), 2), L(scl([{ x: ax, y: ay - 3 }, { x: ax + 3, y: ay }, { x: ax, y: ay + 3 }], sc), 2));
  st.push(L(scl([{ x: 44, y: -4 }, { x: 60, y: -22 }, { x: 62, y: -4 }], sc), 3), F(scl([{ x: 44, y: -4 }, { x: 60, y: -22 }, { x: 62, y: -4 }], sc), LIGHTBLUE));
  return st;
}
function dragonStrokes(sc) {
  const body = jit(scl([{ x: -40, y: -10 }, { x: -60, y: -30 }, { x: -70, y: -50 }, { x: -58, y: -62 }, { x: -40, y: -56 }, { x: -30, y: -40 }, { x: -10, y: -20 }, { x: 20, y: -10 }, { x: 40, y: 10 }, { x: 46, y: 36 }, { x: 34, y: 50 }, { x: 16, y: 44 }, { x: 22, y: 30 }, { x: 30, y: 24 }, { x: 22, y: 8 }, { x: 0, y: 4 }, { x: -20, y: 6 }, { x: -40, y: -10 }], sc), 1.5);
  const wingL = jit(scl([{ x: -20, y: -20 }, { x: -60, y: -80 }, { x: -110, y: -100 }, { x: -96, y: -70 }, { x: -120, y: -56 }, { x: -92, y: -46 }, { x: -100, y: -20 }, { x: -60, y: -18 }, { x: -20, y: -20 }], sc), 1.5);
  const wingR = jit(scl([{ x: 0, y: -14 }, { x: 40, y: -84 }, { x: 96, y: -104 }, { x: 84, y: -72 }, { x: 110, y: -58 }, { x: 80, y: -46 }, { x: 88, y: -18 }, { x: 40, y: -12 }, { x: 0, y: -14 }], sc), 1.5);
  const st = [F(wingL, LAVENDER), F(wingR, LAVENDER), L(wingL, 3.5), L(wingR, 3.5), F(body, INKDARK), L(body, 4)];
  st.push(L(scl([{ x: -58, y: -62 }, { x: -66, y: -78 }], sc), 3), L(scl([{ x: -46, y: -60 }, { x: -44, y: -76 }], sc), 3), L(scl([{ x: -72, y: -52 }, { x: -86, y: -48 }], sc), 3));
  st.push(L(scl([{ x: -30, y: -40 }, { x: -22, y: -50 }, { x: -12, y: -30 }, { x: -2, y: -34 }, { x: 8, y: -16 }, { x: 18, y: -20 }, { x: 28, y: 0 }], sc), 2.5));
  st.push(L(scl([{ x: -62, y: -58 }, { x: -60, y: -55 }], sc), 3), L(scl(circ(-61, -57, 2.5, 8), sc), 2));
  for (const [bx, by] of [[-30, -38], [-10, -22], [10, -12], [30, 4]]) st.push(L(scl([{ x: bx - 6, y: by + 6 }, { x: bx + 6, y: by + 2 }], sc), 2));
  return st;
}
function unitFromShape(strokesAbs, o) { const a = MP.analyze(strokesAbs); return makeUnit(Object.assign({ strokes: a.strokes, w: a.w, h: a.h, x: a.cx, y: a.cy, shape: a }, o)); }
function spawnEnemy(kind, x, level, stance) {
  const Lv = level; let u;
  if (kind === 'challenger') return community.length ? spawnChallenger(x, level, stance) : spawnEnemy('brute', x, level, stance);
  const base = { team: 'enemy', color: E_OUT, glow: ENEMY_GLOW, baseFacing: -1, facing: -1, stance: stance || 'attack' };
  if (kind === 'plane') { u = unitFromShape(planeStrokes(rand(0.85, 1.05)), Object.assign(base, { label: 'scribble plane', type: 'flyer', flying: true, hp: 40 + 15 * Lv, dmg: 6 + 2 * Lv, speed: 92 + 2 * Lv, range: 210, cd: 1.3, proj: 'arrow', canHitFlyers: true, desc: 'a drawn plane that shoots arrows' })); u.y = rand(SKY_MIN + 50, SKY_MAX - 40); }
  else if (kind === 'dragon') { u = unitFromShape(dragonStrokes(rand(1.0, 1.15)), Object.assign(base, { label: 'SCRIBBLE DRAGON', type: 'boss', flying: true, hp: 380 + 150 * Lv, dmg: 14 + 4 * Lv, speed: 55, range: 170, cd: 0.6, proj: 'fire', splash: 45, elem: 'fire', canHitFlyers: true, lineWidth: 4, desc: 'the roaches\' masterpiece – breathes fire' })); u.y = rand(SKY_MIN + 90, SKY_MAX - 60); }
  else if (kind === 'tank') { u = unitFromShape(tankStrokes(rand(0.9, 1.1)), Object.assign(base, { label: 'scribble tank', type: 'cannon', hp: 160 + 70 * Lv, dmg: 18 + 5 * Lv, speed: 26, range: 300, cd: 2.6, proj: 'shell', splash: 60, canHitFlyers: true, lineWidth: 4, desc: 'slow, armoured, fires shells' })); u.lane = rand(-6, 6); }
  else if (kind === 'brute') { u = unitFromShape(soldierStrokes(rand(1.3, 1.5), true), Object.assign(base, { label: 'scribble brute', type: 'melee', hp: 70 + 25 * Lv, dmg: 9 + 3 * Lv, speed: 48 + 2 * Lv, cd: 1.0, desc: 'a big drawn thug with a club' })); }
  else { u = unitFromShape(soldierStrokes(rand(0.9, 1.1), false), Object.assign(base, { label: 'scribble soldier', type: 'ranged', hp: 26 + 10 * Lv, dmg: 5 + 2 * Lv, speed: 44 + 3 * Lv, range: 230, cd: 1.5, proj: 'bullet', canHitFlyers: true, desc: 'a drawn soldier with a rifle' })); }
  u.maxHp = u.hp; u.spawnT = 0.5; u.x = clamp(x, 40, WORLD_W - 40); u.post = u.x;
  if (!u.flying) u.y = groundY(u);
  units.push(u); return u;
}
/* ---------------- community challengers: other people's creations, loaded from community/designs.json ---------------- */
let community = [];
async function loadCommunity() {
  try { const r = await fetch('community/designs.json', { cache: 'no-store' }); if (!r.ok) return; const arr = await r.json(); if (Array.isArray(arr)) community = arr.filter(d => d && Array.isArray(d.strokes) && d.strokes.length && d.name); } catch (e) { community = []; }
  if (community.length) toast(`${community.length} community challenger${community.length === 1 ? '' : 's'} loaded – you will face the unknown.`);
}
function spawnChallenger(x, level, stance) {
  const d = community[Math.floor(Math.random() * community.length)];
  const src = MP.studio.scaledStrokes(d.strokes, clamp(d.size || 160, 40, 420)).map(s => ({ kind: s.kind, pts: s.pts.map(p => ({ x: p.x + x, y: p.y })), color: s.color, width: s.width }));
  const spec = MP.parseWish(d.name), shape = MP.analyze(src), st = MP.buildStats(spec, shape);
  const u = makeUnit({ team: 'enemy', color: '#3a2a4a', glow: ENEMY_GLOW, baseFacing: 1, facing: -1, stance: stance || 'attack', label: d.name, author: d.author || 'a challenger', type: st.type, strokes: shape.strokes, w: shape.w, h: shape.h, x, y: shape.cy, shape,
    hp: Math.round(st.hp * (1 + 0.35 * level)), maxHp: Math.round(st.hp * (1 + 0.35 * level)), dmg: Math.round(st.dmg * (1 + 0.25 * level) * 10) / 10, speed: st.speed, range: st.range, cd: st.cd, flying: st.flying, static: false, special: st.special === 'bomb' ? 'bomb' : null, proj: st.proj, splash: st.splash, blast: st.blast, elem: st.elem, arms: st.arms, anims: st.anims, canHitFlyers: st.flying || st.range > 0, notes: st.notes, desc: `${st.desc} · made by ${d.author || 'a challenger'}` });
  if (u.type === 'wall' || u.type === 'tower' || u.type === 'bait' || u.type === 'trap' || u.type === 'healer') { u.type = 'melee'; u.dmg = Math.max(u.dmg, 8); u.range = 0; u.proj = null; }
  u.spawnT = 0.5; u.x = clamp(x, 40, WORLD_W - 40); u.post = u.x;
  if (u.flying) u.y = rand(SKY_MIN + 60, SKY_MAX - 40); else { u.lane = rand(-22, 22); u.y = groundY(u); }
  units.push(u); return u;
}
function raidComposition(Lv, n) {
  const list = [];
  for (let i = 0; i < n; i++) { const r = Math.random(); if (community.length && Lv >= 1 && r < 0.14) list.push('challenger'); else if (Lv >= 4 && r < 0.06) list.push('dragon'); else if (Lv >= 2 && r < 0.2) list.push('tank'); else if (Lv >= 2 && r < 0.4) list.push('plane'); else if (Lv >= 1 && r < 0.6) list.push('brute'); else list.push('soldier'); }
  return list;
}
function spawnGarrison(k, small) {
  const Lv = k.level, n = small ? Math.max(1, Lv) : 2 + Lv * 2;
  for (let i = 0; i < n; i++) spawnEnemy('soldier', k.x + (i % 2 ? 1 : -1) * rand(140, 320), Lv, 'guard');
  if (small) return;
  for (let i = 0; i < Math.floor((Lv + 1) / 2); i++) spawnEnemy('brute', k.x + (i % 2 ? 1 : -1) * rand(120, 260), Lv, 'guard');
  if (Lv >= 2) spawnEnemy('tank', k.x - 200, Lv, 'guard'); if (Lv >= 4) spawnEnemy('tank', k.x + 220, Lv, 'guard');
  if (Lv >= 3) spawnEnemy('plane', k.x - 120, Lv, 'guard'); if (Lv >= 5) spawnEnemy('plane', k.x + 120, Lv, 'guard');
  if (Lv >= 3) spawnEnemy('dragon', k.x + 150, Lv, 'guard');
  if (community.length && Lv >= 2) spawnEnemy('challenger', k.x + rand(-260, 260), Lv, 'guard');
}
function launchRaid(k) {
  const target = nearestCastleTo(k.x, 'player'); if (!target) return;
  const dir = Math.sign(target.x - k.x) || -1;
  const n = 2 + k.level * 2 + Math.floor(captured * 0.8);
  const comp = raidComposition(k.level, n);
  comp.forEach((kind, i) => spawnEnemy(kind, k.x + dir * (160 + i * 34), k.level, 'attack'));
  toast(`⚠ A raid of ${n} scribbles left ${k.name} heading for ${target.kingdom.name}!`);
}
function launchInvasion() {
  const n = 6 + Math.floor(time / 120);
  raidComposition(5, n).forEach((kind, i) => spawnEnemy(kind, WORLD_W - 60 - i * 30, 5, 'attack'));
  toast(`⚠ An invasion of ${n} scribbles crawls in from the edge of the paper!`);
}

/* ---------------- kingdoms & castles ---------------- */
function makeCastle(k, owner, hpFrac) {
  const L = k.level;
  const hp = owner === 'player' ? (L === 0 ? 1000 : 700) : 600 + 700 * L;
  const u = makeUnit({ team: owner, type: 'castle', castle: true, label: k.name + (owner === 'player' ? ' castle' : ' roach castle'), static: true, hp: hp * (hpFrac || 1), maxHp: hp,
    x: k.x, y: GROUND_Y - 100, w: 250, h: 200, lane: 0, kingdom: k, range: owner === 'player' ? 260 : (L >= 1 ? 280 : 0), dmg: owner === 'player' ? 8 : 6 + 3 * L, cd: owner === 'player' ? 1.4 : 1.6, proj: 'arrow',
    canHitFlyers: true, color: owner === 'player' ? PLAYER_COLOR : ENEMY_COLOR, glow: owner === 'player' ? PLAYER_GLOW : ENEMY_GLOW, spawnT: 0, desc: owner === 'player' ? 'your castle – defend it, it shoots back' : 'smash it to capture the kingdom' });
  k.castle = u; units.push(u); return u;
}
function flipKingdom(k, newOwner) {
  const old = k.castle; if (old) { old.dead = true; old.deathT = 0; }
  k.owner = newOwner;
  makeCastle(k, newOwner, 0.5);
  if (newOwner === 'player') {
    captured = kingdoms.filter(q => q.owner === 'player').length; score += 500 + k.level * 250;
    banner = { text: `${k.name} captured!`, sub: 'You can now draw and build here.', t: 4 }; cam.shake = 12;
    toast(`🏰 ${k.name} is yours! +${500 + k.level * 250} score.`);
    for (const u of units) if (alive(u) && u.team === 'enemy' && u.stance === 'guard' && kingdomAt(u.x) === k) u.stance = 'attack';
    if (kingdoms.every(q => q.owner === 'player') && !won) { won = true; phase = 'won'; showOverlay(`You rule the whole paper! Score ${score}, ${kills} scribbles erased.`, 'Keep playing (invasions will come from the edge)'); }
  } else {
    captured = kingdoms.filter(q => q.owner === 'player').length;
    banner = { text: `${k.name} lost!`, sub: 'The roaches scribbled over it. Take it back.', t: 4 }; cam.shake = 10;
    toast(`💀 ${k.name} fell to the roaches.`); spawnGarrison(k, true);
  }
  updateHud();
}
function nearestCastleTo(x, team) { let best = null, bd = 1e9; for (const k of kingdoms) if (k.owner === team && k.castle && alive(k.castle)) { const d = Math.abs(k.x - x); if (d < bd) { bd = d; best = k.castle; } } return best; }

/* ---------------- creating living drawings ---------------- */
function createUnits(strokesWorld, name, opts) {
  opts = opts || {};
  const spec = MP.parseWish(name);
  const shape = MP.analyze(strokesWorld);
  if (!canPlaceAt(shape.cx)) { toast('Drawings only come alive inside YOUR kingdoms (green ground). Capture more land to build there.'); return []; }
  const armyCount = units.filter(u => alive(u) && u.team === 'player' && !u.castle).length;
  if (armyCount + spec.count > UNIT_CAP) { toast(`Your army is at the limit (${UNIT_CAP}). Erase something first.`); return []; }
  const st = MP.buildStats(spec, shape);
  const made = [];
  for (let i = 0; i < spec.count; i++) {
    const strokes = shape.strokes.map(s => ({ kind: s.kind, pts: s.pts.map(p => ({ x: p.x, y: p.y })), isLeg: s.isLeg, top: s.top && { x: s.top.x, y: s.top.y }, legIdx: s.legIdx, color: s.color, width: s.width }));
    const u = makeUnit({ team: 'player', label: spec.label, type: st.type, strokes, w: shape.w, h: shape.h, x: shape.cx - i * (shape.w * 0.8 + 12), y: shape.cy,
      hp: st.hp, maxHp: st.hp, dmg: st.dmg, speed: st.speed, range: st.range, cd: st.cd, flying: st.flying, static: st.static, special: st.special,
      proj: st.proj, splash: st.splash, blast: st.blast, healRate: st.healRate, healRadius: st.healRadius, lure: st.lure, uses: st.uses, stun: st.stun,
      elem: st.elem, stance: st.stance, notes: st.notes, shape, desc: st.desc, targetable: st.special !== 'trap', canHitFlyers: st.flying || st.range > 0, lineWidth: st.type === 'wall' ? 4 : 3, color: '#1f1f1f', arms: st.arms, anims: st.anims });
    if (u.special === 'trap') u.color = '#8a6d3b';
    u.x = clamp(u.x, 40, WORLD_W - 40);
    if (u.flying) u.y = clamp(u.y, SKY_MIN + u.h / 2, SKY_MAX);
    else { u.lane = u.static ? rand(-8, 8) : rand(-22, 22); const gy = groundY(u); if (u.y < gy - 2) { u.falling = true; u.vy = 0; } else u.y = gy; }
    u.post = u.x; if (u.stance === 'patrol') u.patrolBase = u.x;
    units.push(u); made.push(u);
  }
  for (const u of made) {
    if (u.type === 'mount' && !u.rider) { const r = units.find(o => alive(o) && o.team === 'player' && o !== u && isRiderType(o) && !o.mount && !o.flying && overlaps(o, u, 0.25)); if (r) mountUp(r, u); }
    else if (isRiderType(u) && !u.mount && !u.flying) {
      let m = units.find(o => alive(o) && o.team === 'player' && o.type === 'mount' && !o.rider && !o.flying && overlaps(u, o, 0.25));
      if (!m && spec.rider) m = nearest(units.filter(o => alive(o) && o.team === 'player' && o.type === 'mount' && !o.rider && !o.flying), u, 220);
      if (m) mountUp(u, m);
    }
  }
  spawnBurst(shape.cx, shape.cy, PLAYER_COLOR, 22);
  if (!opts.quiet) toast(`${spec.label} came alive! ${st.desc}.`);
  return made;
}
const isRiderType = u => ['melee', 'ranged', 'mage', 'creature', 'healer', 'cannon'].includes(u.type) && !u.static;
function overlaps(a, b, frac) { const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2); return ox > Math.min(a.w, b.w) * frac && Math.abs(a.y - b.y) < (a.h + b.h); }
function nearest(list, u, maxD) { let best = null, bd = maxD; for (const o of list) { const d = Math.abs(o.x - u.x); if (d < bd) { bd = d; best = o; } } return best; }
function mountUp(rider, mount) { rider.mount = mount; mount.rider = rider; rider.targetable = false; rider.falling = false; mount.hp += rider.hp * 0.5; mount.maxHp += rider.hp * 0.5; if (rider.stance !== 'attack') mount.stance = rider.stance; else rider.stance = mount.stance; toast(`${rider.label} mounted ${mount.label}!`); }
function dismount(rider) { if (!rider.mount) return; const m = rider.mount; m.rider = null; rider.mount = null; rider.targetable = true; rider.x = m.x; rider.falling = true; rider.vy = 0; }

function bringToLife() {
  if (!sketch || !sketch.strokes.length) return;
  const made = createUnits(sketch.strokes.map(s => ({ kind: 'line', pts: s, color: '#1f1f1f', width: 3 })), $('nameInput').value);
  if (made.length) clearSketch();
}
function startPlacement(design) {
  placing = { design, size: design.size || 160, flip: false };
  $('placeHint').classList.remove('hidden'); clearSketch();
  toast(`Placing "${design.name}" – click inside your kingdom. Esc when done.`);
}
function stopPlacement() { placing = null; $('placeHint').classList.add('hidden'); }
function placementStrokes(wx, wy) {
  const src = MP.studio.scaledStrokes(placing.design.strokes, placing.size);
  return src.map(s => ({ kind: s.kind || 'line', pts: s.pts.map(p => ({ x: wx + (placing.flip ? -p.x : p.x), y: wy + p.y })), color: s.color, width: s.width }));
}
function placeNow() {
  const made = createUnits(placementStrokes(pointer.x, pointer.y), placing.design.name, { quiet: true });
  if (made.length) toast(`${placing.design.name} came alive! Click again to place another, Esc to stop.`);
}

/* ---------------- combat ---------------- */
function inMeleeReach(u, t) { return Math.abs(u.x - t.x) <= (u.w + t.w) / 2 + 16; }
function findBait(u) { let best = null, bd = 1e9; for (const o of units) if (alive(o) && o.team !== u.team && o.special === 'bait') { const d = Math.abs(o.x - u.x); if (d < o.lure && d < bd) { bd = d; best = o; } } return best; }
function findTarget(u) {
  if (u.dmg <= 0 && u.range <= 0) return null;
  if (u.team === 'enemy' && !u.flying) { const b = findBait(u); if (b) return inMeleeReach(u, b) ? b : null; }
  let best = null, bd = 1e9;
  for (const o of units) {
    if (o.dead || o.team === u.team || !o.targetable) continue;
    if (u.range > 0) { const d = Math.hypot(o.x - u.x, o.y - u.y); if (d <= u.range + o.w * 0.3 && d < bd) { bd = d; best = o; } }
    else {
      if (o.flying && !u.flying && !u.canHitFlyers) continue;
      if (u.flying && o.static && !o.castle) continue;
      if (!inMeleeReach(u, o)) continue;
      const d = Math.abs(o.x - u.x); if (d < bd) { bd = d; best = o; }
    }
  }
  return best;
}
function nearestFoe(u, maxD) { let best = null, bd = maxD; for (const o of units) { if (o.dead || o.team === u.team || !o.targetable) continue; if (o.flying && !u.flying && !u.canHitFlyers) continue; const d = Math.abs(o.x - u.x); if (d < bd) { bd = d; best = o; } } return best; }
function applyDamage(t, dmg, elem, attacker) {
  if (t.dead) return;
  t.hp -= dmg; t.flash = 0.15;
  particles.push({ x: t.x + rand(-10, 10), y: t.y - t.h / 2 - 6, vx: rand(-15, 15), vy: -60, life: 0.8, text: Math.round(dmg), color: t.team === 'enemy' ? '#1e8449' : '#c0392b' });
  for (let i = 0; i < 3; i++) particles.push({ x: t.x + rand(-t.w / 3, t.w / 3), y: t.y + rand(-t.h / 3, t.h / 3), vx: rand(-90, 90), vy: rand(-120, 20), life: rand(0.2, 0.45), color: t.team === 'enemy' ? '#ffd166' : '#ff8a80', size: 2.5 });
  if (elem === 'fire') { t.burnT = 3; t.burnDps = Math.max(t.burnDps, 4); }
  else if (elem === 'ice') t.slowT = 2.2;
  else if (elem === 'poison') { t.burnT = 5; t.burnDps = Math.max(t.burnDps, 3); }
  else if (elem === 'shock') t.stunT = Math.max(t.stunT, 0.35);
  if (attacker && t.static && t.elem === 'fire' && !attacker.dead) { attacker.burnT = 2; attacker.burnDps = Math.max(attacker.burnDps, 3); }
  if (t.hp <= 0) kill(t, attacker);
}
function kill(u, by) {
  if (u.dead) return;
  u.dead = true; u.deathT = 0; u.hp = 0;
  if (u.team === 'enemy' && !u.castle) { kills++; score += u.type === 'boss' ? 150 : u.type === 'flyer' ? 20 : u.type === 'beetle' ? 40 : 10; }
  if (u.special === 'bomb' && by !== 'self') explode(u.x, u.y, u.blast, u.dmg, u.team, u.elem);
  if (u.rider) dismount(u.rider);
  if (u.mount) { const m = u.mount; m.rider = null; u.mount = null; }
  if (u === selected) { selected = null; renderInspector(); }
  spawnBurst(u.x, u.y, u.color, 10);
  if (u.castle && u.kingdom) {
    const k = u.kingdom;
    if (u.team === 'player' && k.level === 0) { gameOver(); return; }
    flipKingdom(k, u.team === 'player' ? 'enemy' : 'player');
  }
}
function explode(x, y, r, dmg, team, elem) {
  particles.push({ x, y, life: 0.5, ring: r, color: '#f39c12' });
  for (let i = 0; i < 16; i++) particles.push({ x, y, vx: rand(-200, 200), vy: rand(-260, 40), life: rand(0.3, 0.8), color: ['#f39c12', '#e67e22', '#c0392b', '#555'][i % 4], size: rand(3, 6) });
  cam.shake = Math.max(cam.shake, 6);
  for (const o of units) { if (o.dead || o.team === team || !o.targetable) continue; const d = Math.max(0, Math.hypot(o.x - x, o.y - y) - o.w * 0.35); if (d < r) applyDamage(o, dmg * (1 - 0.5 * d / r), elem, null); }
}
function explodeUnit(u) { u.dead = true; u.deathT = 0.5; explode(u.x, u.y, u.blast, u.dmg, u.team, u.elem); }
function fireProjectile(u, t) {
  const sx = u.x + u.facing * u.w * 0.3, sy = u.castle ? u.y - u.h * 0.6 : u.y - u.h * 0.1;
  const sp = u.proj === 'shell' ? 330 : u.proj === 'fire' ? 260 : u.proj === 'magic' ? 380 : u.proj === 'bullet' ? 520 : 440;
  const lead = clamp(Math.hypot(t.x - sx, t.y - sy) / sp, 0, 1.2);
  const tx = t.x + (t.moving ? t.facing * t.speed * lead * 0.6 : 0), ty = t.y;
  const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1, n = Math.max(1, u.arms || 1), ang0 = Math.atan2(dy, dx);
  for (let i = 0; i < n; i++) {
    const ang = ang0 + (n > 1 ? (i / (n - 1) - 0.5) * 0.4 : 0), oy = n > 1 ? (i - (n - 1) / 2) * 6 : 0;
    projectiles.push({ x: sx, y: sy + oy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg: u.dmg, team: u.team, elem: u.elem, splash: u.splash, kind: u.proj || 'arrow', life: u.range / sp + 0.4, color: u.color, trail: [] });
  }
}
function attack(u, t, dt) {
  u.cdT -= dt; if (u.cdT > 0) return; u.cdT = u.cd * (u.slowT > 0 ? 1.5 : 1); u.attackAnim = 0.25;
  if (u.range > 0) { fireProjectile(u, t); return; }
  if (u.anims.spin) { for (const o of units) { if (o.dead || o.team === u.team || !o.targetable) continue; if (o.flying && !u.flying && !u.canHitFlyers) continue; if (inMeleeReach(u, o)) applyDamage(o, u.dmg, u.elem, u); } return; }
  applyDamage(t, u.dmg, u.elem, u);
}
function spawnBurst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(40, 160); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), color, size: rand(2, 4) }); } }

/* ---------------- unit update ---------------- */
function updateUnit(u, dt) {
  if (u.mount) {
    const m = u.mount; u.x = m.x + m.facing * m.w * 0.05; u.y = m.y - m.h / 2 - u.h / 2 + Math.min(u.h, m.h) * 0.35; u.facing = m.facing; u.moving = m.moving;
    const t = findTarget(u); if (t) { u.facing = Math.sign(t.x - u.x) || u.facing; attack(u, t, dt); }
    return;
  }
  if (u.falling) { u.vy += 1500 * dt; u.y += u.vy * dt; const gy = groundY(u); if (u.y >= gy) { u.y = gy; u.falling = false; u.vy = 0; spawnBurst(u.x, u.y + u.h / 2, '#b9a98a', 5); } return; }
  if (u.special === 'trap') { trapTick(u); return; }
  if (u.special === 'heal') healTick(u, dt);
  if (u.static) { if (u.range > 0 && u.dmg > 0) { const t = findTarget(u); if (t) { u.facing = Math.sign(t.x - u.x) || u.facing; attack(u, t, dt); } } return; }
  u.moving = false;
  if (u.stunT > 0 || u.stuckT > 0) return;
  const spd = u.speed * (u.slowT > 0 ? 0.5 : 1);
  const tgt = findTarget(u);
  if (tgt) {
    if (u.special === 'bomb') { explodeUnit(u); return; }
    u.facing = Math.sign(tgt.x - u.x) || u.facing; attack(u, tgt, dt);
    if (u.flying) u.y += ((tgt.flying ? tgt.y : Math.max(SKY_MAX, tgt.y - tgt.h * 0.3 - u.h * 0.2)) - u.y) * Math.min(1, dt * 4);
    return;
  }
  let dir = 0;
  if (u.team === 'enemy') {
    const b = findBait(u);
    if (b) dir = Math.sign(b.x - u.x);
    else if (u.stance === 'guard') dir = guardDir(u);
    else { const c = nearestCastleTo(u.x, 'player'); dir = c ? Math.sign(c.x - u.x) : 0; }
  } else switch (u.stance) {
    case 'attack': { const c = nearestCastleTo(u.x, 'enemy'); dir = c ? Math.sign(c.x - u.x) : guardDir(u); break; }
    case 'guard': dir = guardDir(u); break;
    case 'follow': dir = Math.abs(pointer.x - u.x) > 16 ? Math.sign(pointer.x - u.x) : 0; break;
    case 'patrol': if (u.patrolDir == null) u.patrolDir = 1; if (u.x > u.patrolBase + 110) u.patrolDir = -1; if (u.x < u.patrolBase - 110) u.patrolDir = 1; dir = u.patrolDir; break;
  }
  if (dir) { u.x += dir * spd * dt; u.facing = dir; u.moving = true; u.walkPhase += dt * spd * 0.1; if (u.anims.roll) u.rollAngle += dir * spd * dt / Math.max(12, u.w / 2); if (!u.flying && spd > 90 && Math.random() < dt * 8) particles.push({ x: u.x - dir * u.w * 0.3, y: u.y + u.h / 2, vx: -dir * 30, vy: -20, life: 0.4, color: 'rgba(150,130,100,0.5)', size: 4 }); }
  u.x = clamp(u.x, 30, WORLD_W - 30);
  if (u.flying) { const wantY = clamp(u.y, SKY_MIN + u.h / 2, SKY_MAX); u.y += (wantY - u.y) * Math.min(1, dt * 2); }
}
function guardDir(u) {
  const post = u.post == null ? u.x : u.post;
  const near = nearestFoe(u, 260);
  if (near && Math.abs(near.x - post) < 340) return Math.sign(near.x - u.x);
  if (Math.abs(u.x - post) > 12) return Math.sign(post - u.x);
  return 0;
}
function trapTick(u) {
  for (const o of units) {
    if (o.dead || o.team === u.team || o.flying || o.static || (o.anims && o.anims.hover) || o.stuckT > 0 || (o.trapCd || 0) > time) continue;
    if (Math.abs(o.x - u.x) < u.w / 2 + o.w * 0.15) {
      o.stuckT = u.stun; o.trapCd = time + u.stun + 1.5; applyDamage(o, u.dmg, u.elem, null); u.uses--;
      particles.push({ x: u.x, y: u.y - 20, vx: 0, vy: -40, life: 1, text: 'STUCK!', color: '#8a6d3b' });
      if (u.uses <= 0) { u.dead = true; u.deathT = 0; break; }
    }
  }
}
function healTick(u, dt) {
  u.healT -= dt; if (u.healT > 0) return; u.healT = 0.5;
  let best = null, br = 1;
  for (const o of units) { if (o.dead || o.team !== u.team || o === u || o.special === 'trap') continue; if (Math.hypot(o.x - u.x, o.y - u.y) > u.healRadius + (o.castle ? 100 : 0)) continue; const r = o.hp / o.maxHp; if (r < br) { br = r; best = o; } }
  if (best) { best.hp = Math.min(best.maxHp, best.hp + u.healRate * 0.5 * (best.castle ? 3 : 1)); particles.push({ x: best.x, y: best.y - best.h / 2, vx: 0, vy: -30, life: 0.7, text: '+', color: '#27ae60' }); }
}
function update(dt) {
  time += dt;
  for (const k of kingdoms) if (k.owner === 'enemy') { k.raidT -= dt; if (k.raidT <= 0) { k.raidT = Math.max(30, 65 - k.level * 4 - captured * 3); launchRaid(k); } }
  if (won) { invasionT -= dt; if (invasionT <= 0) { invasionT = 75; launchInvasion(); } }
  for (const u of units) {
    if (u.dead) { u.deathT += dt; continue; }
    if (u.flash > 0) u.flash -= dt; if (u.attackAnim > 0) u.attackAnim -= dt; if (u.spawnT > 0) u.spawnT -= dt;
    if (u.stunT > 0) u.stunT -= dt; if (u.stuckT > 0) u.stuckT -= dt; if (u.slowT > 0) u.slowT -= dt;
    if (u.burnT > 0) { u.burnT -= dt; u.hp -= u.burnDps * dt; if (u.hp <= 0) kill(u, null); if (u.burnT <= 0) u.burnDps = 0; if (Math.random() < dt * 6) particles.push({ x: u.x + rand(-u.w / 3, u.w / 3), y: u.y, vx: 0, vy: -50, life: 0.5, color: u.burnDps >= 4 ? '#e67e22' : '#8e44ad', size: 4 }); }
    if (u.dead) continue;
    updateUnit(u, dt);
  }
  for (const p of projectiles) {
    if (p.trail && (p.kind === 'magic' || p.kind === 'fire')) { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 6) p.trail.shift(); }
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.kind === 'arrow' || p.kind === 'shell') p.vy += 70 * dt;
    for (const o of units) {
      if (o.dead || o.team === p.team || !o.targetable) continue;
      if (Math.abs(p.x - o.x) < o.w / 2 + 6 && Math.abs(p.y - o.y) < o.h / 2 + 6) { if (p.splash) explode(p.x, p.y, p.splash, p.dmg, p.team, p.elem); else applyDamage(o, p.dmg, p.elem, null); p.life = 0; break; }
    }
    if (p.y > GROUND_Y + 30) p.life = 0;
  }
  projectiles = projectiles.filter(p => p.life > 0);
  for (const p of particles) { p.life -= dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.size && !p.text) p.vy += 200 * dt; } }
  particles = particles.filter(p => p.life > 0);
  units = units.filter(u => !u.dead || u.deathT < 0.8);
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
}

/* ---------------- render ---------------- */
function drawUnit(u) {
  if (u.castle) {
    const gy = GROUND_Y + u.lane;
    MP.world.drawCastle(ctx, u.x, gy, u.team, u.kingdom.level, clamp(u.hp / u.maxHp, 0, 1), time, u.kingdom.name, u.kingdom.level + 3);
    if (u.dead) return;
    if (u === selected) { ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeRect(u.x - u.w / 2, u.y - u.h / 2, u.w, u.h); ctx.setLineDash([]); }
    const bw = 200, bx = u.x - bw / 2, by = gy - 262;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
    ctx.fillStyle = u.team === 'player' ? '#2ecc71' : '#e74c3c'; ctx.fillRect(bx, by, bw * clamp(u.hp / u.maxHp, 0, 1), 7);
    return;
  }
  ctx.save();
  const alpha = u.dead ? Math.max(0, 1 - u.deathT / 0.8) : (u.special === 'trap' ? 0.75 : 1);
  ctx.globalAlpha = alpha;
  if (!u.dead) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; const sw = u.flying ? u.w * 0.3 : u.w * 0.5; ctx.beginPath(); ctx.ellipse(u.x, GROUND_Y + u.lane + 3, sw, Math.max(3, sw * 0.18), 0, 0, Math.PI * 2); ctx.fill(); }
  let bob = 0;
  if (u.moving && !u.flying) bob = Math.abs(Math.sin(u.walkPhase * 2)) * 3;
  if (u.flying) bob = Math.sin(time * 3 + u.hoverPhase) * 4;
  if (u.anims.hover) bob = Math.sin(time * 2.2 + u.hoverPhase) * 9;
  if (u.anims.bounce && u.moving) bob = Math.abs(Math.sin(u.walkPhase * 1.4)) * 26;
  const lunge = u.attackAnim > 0 ? u.facing * 9 * (u.attackAnim / 0.25) : 0;
  ctx.translate(u.x + lunge, u.y - bob);
  if (u.facing !== u.baseFacing) ctx.scale(-1, 1);
  if (u.anims.spin) ctx.rotate(time * 7 * (u.spinDir || 1));
  if (u.anims.roll) ctx.rotate(u.rollAngle * (u.facing !== u.baseFacing ? -1 : 1));
  if (u.dead) { ctx.rotate(u.deathT * 1.4); const s = 1 - u.deathT * 0.5; ctx.scale(s, s); }
  if (u.stuckT > 0) ctx.translate(0, 6);
  if (u.stunT > 0) ctx.rotate(Math.sin(time * 30) * 0.08);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (u.spawnT > 0) { ctx.shadowColor = u.color; ctx.shadowBlur = 30 * u.spawnT; }
  if (u === selected) { ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 18; }
  MP.paint.drawShape(ctx, u.strokes, { time, wob: u.static ? 0.35 : (u.anims.shake ? 2.6 : 0.9), slither: !!u.anims.slither, moving: u.moving && !u.flying && !u.anims.hover && !u.anims.bounce, walkPhase: u.walkPhase, glow: u.glow, defaultColor: u.color, lineColor: u.flash > 0 ? '#ff2d2d' : (u.slowT > 0 ? '#3498db' : u.burnT > 0 ? '#e67e22' : null) });
  ctx.restore();
  if (u.dead) return;
  const bw = clamp(u.w, 34, 140), bx = u.x - bw / 2, by = u.y - u.h / 2 - 12;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
  ctx.fillStyle = u.team === 'player' ? '#2ecc71' : '#e74c3c'; ctx.fillRect(bx, by, bw * clamp(u.hp / u.maxHp, 0, 1), 4);
  if (u.team === 'player') {
    ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.fillStyle = '#1c3d2a';
    let lbl = u.label.length > 20 ? u.label.slice(0, 19) + '…' : u.label; if (u.special === 'trap') lbl += ` (${u.uses})`;
    ctx.strokeText(lbl, u.x, u.y + u.h / 2 + 14); ctx.fillText(lbl, u.x, u.y + u.h / 2 + 14);
  }
}
function drawProjectile(p) {
  ctx.save();
  if (p.trail && p.trail.length > 1) { ctx.strokeStyle = p.kind === 'fire' ? 'rgba(255,140,40,0.5)' : 'rgba(155,89,182,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); p.trail.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); }
  ctx.translate(p.x, p.y);
  if (p.kind === 'arrow') { ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(8, 0); ctx.moveTo(8, 0); ctx.lineTo(3, -4); ctx.moveTo(8, 0); ctx.lineTo(3, 4); ctx.moveTo(-12, 0); ctx.lineTo(-15, -3); ctx.moveTo(-12, 0); ctx.lineTo(-15, 3); ctx.stroke(); }
  else if (p.kind === 'fire') { ctx.fillStyle = `rgba(255,${110 + Math.floor(Math.random() * 80)},20,0.85)`; ctx.beginPath(); ctx.arc(rand(-3, 3), rand(-3, 3), 7 + Math.random() * 4, 0, Math.PI * 2); ctx.fill(); }
  else if (p.kind === 'magic') { ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d7bde2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8 + Math.sin(time * 20) * 2, 0, Math.PI * 2); ctx.stroke(); }
  else if (p.kind === 'bullet') { ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.strokeStyle = '#3a2a4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke(); ctx.fillStyle = '#f6e39b'; ctx.beginPath(); ctx.arc(5, 0, 2.5, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawSketchStrokes(strokesAbs, color, override) { MP.paint.drawShape(ctx, strokesAbs.map(s => s.pts ? s : { pts: s }), { defaultColor: color, lineColor: override || null }); }
function render(dt) {
  const shX = cam.shake > 0.5 ? rand(-cam.shake, cam.shake) : 0, shY = cam.shake > 0.5 ? rand(-cam.shake, cam.shake) * 0.6 : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  MP.world.drawBackground(ctx, cam, time, dt);
  ctx.save(); ctx.translate(-cam.x + shX, shY);
  const vis = u => u.x + u.w / 2 + 60 > cam.x && u.x - u.w / 2 - 60 < cam.x + W;
  for (const u of units) if (u.castle && vis(u)) drawUnit(u);
  const ground = units.filter(u => !u.castle && !u.flying && !u.mount && vis(u)).sort((a, b) => (a.static ? -1 : 0) - (b.static ? -1 : 0) || a.lane - b.lane);
  for (const u of ground) { drawUnit(u); if (u.rider) drawUnit(u.rider); }
  for (const u of units) if (u.flying && !u.mount && !u.castle && vis(u)) drawUnit(u);
  for (const p of projectiles) if (p.x > cam.x - 40 && p.x < cam.x + W + 40) drawProjectile(p);
  for (const p of particles) {
    if (p.x < cam.x - 60 || p.x > cam.x + W + 60) continue;
    ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
    if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, p.ring * (1 - p.life / 0.5), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(255,200,80,0.25)'; ctx.fill(); }
    else if (p.text != null) { ctx.fillStyle = p.color; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); }
    else { ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;
  }
  if (sketch) {
    const all = sketch.strokes.concat(sketch.cur ? [sketch.cur] : []);
    drawSketchStrokes(all, '#1f1f1f');
    if (sketch.strokes.length) { const a = MP.analyze(sketch.strokes.map(s => ({ pts: s }))); const ok = canPlaceAt(a.cx); ctx.strokeStyle = ok ? 'rgba(46,204,113,0.8)' : 'rgba(231,76,60,0.9)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(a.cx - a.w / 2 - 6, a.cy - a.h / 2 - 6, a.w + 12, a.h + 12); ctx.setLineDash([]); if (!ok) { ctx.fillStyle = '#c0392b'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('not your kingdom – it cannot come alive here', a.cx, a.cy - a.h / 2 - 14); } }
  }
  if (placing) {
    const ok = canPlaceAt(pointer.x);
    ctx.globalAlpha = 0.7; drawSketchStrokes(placementStrokes(pointer.x, pointer.y), '#1f1f1f', ok ? null : '#c0392b'); ctx.globalAlpha = 1;
    if (!ok) { ctx.fillStyle = '#c0392b'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('not your kingdom', pointer.x, pointer.y - placing.size / 2 - 14); }
  }
  ctx.restore();
  MP.world.drawForeground(ctx, cam, time, dt);
  drawMinimap();
  if (banner) { const a = clamp(banner.t, 0, 1); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = 'bold 40px system-ui'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.fillStyle = '#fff'; ctx.strokeText(banner.text, W / 2, 120); ctx.fillText(banner.text, W / 2, 120); ctx.font = '18px system-ui'; ctx.lineWidth = 4; ctx.strokeText(banner.sub, W / 2, 150); ctx.fillText(banner.sub, W / 2, 150); ctx.globalAlpha = 1; }
  if (speed === 0 && phase !== 'menu' && !studioPaused) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H - MINI_H); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px system-ui'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H / 2); ctx.font = '16px system-ui'; ctx.fillText('you can still draw, pan and inspect', W / 2, H / 2 + 30); }
}
function drawMinimap() {
  const y0 = H - MINI_H, sc = W / WORLD_W;
  ctx.fillStyle = 'rgba(15,18,22,0.92)'; ctx.fillRect(0, y0, W, MINI_H);
  for (const k of kingdoms) { ctx.fillStyle = k.owner === 'player' ? 'rgba(46,204,113,0.35)' : 'rgba(231,76,60,0.30)'; ctx.fillRect(k.left * sc, y0 + 4, (k.right - k.left) * sc - 1, MINI_H - 8); ctx.fillStyle = k.owner === 'player' ? '#2ecc71' : '#e74c3c'; ctx.fillRect(k.x * sc - 5, y0 + 10, 10, 12); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(k.name, k.x * sc, y0 + MINI_H - 5); }
  for (const u of units) { if (u.dead || u.castle) continue; ctx.fillStyle = u.team === 'player' ? '#7dffb0' : '#ff7b6b'; ctx.fillRect(u.x * sc - 1, y0 + (u.flying ? 8 : 20), 2, 3); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(cam.x * sc, y0 + 2, W * sc, MINI_H - 4);
}

/* ---------------- HUD / UI ---------------- */
function updateHud() {
  $('kingdomText').textContent = `${captured} / ${kingdoms.length}`; $('scoreText').textContent = score;
  $('armyText').textContent = units.filter(u => alive(u) && u.team === 'player' && !u.castle).length;
  $('enemyText').textContent = units.filter(u => alive(u) && u.team === 'enemy' && !u.castle).length;
  const k = kingdomAt(cam.x + W / 2); $('hereText').textContent = `${k.name} (${k.owner === 'player' ? 'yours' : 'enemy'})`;
  if (selected && !selected.dead) refreshInspectorStats();
  const el = $('kingdomInfo');
  if (k) el.innerHTML = `<table><tr><td>Name</td><td>${k.name}</td></tr><tr><td>Owner</td><td>${k.owner === 'player' ? 'you' : 'roaches'}</td></tr><tr><td>Difficulty</td><td>${'★'.repeat(k.level) || 'home'}</td></tr><tr><td>Castle HP</td><td>${k.castle ? Math.ceil(k.castle.hp) + ' / ' + k.castle.maxHp : '-'}</td></tr><tr><td>Enemies here</td><td>${units.filter(u => alive(u) && u.team === 'enemy' && !u.castle && u.x >= k.left && u.x < k.right).length}</td></tr>${k.owner === 'enemy' ? `<tr><td>Next raid</td><td>${Math.ceil(k.raidT)}s</td></tr>` : ''}</table>`;
}
let toastTimer = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 4000); }
function previewName() {
  if (!sketch || !sketch.strokes.length) { $('namePreview').textContent = 'Draw something first.'; return; }
  const spec = MP.parseWish($('nameInput').value);
  const shape = MP.analyze(sketch.strokes.map(s => ({ pts: s })));
  const st = MP.buildStats(spec, shape);
  const bits = [`<b>${MP.TYPE_NAMES[st.type]}</b>${spec.count > 1 ? ' ×' + spec.count : ''} – ${st.desc}`];
  bits.push(`HP ${st.hp} · DMG ${st.dmg}${st.range ? ' · range ' + Math.round(st.range) : ''} · speed ${st.speed} · order: ${st.stance}${spec.rider ? ' · rider' : ''}`);
  bits.push(st.notes.join(', '));
  bits.push(canPlaceAt(shape.cx) ? '<span class="ok">Inside your kingdom ✓</span>' : '<span class="bad">Outside your kingdom – draw on green ground</span>');
  $('namePreview').innerHTML = bits.join('<br>');
}
function positionNameBox() {
  if (!sketch || !sketch.strokes.length) return;
  const a = MP.analyze(sketch.strokes.map(s => ({ pts: s })));
  const rect = canvas.getBoundingClientRect(), stage = $('stage').getBoundingClientRect();
  const sx = rect.width / W, sy = rect.height / H, box = $('namebox');
  let left = (rect.left - stage.left) + (a.cx - cam.x) * sx - 165, top = (rect.top - stage.top) + (a.cy + a.h / 2 + 22) * sy;
  left = clamp(left, 4, stage.width - 340); if (top > stage.height - 160) top = (rect.top - stage.top) + (a.cy - a.h / 2) * sy - 160; top = clamp(top, 4, stage.height - 160);
  box.style.left = left + 'px'; box.style.top = top + 'px';
}
function showNameBox() { $('namebox').classList.remove('hidden'); positionNameBox(); previewName(); }
function clearSketch() { sketch = null; $('namebox').classList.add('hidden'); $('nameInput').value = ''; }
function renderInspector() {
  const el = $('inspector');
  if (!selected || selected.dead) { el.className = 'muted'; el.textContent = 'Click a living drawing to see how it works.'; return; }
  const u = selected; el.className = '';
  let html = `<div class="name">${escapeHtml(u.label)}</div><div class="type">${MP.TYPE_NAMES[u.type] || u.type} – ${escapeHtml(u.desc || '')}</div>`;
  html += `<table><tr><td>HP</td><td id="insHp"></td></tr><tr><td>Damage</td><td>${u.dmg}${u.elem ? ' (' + u.elem + ')' : ''}</td></tr><tr><td>Speed</td><td>${u.speed}</td></tr>`;
  if (u.range) html += `<tr><td>Range</td><td>${Math.round(u.range)}</td></tr>`;
  if (u.shape) html += `<tr><td>Legs</td><td>${u.shape.legs}</td></tr><tr><td>Spikes</td><td>${u.shape.spikes}</td></tr><tr><td>Closed body</td><td>${u.shape.closed ? 'yes' : 'no'}</td></tr><tr><td>Strokes</td><td>${u.shape.strokeCount}</td></tr><tr><td>Size</td><td>${Math.round(u.w)}×${Math.round(u.h)}</td></tr>`;
  if (u.flying) html += `<tr><td>Flying</td><td>yes</td></tr>`;
  if (u.mount) html += `<tr><td>Riding</td><td>${escapeHtml(u.mount.label)}</td></tr>`;
  if (u.rider) html += `<tr><td>Rider</td><td>${escapeHtml(u.rider.label)}</td></tr>`;
  html += `</table>`;
  if (u.notes && u.notes.length) html += `<div class="traits"><b>Why:</b> ${u.notes.join(' · ')}</div>`;
  if (u.team === 'player' && !u.static && u.special !== 'bomb') html += `<div><b>Orders</b></div><div class="stances">` + ['attack', 'guard', 'follow', 'patrol'].map(s => `<button data-stance="${s}" class="${u.stance === s ? 'on' : ''}">${s}</button>`).join('') + `</div>`;
  if (u.team === 'player' && !u.castle) html += `<button id="btnDismiss" class="ghost">Erase this drawing</button>`;
  el.innerHTML = html;
  el.querySelectorAll('[data-stance]').forEach(b => b.onclick = () => { u.stance = b.dataset.stance; u.post = u.x; if (u.stance === 'patrol') u.patrolBase = u.x; if (u.mount) u.mount.stance = u.stance; if (u.rider) u.rider.stance = u.stance; renderInspector(); });
  const d = $('btnDismiss'); if (d) d.onclick = () => { if (u.rider) dismount(u.rider); u.dead = true; u.deathT = 0; selected = null; renderInspector(); };
  refreshInspectorStats();
}
function refreshInspectorStats() { const e = $('insHp'); if (e && selected) e.textContent = `${Math.ceil(selected.hp)} / ${Math.round(selected.maxHp)}`; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------------- input ---------------- */
function screenPos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
function unitAt(wx, wy) { let best = null, bd = 1e9; for (const u of units) { if (u.dead) continue; if (Math.abs(wx - u.x) <= u.w / 2 + 8 && Math.abs(wy - u.y) <= u.h / 2 + 8) { const d = Math.hypot(wx - u.x, wy - u.y) + (u.castle ? 1000 : 0); if (d < bd) { bd = d; best = u; } } } return best; }
function setPointer(e) { const s = screenPos(e); pointer.sx = s.x; pointer.sy = s.y; pointer.x = s.x + cam.x; pointer.y = s.y; }
canvas.addEventListener('pointerdown', e => {
  if (phase === 'menu') return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {} setPointer(e);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2) { if (sketch && sketch.cur) sketch.cur = null; pointer.down = false; pan = { startX: e.clientX, camStart: cam.tx, touch: true }; return; }
  if (e.button === 2 || e.button === 1) { pan = { startX: e.clientX, camStart: cam.tx }; e.preventDefault(); return; }
  if (pointer.sy > H - MINI_H) { cam.tx = clamp(pointer.sx / W * WORLD_W - W / 2, 0, WORLD_W - W); return; }
  if (placing) { placeNow(); return; }
  pointer.down = true; pointer.startX = pointer.x; pointer.startY = pointer.y; pointer.moved = 0;
  if (!sketch) sketch = { strokes: [], cur: null };
  sketch.cur = [{ x: pointer.x, y: pointer.y }];
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pan) { const r = canvas.getBoundingClientRect(); cam.tx = clamp(pan.camStart - (e.clientX - pan.startX) * W / r.width, 0, WORLD_W - W); return; }
  setPointer(e);
  if (!pointer.down || !sketch || !sketch.cur) return;
  const last = sketch.cur[sketch.cur.length - 1];
  const d = Math.hypot(pointer.x - last.x, pointer.y - last.y);
  if (d >= 2.5) { sketch.cur.push({ x: pointer.x, y: pointer.y }); pointer.moved += d; }
});
function endPointer(e) {
  activePointers.delete(e.pointerId);
  if (pan) { if (activePointers.size === 0) pan = null; return; }
  if (!pointer.down) return; pointer.down = false;
  if (!sketch || !sketch.cur) return;
  const cur = sketch.cur; sketch.cur = null;
  if (pointer.moved < 6) {
    const u = unitAt(pointer.startX, pointer.startY);
    if (u) { selected = u; renderInspector(); if (!sketch.strokes.length) sketch = null; return; }
    if (!sketch.strokes.length) { sketch = null; selected = null; renderInspector(); return; }
    cur.length = 1;
  }
  sketch.strokes.push(cur);
  showNameBox();
  if (!('ontouchstart' in window)) $('nameInput').focus();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); if (placing && e.shiftKey) { placing.size = clamp(placing.size * (e.deltaY > 0 ? 0.92 : 1.08), 30, 500); return; } cam.tx = clamp(cam.tx + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.6, 0, WORLD_W - W); }, { passive: false });

$('nameInput').addEventListener('input', previewName);
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); bringToLife(); } if (e.key === 'Escape') { e.preventDefault(); clearSketch(); } e.stopPropagation(); });
$('nameGo').onclick = bringToLife; $('nameClear').onclick = clearSketch;
document.addEventListener('keydown', e => {
  if (MP.studio.isOpen || e.target === $('nameInput') || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (e.key === 'Enter' && sketch && sketch.strokes.length) { $('nameInput').focus(); e.preventDefault(); }
  else if (e.key === 'Escape') { if (placing) stopPlacement(); else if (sketch) clearSketch(); else { selected = null; renderInspector(); } }
  else if (k === 'p' && phase !== 'menu') setSpeed(speed === 0 ? 1 : 0);
  else if (k === 'h') toggleBook();
  else if (k === 's' && phase !== 'menu') MP.studio.open(null);
  else if (k === '1') goHome(); else if (k === '2') goFront();
  else if (k === '[' && placing) placing.size = clamp(placing.size * 0.9, 30, 500);
  else if (k === ']' && placing) placing.size = clamp(placing.size * 1.1, 30, 500);
  else if (k === 'f' && placing) placing.flip = !placing.flip;
  else if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) { keys.add(k); e.preventDefault(); }
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function goHome() { cam.tx = clamp(kingdoms[0].x - W / 2, 0, WORLD_W - W); }
function goFront() { const c = nearestCastleTo(cam.x + W / 2, 'enemy') || nearestCastleTo(cam.x + W / 2, 'player'); if (c) cam.tx = clamp(c.x - W / 2, 0, WORLD_W - W); }
function setSpeed(s) { speed = s; [0, 1, 2].forEach(i => $('btnSpeed' + i).classList.toggle('on', i === s)); }
function toggleBook() { $('spellbook').classList.toggle('hidden'); }
$('btnSpeed0').onclick = () => setSpeed(0); $('btnSpeed1').onclick = () => setSpeed(1); $('btnSpeed2').onclick = () => setSpeed(2);
$('btnHome').onclick = goHome; $('btnFront').onclick = goFront;
$('btnStudio').onclick = () => { if (phase === 'menu') startGame(); MP.studio.open(null); };
$('btnBook').onclick = toggleBook; $('btnBookClose').onclick = toggleBook;
$('btnRestart').onclick = () => { if (phase === 'menu' || confirm('Restart the whole world? Your library is kept.')) { phase = 'menu'; showOverlay(null); } };
$('btnStart').onclick = startGame;
$('btnContinue').onclick = () => { $('overlay').classList.add('hidden'); phase = 'playing'; };
window.addEventListener('resize', () => { if (sketch) positionNameBox(); });
function showOverlay(finalText, continueLabel) {
  $('overlay').classList.remove('hidden');
  const f = $('finalScore'); if (finalText) { f.classList.remove('hidden'); f.textContent = finalText; } else f.classList.add('hidden');
  $('btnStart').textContent = finalText ? 'Start a new world' : 'Pick up the pencil';
  const c = $('btnContinue'); if (continueLabel) { c.classList.remove('hidden'); c.textContent = continueLabel; } else c.classList.add('hidden');
}

/* ---------------- game flow ---------------- */
function startGame() {
  units = []; projectiles = []; particles = []; score = 0; kills = 0; selected = null; won = false; time = 0; invasionT = 75; clearSketch(); stopPlacement();
  kingdoms = KINGDOM_DEFS.map((d, i) => Object.assign({}, d, { id: i, owner: d.level === 0 ? 'player' : 'enemy', castle: null, raidT: 50 + d.level * 12 }));
  MP.world.init(kingdoms, WORLD_W);
  for (const k of kingdoms) { makeCastle(k, k.owner, 1); if (k.owner === 'enemy') spawnGarrison(k, false); }
  captured = 1; cam.x = cam.tx = 0; lastKingdomId = 0; banner = null;
  phase = 'playing'; setSpeed(1); $('overlay').classList.add('hidden'); renderInspector(); updateHud();
  toast('Welcome to Greenhaven. Draw on the green ground, name it, press Enter. March east to capture Mudlands!');
}
function gameOver() { phase = 'over'; showOverlay(`The roaches scribbled over Greenhaven. Score ${score}, ${kills} scribbles erased, ${captured} kingdoms held.`, null); }
function setStudioPause(v) { studioPaused = v; }
let hudT = 0;
function tick(raw) {
  const dt = (phase === 'playing' && !studioPaused) ? raw * speed : 0;
  if (phase !== 'menu' && !studioPaused) {
    const ps = 900 * raw; if (keys.has('arrowleft') || keys.has('a')) cam.tx -= ps; if (keys.has('arrowright') || keys.has('d')) cam.tx += ps;
    cam.tx = clamp(cam.tx, 0, WORLD_W - W); cam.x += (cam.tx - cam.x) * Math.min(1, raw * 9); cam.shake *= Math.pow(0.02, raw);
    if (dt > 0) update(dt);
    const k = kingdomAt(cam.x + W / 2); if (k.id !== lastKingdomId) { lastKingdomId = k.id; if (!banner) banner = { text: k.name, sub: k.owner === 'player' ? 'your kingdom – you can draw here' : `enemy kingdom ${'★'.repeat(k.level)} – capture the castle`, t: 3 }; }
    hudT -= raw; if (hudT <= 0) { hudT = 0.25; updateHud(); if (sketch) positionNameBox(); }
  }
  if (!studioPaused) render(raw);
}
function loop(ts) { const raw = Math.min(0.05, (ts - lastT) / 1000 || 0); lastT = ts; tick(raw); requestAnimationFrame(loop); }

MP.game = { frame: tick, panTo(x) { cam.tx = clamp(x, 0, WORLD_W - W); }, get community() { return community; }, setCommunity(arr) { community = arr; }, loadCommunity, step(sec) { for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); updateHud(); }, toast, startPlacement, stopPlacement, setStudioPause, startGame, createUnits, get units() { return units; }, get kingdoms() { return kingdoms; }, get state() { return { score, kills, captured, phase, speed, time, cam: { x: cam.x }, placing: !!placing, sketch }; }, spawnEnemy, launchRaid, flipKingdom, setSketch(s) { sketch = { strokes: s, cur: null }; showNameBox(); }, setName(n) { $('nameInput').value = n; previewName(); }, bringToLife, setCam(x) { cam.x = cam.tx = clamp(x, 0, WORLD_W - W); }, setSpeed };
MP.studio.init(); loadCommunity();
kingdoms = KINGDOM_DEFS.map((d, i) => Object.assign({}, d, { id: i, owner: d.level === 0 ? 'player' : 'enemy', castle: null, raidT: 60 }));
MP.world.init(kingdoms, WORLD_W);
for (const k of kingdoms) makeCastle(k, k.owner, 1);
updateHud();
requestAnimationFrame(loop);
})(window.MP);
