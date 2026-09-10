/* Ad recorder: load this into the running game page, then call recordAd(). It drives the engine frame by frame
   (MP.game.frame), draws captions on top, and POSTs every frame to tools/frameserver.py. Also emits community/designs.json. */
(function () {
  const W = 1280, H = 720, FPS = 30, DT = 1 / FPS, SERVER = 'http://127.0.0.1:8766';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const FONT = '"Chalkboard SE", Chalkboard, "Comic Sans MS", "Segoe UI", sans-serif';
  let frameNo = 0;
  const circ = (cx, cy, r, n) => { n = n || 24; const o = []; for (let i = 0; i <= n; i++) o.push({ x: cx + Math.cos(i / n * Math.PI * 2) * r, y: cy + Math.sin(i / n * Math.PI * 2) * r }); return o; };
  const L = (pts, color, width) => ({ kind: 'line', pts, color: color || '#1f1f1f', width: width || 4 });
  const F = (pts, color) => ({ kind: 'fill', pts, color });
  const poly = (...xy) => { const o = []; for (let i = 0; i < xy.length; i += 2) o.push({ x: xy[i], y: xy[i + 1] }); o.push({ x: xy[0], y: xy[1] }); return o; };
  const seg = (...xy) => { const o = []; for (let i = 0; i < xy.length; i += 2) o.push({ x: xy[i], y: xy[i + 1] }); return o; };
  const arc = (cx, cy, r, a0, a1, n) => { n = n || 12; const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); } return o; };

  /* ---------- the stars of the ad (also seeded into community/designs.json) ---------- */
  const G = '#5fbf4a';
  const hulk = () => {
    const head = circ(0, -118, 26), torso = poly(-58, -92, 58, -92, 70, -10, -70, -10), shorts = poly(-70, -10, 70, -10, 60, 30, -60, 30);
    const armL = poly(-58, -90, -100, -70, -125, 10, -100, 20, -80, -50), armR = poly(58, -90, 100, -70, 125, 10, 100, 20, 80, -50), fistL = circ(-112, 18, 16), fistR = circ(112, 18, 16);
    return [F(head, G), F(torso, G), F(armL, G), F(armR, G), F(fistL, G), F(fistR, G), F(shorts, '#8e44ad'), L(head), L(torso), L(armL), L(armR), L(fistL), L(fistR), L(shorts),
      L(seg(-40, 30, -44, 100), '#1f1f1f', 9), L(seg(40, 30, 44, 100), '#1f1f1f', 9), L(seg(-16, -130, -3, -122), '#1f1f1f', 3), L(seg(16, -130, 3, -122), '#1f1f1f', 3), L(seg(-10, -104, 10, -104), '#1f1f1f', 3), L(seg(-20, -60, 20, -60, 0, -30), '#3a7a2a', 3)];
  };
  const archer4 = () => {
    const head = circ(0, -70, 14), st = [F(head, '#e8a7bd'), L(head, '#1f1f1f', 3), L(seg(0, -56, 0, 0), '#1f1f1f', 4), L(seg(0, 0, -14, 42), '#1f1f1f', 4), L(seg(0, 0, 14, 42), '#1f1f1f', 4)];
    const arms = [[-42, 36, -56], [-32, 40, -30], [-22, 38, -4], [-12, 34, 20]];
    for (const [ay, ex, ey] of arms) { st.push(L(seg(0, ay, ex, ey), '#1f1f1f', 3)); st.push(L(arc(ex, ey, 13, -Math.PI / 2 + 0.2, Math.PI / 2 - 0.2), '#7f5539', 3)); st.push(L(seg(ex + 2, ey - 12, ex + 2, ey + 12), '#7f5539', 1.5)); }
    st.push(L(seg(-5, -74, -3, -72), '#1f1f1f', 2.5), L(seg(5, -74, 3, -72), '#1f1f1f', 2.5));
    return st;
  };
  const blades = () => { const s = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 18 : 52; s.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } return [F(s, '#b8c2cc'), L(s, '#1f1f1f', 3.5), F(circ(0, 0, 9), '#2a2438'), L(circ(0, 0, 9), '#1f1f1f', 2)]; };
  const dragon = () => {
    const body = poly(-80, 0, -50, -22, 20, -24, 62, -8, 76, 14, 44, 34, -20, 30, -62, 22), wingL = poly(-20, -22, -60, -84, -10, -58, 30, -92, 34, -22), head = poly(62, -8, 92, -20, 108, -4, 96, 12, 76, 14), tail = seg(-80, 0, -110, -14, -128, 6, -112, 22);
    return [F(wingL, '#f7b880'), F(body, '#d63c3c'), F(head, '#d63c3c'), L(wingL, '#1f1f1f', 3.5), L(body, '#1f1f1f', 4), L(head, '#1f1f1f', 3.5), L(tail, '#1f1f1f', 4), L(seg(-56, 24, -60, 52), '#1f1f1f', 5), L(seg(20, 30, 22, 56), '#1f1f1f', 5), L(seg(96, -12, 99, -10), '#f6e39b', 3), L(seg(92, 6, 108, 2, 96, 10), '#1f1f1f', 2), L(seg(102, -4, 120, -2, 116, 6, 130, 8), '#f39c12', 4)];
  };
  const ball = () => [F(circ(0, 0, 26), '#9fb8e8'), L(circ(0, 0, 26), '#1f1f1f', 4), L(arc(0, 0, 14, 0.3, 2.6), '#1c3a6e', 3)];
  const frog = () => { const body = poly(-32, 0, -20, -28, 20, -28, 32, 0, 20, 14, -20, 14); return [F(body, '#7fc46e'), L(body, '#1f1f1f', 4), F(circ(-12, -30, 7), '#fff'), F(circ(12, -30, 7), '#fff'), L(circ(-12, -30, 7), '#1f1f1f', 2.5), L(circ(12, -30, 7), '#1f1f1f', 2.5), F(circ(-11, -30, 3), '#1f1f1f'), F(circ(13, -30, 3), '#1f1f1f'), L(seg(-24, 8, -34, 34), '#1f1f1f', 5), L(seg(24, 8, 34, 34), '#1f1f1f', 5), L(seg(-10, 2, 10, 2), '#1f1f1f', 2.5)]; };
  const wizard = () => { const robe = poly(-8, -46, 8, -46, 28, 40, -28, 40), hat = poly(-22, -60, 22, -60, 4, -104), head = circ(0, -60, 13); return [F(robe, '#2b6cd9'), F(hat, '#1c3a6e'), F(head, '#e8a7bd'), L(robe, '#1f1f1f', 3.5), L(hat, '#1f1f1f', 3.5), L(head, '#1f1f1f', 3), L(seg(-6, -18, -22, 40), '#1f1f1f', 4), L(seg(6, -18, 22, 40), '#1f1f1f', 4), L(seg(20, -30, 40, 44), '#7f5539', 4), L(circ(42, -32, 6), '#a9d9ee', 3), L(seg(-4, -64, -2, -62), '#1f1f1f', 2), L(seg(4, -64, 2, -62), '#1f1f1f', 2), L(seg(-10, -50, 10, -50, 0, -40), '#fff', 3)]; };
  const knight = () => { const head = circ(0, -64, 13), body = poly(-14, -50, 14, -50, 16, -6, -16, -6), shield = circ(-30, -30, 14); return [F(body, '#9fb8e8'), F(head, '#e8a7bd'), F(shield, '#f6e39b'), L(head, '#1f1f1f', 3), L(body, '#1f1f1f', 3.5), L(shield, '#1f1f1f', 3), L(seg(0, -6, -12, 38), '#1f1f1f', 4), L(seg(0, -6, 12, 38), '#1f1f1f', 4), L(seg(14, -40, 40, -70), '#7f8c8d', 5), L(seg(-14, -78, 14, -78, 0, -92), '#1f1f1f', 3)]; };
  const cannon = () => { const barrel = poly(-30, -30, 30, -50, 36, -36, -24, -12), base = poly(-40, -12, 24, -12, 30, 10, -46, 10); return [F(base, '#7f5539'), F(barrel, '#2a2438'), L(barrel, '#1f1f1f', 4), L(base, '#1f1f1f', 4), F(circ(-24, 12, 12), '#f6e39b'), L(circ(-24, 12, 12), '#1f1f1f', 3), F(circ(14, 12, 12), '#f6e39b'), L(circ(14, 12, 12), '#1f1f1f', 3)]; };
  const designs = [
    { id: 'seed-green-monster', name: 'giant strong green monster', size: 240, author: 'Dev (creator)', strokes: hulk() },
    { id: 'seed-4arm-archer', name: '4 arm archer', size: 150, author: 'Dev (creator)', strokes: archer4() },
    { id: 'seed-floating-blades', name: 'floating blades', size: 110, author: 'Dev (creator)', strokes: blades() },
    { id: 'seed-fire-dragon', name: 'fire dragon', size: 220, author: 'Dev (creator)', strokes: dragon() },
    { id: 'seed-ice-wizard', name: 'ice wizard', size: 150, author: 'Dev (creator)', strokes: wizard() },
    { id: 'seed-bouncing-frog', name: 'bouncing frog', size: 90, author: 'Dev (creator)', strokes: frog() },
  ];
  const at = (design, x, y) => design.map(s => ({ kind: s.kind, pts: s.pts.map(p => ({ x: p.x + x, y: p.y + y })), color: s.color, width: s.width }));

  /* ---------- frame capture & overlays ---------- */
  const buffer = [];
  async function flush() { if (!buffer.length) return; const body = JSON.stringify(buffer.splice(0)); await fetch(`${SERVER}/batch`, { method: 'POST', body }); }
  async function capture() {
    // synchronous capture (toDataURL) so a hidden/throttled tab cannot slow the recording; uploads go in batches
    buffer.push({ name: `f${String(frameNo).padStart(5, '0')}.jpg`, b64: canvas.toDataURL('image/jpeg', 0.86).split(',')[1] });
    frameNo++; window.__adProgress = frameNo;
    if (buffer.length >= 60) await flush();
  }
  const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
  function text(str, x, y, size, opts) {
    opts = opts || {}; ctx.save(); ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha; ctx.font = `${opts.weight || 'bold'} ${size}px ${FONT}`; ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.18; ctx.strokeStyle = opts.stroke || 'rgba(30,20,50,0.85)'; ctx.strokeText(str, x, y); ctx.fillStyle = opts.color || '#fff'; ctx.fillText(str, x, y); ctx.restore();
  }
  function caption(str, alpha, y) { ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = 'rgba(30,20,50,0.72)'; const w = Math.min(W - 60, str.length * 15 + 60); ctx.beginPath(); ctx.roundRect((W - w) / 2, (y || 600) - 26, w, 52, 14); ctx.fill(); ctx.restore(); text(str, W / 2, y || 600, 26, { alpha, stroke: 'rgba(0,0,0,0)' }); }
  function dim(a) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  function pencil(x, y) { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.75); ctx.fillStyle = '#f6c343'; ctx.fillRect(-6, -70, 12, 60); ctx.fillStyle = '#e8a7bd'; ctx.fillRect(-6, -78, 12, 9); ctx.fillStyle = '#f3d9b1'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(6, -10); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1f1f1f'; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(2, -4); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2a2438'; ctx.lineWidth = 2; ctx.strokeRect(-6, -78, 12, 70); ctx.restore(); }
  function nameBox(x, y, typed, blink) { ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - 170, y, 340, 46, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#222'; ctx.font = `20px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(typed + (blink ? '|' : ''), x - 156, y + 23); ctx.restore(); }
  const camX = () => MP.game.state.cam.x;
  async function run(seconds, perFrame) { const n = Math.round(seconds * FPS); for (let i = 0; i < n; i++) { MP.game.frame(DT); if (perFrame) perFrame(i / n, i); await capture(); } }
  async function drawAnimated(design, x, y, seconds, cap) {
    const lines = design.filter(s => s.kind === 'line'), total = lines.reduce((a, s) => a + s.pts.length, 0), n = Math.round(seconds * FPS);
    for (let i = 0; i < n; i++) {
      const reveal = Math.max(1, Math.floor(total * (i + 1) / n)); const partial = []; let acc = 0, tip = null;
      for (const s of lines) { if (acc >= reveal) break; const cnt = Math.min(s.pts.length, reveal - acc); const pts = s.pts.slice(0, cnt).map(p => ({ x: p.x + x, y: p.y + y })); partial.push(pts); tip = pts[pts.length - 1]; acc += cnt; }
      MP.game.setSketch(partial); MP.game.frame(DT); if (tip) pencil(tip.x - camX(), tip.y); if (cap) caption(cap, ease(i / 8)); await capture();
    }
  }
  async function typeName(design, x, y, name, seconds, cap) {
    const shape = MP.analyze(at(design, x, y)); const n = Math.round(seconds * FPS);
    for (let i = 0; i < n; i++) { const typed = name.slice(0, Math.ceil(name.length * Math.min(1, i / (n * 0.7)))); MP.game.frame(DT); nameBox(shape.cx - camX(), shape.cy + shape.h / 2 + 18, typed, Math.floor(i / 8) % 2 === 0); if (cap) caption(cap); await capture(); }
  }
  function alive(design, x, y, name) { MP.game.setSketch([]); return MP.game.createUnits(at(design, x, y), name, { quiet: true }); }

  /* ---------- the ad ---------- */
  async function recordAd() {
    frameNo = 0; window.__adProgress = 0; window.__adDone = false;
    document.getElementById('btnStart').click(); MP.game.setCommunity([]); MP.game.setSpeed(1); MP.game.setCam(0);
    // S0 title
    await run(3.6, k => { dim(0.35 * (1 - ease((k - 0.75) * 4))); const a = ease(k * 3); text('MAGIC PENCIL', W / 2, 250, 96, { alpha: a, color: '#7dffb0' }); text('Kingdoms of Paper', W / 2, 330, 40, { alpha: ease(k * 3 - 0.4) }); text('whatever you draw comes alive', W / 2, 400, 30, { alpha: ease(k * 3 - 0.8), weight: 'normal', color: '#f6e39b' }); });
    // S1 hulk
    await drawAnimated(hulk(), 700, 470, 4.2, '1.  Draw anything');
    await typeName(hulk(), 700, 470, 'giant strong green monster', 2.2, '2.  Name it – the name is its wish');
    const H1 = alive(hulk(), 700, 470, 'giant strong green monster');
    for (const [k, x] of [['soldier', 1050], ['soldier', 1110], ['brute', 1160], ['soldier', 1220]]) MP.game.spawnEnemy(k, x, 1, 'attack');
    await run(3.6, k => caption('giant + strong  →  it stomps everything in its way', ease(k * 4)));
    // S2 archer
    await drawAnimated(archer4(), 560, 520, 2.2, '4 arms?  Sure.');
    await typeName(archer4(), 560, 520, '4 arm archer', 1.4, '4 arms?  Sure.');
    alive(archer4(), 560, 520, '4 arm archer');
    const p1 = MP.game.spawnEnemy('plane', 980, 2, 'attack'); p1.y = 220; const p2 = MP.game.spawnEnemy('plane', 1060, 2, 'attack'); p2.y = 300;
    for (const x of [960, 1020, 1090]) MP.game.spawnEnemy('soldier', x, 1, 'attack');
    await run(4.2, k => caption('4 arms  →  4 arrows at once.  Every word matters.', ease(k * 4)));
    // S3 floating blades + variety
    await drawAnimated(blades(), 760, 540, 1.3, 'floating blades?');
    await typeName(blades(), 760, 540, 'floating blades', 1.0, 'floating blades?');
    alive(blades(), 760, 540, 'floating blades');
    for (const x of [1000, 1040, 1080, 1120]) MP.game.spawnEnemy(x === 1080 ? 'brute' : 'soldier', x, 1, 'attack');
    alive(dragon(), 640, 250, 'fire dragon'); alive(ball(), 500, 560, 'rolling ball'); alive(frog(), 420, 560, 'bouncing frog'); alive(wizard(), 340, 520, 'ice wizard');
    const words = ['floating  →  it floats.   spinning  →  it spins.', 'fire dragon · ice wizard · rolling ball · bouncing frog', 'fast · giant · flying · 4 arms · army · guard · follow'];
    await run(6.0, k => caption(words[Math.min(2, Math.floor(k * 3))], ease((k * 3 % 1) * 5)));
    // S4 the war
    for (let i = 0; i < 6; i++) alive(knight(), 600 + i * 55, 540, 'giant strong knight');
    for (let i = 0; i < 3; i++) alive(archer4(), 420 + i * 60, 540, '4 arm archer');
    alive(cannon(), 300, 560, 'cannon'); alive(dragon(), 500, 230, 'fire dragon');
    MP.game.setSpeed(2);
    let capturedAt = -1, t4 = 0;
    for (let i = 0; i < Math.round(13 * FPS); i++) {
      const front = Math.max(...MP.game.units.filter(u => u.team === 'player' && !u.castle).map(u => u.x));
      MP.game.panTo(Math.min(front - 520, 1650 - 640)); MP.game.frame(DT); t4 += DT;
      const k = MP.game.kingdoms[1]; if (k.owner === 'player' && capturedAt < 0) capturedAt = t4;
      caption(capturedAt < 0 ? '3.  March on the roach kingdoms.  Smash the castle.' : 'Capture it.  Build there.  Six kingdoms to take.', 1);
      await capture(); if (capturedAt >= 0 && t4 - capturedAt > 3.2) break;
    }
    MP.game.setSpeed(1);
    // S5 challengers
    MP.game.setCommunity(designs.map((d, i) => Object.assign({}, d, { author: ['Ravi', 'Mia', 'Kenji', 'Ana', 'Leo', 'Zara'][i] })));
    MP.game.setCam(1250);
    const chal = []; for (let i = 0; i < 6; i++) chal.push(MP.game.spawnEnemy('challenger', 2200 + i * 70, 2, 'attack'));
    await run(6.5, k => { caption('Face the unknown: other players’ creations invade your kingdom', ease(k * 4), 600); for (const u of chal) if (!u.dead) text('by ' + u.author, u.x - camX(), u.y - u.h / 2 - 26, 16, { color: '#ffd166' }); });
    // S6 end card
    await run(7.0, k => { dim(ease(k * 4) * 0.8); text('Unlimited ink.  Unlimited enemies.', W / 2, 220, 44, { alpha: ease(k * 4), color: '#7dffb0' }); text('The limit is your imagination.', W / 2, 300, 52, { alpha: ease(k * 4 - 0.6) }); text('Against everyone else’s.', W / 2, 356, 34, { alpha: ease(k * 4 - 1.0), color: '#f6e39b' }); text('Free  ·  open source  ·  play in your browser', W / 2, 450, 26, { alpha: ease(k * 4 - 1.4), weight: 'normal' }); text('devkancheti4-design.github.io/magic-pencil-kingdoms', W / 2, 500, 30, { alpha: ease(k * 4 - 1.6), color: '#a9d9ee' }); text('Add your creature on GitHub and it invades other players', W / 2, 560, 24, { alpha: ease(k * 4 - 1.8), weight: 'normal', color: '#e8a7bd' }); });
    await flush();
    await fetch(`${SERVER}/?name=designs.json`, { method: 'POST', body: JSON.stringify(designs) });
    window.__adDone = true; return frameNo;
  }
  window.recordAd = recordAd; window.adDesigns = designs;
})();
