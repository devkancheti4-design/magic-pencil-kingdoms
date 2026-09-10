#!/usr/bin/env node
/* Smoke test: serve the game, open it in headless Chromium, start a match, bring a drawing to life,
   run a few seconds of simulation and fail on any page error. Used by CI (npx puppeteer) and by maintainers. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.mp4': 'video/mp4', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  const result = await page.evaluate(() => {
    document.getElementById('btnStart').click();
    const c = document.getElementById('game'), r = c.getBoundingClientRect(), toClient = (x, y) => ({ clientX: r.left + x * r.width / 1280, clientY: r.top + y * r.height / 720 });
    const stroke = pts => { const p0 = toClient(pts[0].x, pts[0].y); c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true, button: 0, ...p0 })); for (let i = 1; i < pts.length; i++) { const q = toClient(pts[i].x, pts[i].y); c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true, ...q })); } const pl = toClient(pts[pts.length - 1].x, pts[pts.length - 1].y); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true, button: 0, ...pl })); };
    const head = []; for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.3) head.push({ x: 700 + Math.cos(a) * 12, y: 470 + Math.sin(a) * 12 });
    stroke(head); stroke([{ x: 700, y: 482 }, { x: 700, y: 540 }]); stroke([{ x: 700, y: 540 }, { x: 686, y: 580 }]); stroke([{ x: 700, y: 540 }, { x: 714, y: 580 }]);
    MP.game.setName('4 arm archer'); MP.game.bringToLife();
    MP.game.spawnEnemy('soldier', 900, 1, 'attack');
    MP.game.step(6);
    const player = MP.game.units.filter(u => u.team === 'player' && !u.castle);
    return { players: player.length, arms: player[0] && player[0].arms, kills: MP.game.state.kills, kingdoms: MP.game.kingdoms.length, community: MP.game.community.length };
  });
  await browser.close(); server.close();
  console.log(JSON.stringify(result));
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  if (result.players !== 1 || result.arms !== 4 || result.kingdoms !== 6) { console.error('unexpected game state'); process.exit(1); }
  console.log('smoke test passed');
})().catch(e => { console.error(e); process.exit(1); });
