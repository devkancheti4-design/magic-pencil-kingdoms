'use strict';
/* Shared vocabulary: what a NAME makes a thing do, and what a SHAPE decides. */
window.MP = window.MP || {};
(function (MP) {
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ARCH = {
  melee:   { hp: 80,  dmg: 12, speed: 62,  range: 0,   cd: 0.8,  desc: 'walks up to enemies and hits them' },
  ranged:  { hp: 40,  dmg: 9,  speed: 46,  range: 270, cd: 1.3,  proj: 'arrow', desc: 'shoots arrows from a distance (can hit flyers)' },
  mount:   { hp: 75,  dmg: 5,  speed: 135, range: 0,   cd: 1.0,  desc: 'runs fast and kicks; carries a rider' },
  flyer:   { hp: 34,  dmg: 8,  speed: 95,  range: 0,   cd: 0.9,  flying: true, desc: 'flies over walls and dives on enemies' },
  dragon:  { hp: 95,  dmg: 9,  speed: 70,  range: 170, cd: 0.55, flying: true, proj: 'fire', splash: 45, elem: 'fire', desc: 'flies and breathes fire on groups' },
  wall:    { hp: 260, dmg: 0,  speed: 0,   range: 0,   cd: 1,    static: true, desc: 'stands still and blocks the road' },
  tower:   { hp: 220, dmg: 10, speed: 0,   range: 300, cd: 1.2,  static: true, proj: 'arrow', desc: 'a building that shoots arrows at anything near' },
  bomb:    { hp: 22,  dmg: 75, speed: 85,  range: 0,   cd: 0,    special: 'bomb', blast: 100, desc: 'runs at the nearest enemy and explodes' },
  healer:  { hp: 36,  dmg: 0,  speed: 42,  range: 0,   cd: 1,    special: 'heal', healRate: 8, healRadius: 150, stance: 'guard', desc: 'heals nearby friends and castles' },
  bait:    { hp: 90,  dmg: 0,  speed: 0,   range: 0,   cd: 1,    static: true, special: 'bait', lure: 240, desc: 'roaches drop everything to eat it' },
  trap:    { hp: 1,   dmg: 18, speed: 0,   range: 0,   cd: 1,    static: true, special: 'trap', uses: 4, stun: 2, desc: 'hidden; roaches stepping on it get stuck and hurt' },
  cannon:  { hp: 55,  dmg: 24, speed: 30,  range: 320, cd: 2.4,  proj: 'shell', splash: 75, desc: 'slow, long range, splash damage; great against castles' },
  mage:    { hp: 36,  dmg: 17, speed: 42,  range: 240, cd: 1.7,  proj: 'magic', desc: 'fires magic bolts that hit hard' },
  creature:{ hp: 45,  dmg: 8,  speed: 56,  range: 0,   cd: 0.9,  desc: 'a generic creature; its shape decides everything' },
};
const TYPE_NAMES = { melee: 'Fighter', ranged: 'Archer', mount: 'Mount', flyer: 'Flyer', dragon: 'Dragon', wall: 'Wall', tower: 'Tower', bomb: 'Bomb', healer: 'Healer', bait: 'Bait', trap: 'Trap', cannon: 'Cannon', mage: 'Mage', creature: 'Creature', boss: 'Boss', castle: 'Castle', spitter: 'Spitter', beetle: 'Beetle' };
const WORDS = {
  melee: 'blade blades saw sawblade shuriken scythe knife dagger axe hammer spear drill chainsaw soldier warrior knight swordsman fighter man guard samurai ninja robot giant ogre troll bear lion tiger wolf dog cat hero king queen boxer viking pirate zombie monster stickman person boy girl spearman lancer gladiator gorilla bull rhino goblin orc dwarf elf barbarian caveman cowboy wrestler karate kungfu sumo yeti bigfoot golem mummy skeleton vampire werewolf crocodile alligator dinosaur trex raptor shark octopus snake spider scorpion crab ant beetle frog toad fox hyena boar pig cow goat sheep chicken duck penguin turtle tortoise hedgehog porcupine mouse rat squirrel rabbit bunny kangaroo monkey ape human guy dude police cop firefighter farmer chef teacher titan demon devil ghost',
  ranged: 'archer arrowman bowman bow gunner shooter sniper hunter slinger ranger crossbow rifleman musketeer marksman pistol gun rifle',
  mount: 'horse pony camel elephant donkey bike bicycle car motorcycle motorbike cart chariot deer ostrich zebra mule buggy skateboard scooter unicorn moose reindeer llama giraffe buffalo yak truck jeep train',
  flyer: 'bird eagle plane jet bee bat hawk owl crow pigeon helicopter drone butterfly wasp parrot falcon ufo airplane seagull swan goose hornet mosquito dragonfly moth fly sparrow vulture rocketship spaceship balloon kite',
  dragon: 'dragon phoenix wyvern',
  wall: 'wall shield fence rock barrier castle gate tree house box stone brick block door barricade boulder bush mountain pillar statue cactus hill fort bunker sandbag crate barrel log',
  tower: 'tower watchtower lighthouse',
  bomb: 'bomb tnt dynamite grenade meteor missile rocket firework explosive mine nuke torpedo',
  healer: 'doctor healer nurse medic angel heart priest fairy cleric monk',
  bait: 'cake apple pizza cheese food burger candy cookie banana sandwich donut bread sugar meat chicken fish bone garbage trash icecream chocolate honey lollipop pie hotdog fries soup rice noodles egg milk',
  trap: 'hole pit spikes spike trap mud glue net web quicksand puddle swamp',
  cannon: 'cannon tank catapult artillery mortar turret bazooka ballista trebuchet',
  mage: 'wizard mage witch sorcerer magician warlock shaman genie sorceress necromancer',
};
const WORD_INDEX = {};
for (const t in WORDS) for (const w of WORDS[t].split(/\s+/)) WORD_INDEX[w] = t;
const MODS = {};
const addMods = (list, m) => list.split(' ').forEach(w => MODS[w] = m);
addMods('fast quick speedy swift turbo zoom rapid', { speed: 1.6, tag: 'fast' });
addMods('slow lazy heavy fat sleepy', { speed: 0.6, tag: 'slow' });
addMods('giant huge big mega large enormous', { hp: 1.5, dmg: 1.5, speed: 0.85, tag: 'giant' });
addMods('tiny small mini little baby', { hp: 0.6, dmg: 0.6, speed: 1.15, tag: 'tiny' });
addMods('strong mighty super tough iron steel golden gold diamond armored armoured power powerful', { hp: 1.4, dmg: 1.3, tag: 'strong' });
addMods('weak paper', { hp: 0.6, dmg: 0.7, tag: 'weak' });
addMods('angry mad crazy wild', { dmg: 1.3, speed: 1.15, hp: 0.9, tag: 'angry' });
addMods('brave royal', { hp: 1.2, tag: 'brave' });
const ELEMS = {};
'fire flame flaming lava burning hot'.split(' ').forEach(w => ELEMS[w] = 'fire');
'ice frost frozen snow cold icy'.split(' ').forEach(w => ELEMS[w] = 'ice');
'poison toxic venom poisonous'.split(' ').forEach(w => ELEMS[w] = 'poison');
'lightning thunder electric shock'.split(' ').forEach(w => ELEMS[w] = 'shock');
const STANCES = {};
'attack charge go fight kill march'.split(' ').forEach(w => STANCES[w] = 'attack');
'guard defend protect stay hold wait stand'.split(' ').forEach(w => STANCES[w] = 'guard');
'follow come'.split(' ').forEach(w => STANCES[w] = 'follow');
'patrol walk wander'.split(' ').forEach(w => STANCES[w] = 'patrol');
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 8, twin: 2, pair: 2, couple: 2 };
const GROUPS = { army: 4, squad: 3, team: 3, pack: 4, herd: 4, swarm: 5, gang: 3, crowd: 5, legion: 6, troop: 3, platoon: 5, group: 3, bunch: 3, flock: 4 };
const ANIMS = {};
const addAnim = (list, a) => list.split(' ').forEach(w => ANIMS[w] = a);
addAnim('spinning spin spins rotating rotate rotates whirling whirl twirling twirl blade blades saw sawblade shuriken propeller fan windmill drill tornado buzzsaw', 'spin');
addAnim('rolling roll rolls wheel wheels ball boulder tire tyre tumbling', 'roll');
addAnim('floating float floats hovering hover hovers levitating levitate ghost ghostly balloon cloud bubble spirit', 'hover');
addAnim('bouncing bouncy bounce bounces jumping jump jumps hopping hop hops frog kangaroo rabbit bunny grasshopper spring pogo', 'bounce');
addAnim('shaking shaky vibrating vibrate jittery nervous trembling wobbly wobble wobbling', 'shake');
addAnim('wiggling wiggle slithering slither snake worm eel wavy', 'slither');
const ANIM_DESC = { spin: 'spins – hits everything it touches', roll: 'rolls along (speed ×1.2)', hover: 'floats above the ground (no legs needed)', bounce: 'bounces along', shake: 'shakes nervously', slither: 'wiggles as it moves' };
const ARM_WORDS = new Set(['arm', 'arms', 'armed', 'bow', 'bows', 'hand', 'hands', 'head', 'heads', 'gun', 'guns', 'sword', 'swords', 'claw', 'claws', 'tentacle', 'tentacles', 'fist', 'fists']);
const ELEM_DESC = { fire: 'sets enemies on fire', ice: 'freezes enemies (slow)', poison: 'poisons enemies', shock: 'shocks enemies (stun)' };

function variants(w) {
  const v = [w];
  if (w.endsWith('men')) v.push(w.slice(0, -3) + 'man');
  if (w.endsWith('ies')) v.push(w.slice(0, -3) + 'y');
  if (w.endsWith('ves')) v.push(w.slice(0, -3) + 'f', w.slice(0, -3) + 'fe');
  if (w.endsWith('es')) v.push(w.slice(0, -2));
  if (w.endsWith('s')) v.push(w.slice(0, -1));
  if (w.endsWith('ing')) v.push(w.slice(0, -3), w.slice(0, -3) + 'e');
  return v;
}
function look(table, w) { for (const v of variants(w)) if (table[v] != null) return table[v]; return null; }

function parseWish(text) {
  const words = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const spec = { type: null, typeWord: null, count: 1, arms: 1, armWord: null, anims: {}, mods: [], elem: null, stance: null, flying: false, rider: false, label: String(text || '').trim() || 'thing' };
  let explicitCount = false, groupSeen = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i], nx = words[i + 1];
    const num = /^\d+$/.test(w) ? parseInt(w, 10) : NUMBERS[w];
    if (num != null && nx && ARM_WORDS.has(nx)) { spec.arms = clamp(num, 1, 8); spec.armWord = nx; i++; continue; }
    const an = look(ANIMS, w); if (an) spec.anims[an] = true;
    if (/^\d+$/.test(w)) { spec.count = clamp(parseInt(w, 10), 1, 10); explicitCount = true; continue; }
    if (NUMBERS[w] != null) { spec.count = NUMBERS[w]; explicitCount = true; continue; }
    const g = look(GROUPS, w); if (g) { groupSeen = true; if (!explicitCount) spec.count = g; continue; }
    if (w === 'flying' || w === 'winged' || w === 'wings' || w === 'pegasus') { spec.flying = true; if (w === 'pegasus' && !spec.type) { spec.type = 'mount'; spec.typeWord = w; } continue; }
    if (w === 'rider' || w === 'riding' || w === 'mounted' || w === 'cavalry' || w === 'horseman' || w === 'horsemen') { spec.rider = true; if (w === 'cavalry' || w.startsWith('horsem')) { if (!spec.type) { spec.type = 'melee'; spec.typeWord = w; } } continue; }
    const m = look(MODS, w); if (m) { spec.mods.push(m); continue; }
    const e = look(ELEMS, w); if (e) { spec.elem = e; continue; }
    const s = look(STANCES, w); if (s) { spec.stance = s; continue; }
    const t = look(WORD_INDEX, w);
    if (t) {
      if (!spec.type) { spec.type = t; spec.typeWord = w; }
      else if (t === 'mount' && spec.type !== 'mount') spec.rider = true;
      else if (spec.type === 'mount' && t !== 'mount') { spec.type = t; spec.typeWord = w; spec.rider = true; }
    }
  }
  if (!spec.type && spec.armWord && /^(bow|bows|gun|guns)$/.test(spec.armWord)) { spec.type = 'ranged'; spec.typeWord = spec.armWord; }
  if (!spec.type) { spec.type = groupSeen ? 'melee' : (spec.flying ? 'flyer' : 'creature'); spec.typeWord = groupSeen ? 'army' : null; }
  return spec;
}

/* strokes: array of {kind?, pts:[{x,y}], color?, width?} or plain arrays of points. Returns strokes with pts relative to the centre. */
function analyze(strokesIn) {
  const src = strokesIn.map(s => Array.isArray(s) ? { pts: s } : s).filter(s => s.pts && s.pts.length);
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, ink = 0;
  for (const s of src) for (let i = 0; i < s.pts.length; i++) {
    const p = s.pts[i];
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (i && s.kind !== 'fill') ink += Math.hypot(p.x - s.pts[i - 1].x, p.y - s.pts[i - 1].y);
  }
  if (!src.length) { minX = minY = 0; maxX = maxY = 10; }
  const w = Math.max(10, maxX - minX), h = Math.max(10, maxY - minY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let spikes = 0, closed = false, legIdx = 0, hasFill = false, lines = 0;
  const strokes = src.map(s => {
    const kind = s.kind || 'line';
    const pts = s.pts.map(p => ({ x: p.x - cx, y: p.y - cy }));
    let sMinX = 1e9, sMaxX = -1e9, sMinY = 1e9, sMaxY = -1e9, len = 0, top = pts[0];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < sMinX) sMinX = p.x; if (p.x > sMaxX) sMaxX = p.x; if (p.y < sMinY) sMinY = p.y; if (p.y > sMaxY) sMaxY = p.y;
      if (p.y < top.y) top = p;
      if (i) len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    }
    const st = { kind, pts, isLeg: false, top: null, legIdx: 0, len, color: s.color || null, width: s.width || (kind === 'crayon' ? 22 : 3), box: { x0: sMinX, x1: sMaxX, y0: sMinY, y1: sMaxY } };
    if (kind === 'fill') { hasFill = true; return st; }
    if (kind !== 'line') return st;
    lines++;
    const sw = sMaxX - sMinX, sh = sMaxY - sMinY;
    const endGap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    const isClosed = len > 70 && endGap < Math.max(16, len * 0.09);
    if (isClosed) closed = true;
    st.isLeg = !isClosed && sh >= h * 0.12 && sh >= sw * 0.8 && sMaxY >= h / 2 - h * 0.3 && len < (w + h) * 0.9 && pts.length > 2;
    if (st.isLeg) { st.top = { x: top.x, y: top.y }; st.legIdx = legIdx++; }
    const samp = [];
    for (const p of pts) if (!samp.length || Math.hypot(p.x - samp[samp.length - 1].x, p.y - samp[samp.length - 1].y) >= 9) samp.push(p);
    for (let i = 1; i < samp.length - 1; i++) {
      const ax = samp[i].x - samp[i - 1].x, ay = samp[i].y - samp[i - 1].y, bx = samp[i + 1].x - samp[i].x, by = samp[i + 1].y - samp[i].y;
      const cosA = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
      if (cosA < -0.35) spikes++;
    }
    return st;
  });
  // colour strokes that sit inside a leg move with that leg
  const legs = strokes.filter(s => s.isLeg);
  for (const s of strokes) if (!s.isLeg && s.kind !== 'line' && legs.length) {
    const L = legs.find(l => s.box.x0 >= l.box.x0 - 8 && s.box.x1 <= l.box.x1 + 8 && s.box.y0 >= l.box.y0 - 8 && s.box.y1 <= l.box.y1 + 8);
    if (L) { s.top = L.top; s.legIdx = L.legIdx; }
  }
  if (hasFill) closed = true;
  return { strokes, w, h, cx, cy, ink, legs: legIdx, spikes, closed, hasFill, strokeCount: strokes.length, lineCount: lines };
}

function buildStats(spec, shape) {
  const base = ARCH[spec.type];
  const size = clamp(Math.sqrt(shape.w * shape.h) / 95, 0.35, 3.5);
  const st = { type: spec.type, hp: base.hp * Math.pow(size, 1.25), dmg: base.dmg * Math.pow(size, 0.7), speed: base.speed * Math.pow(1 / size, 0.3),
    range: base.range ? base.range * (0.8 + 0.2 * size) : 0, cd: base.cd, flying: !!base.flying || spec.flying, static: !!base.static,
    special: base.special || null, proj: base.proj || null, splash: base.splash || 0, blast: base.blast || 0, healRate: base.healRate || 0,
    healRadius: base.healRadius || 0, lure: base.lure || 0, uses: base.uses || 0, stun: base.stun || 0, elem: spec.elem || base.elem || null,
    stance: spec.stance || base.stance || 'attack', size, notes: [] };
  st.notes.push(size > 1.3 ? `big (×${size.toFixed(1)}) → tougher, slower` : size < 0.7 ? `small (×${size.toFixed(1)}) → weak but quick` : `normal size (×${size.toFixed(1)})`);
  st.anims = spec.anims || {};
  if (!st.static && !st.flying && !st.anims.hover) {
    if (shape.legs === 0) { st.speed *= 0.65; st.notes.push('no legs → wriggles (speed ×0.65)'); }
    else { const f = clamp(1 + 0.1 * (shape.legs - 2), 0.8, 1.6); st.speed *= f; st.notes.push(`${shape.legs} leg${shape.legs > 1 ? 's' : ''} → speed ×${f.toFixed(2)}`); }
  }
  if (shape.spikes > 0) { const f = 1 + 0.06 * Math.min(shape.spikes, 10); st.dmg *= f; st.notes.push(`${shape.spikes} spikes → damage ×${f.toFixed(2)}`); }
  if (shape.closed) { st.hp *= 1.25; st.notes.push(shape.hasFill ? 'coloured-in body → +25% HP (armour)' : 'closed body → +25% HP (armour)'); }
  if (shape.strokeCount > 8) { const f = 1 + clamp((shape.strokeCount - 8) / 80, 0, 0.5); st.hp *= f; st.notes.push(`masterpiece detail (${shape.strokeCount} strokes) → HP ×${f.toFixed(2)}`); }
  for (const m of spec.mods) { st.hp *= m.hp || 1; st.dmg *= m.dmg || 1; st.speed *= m.speed || 1; st.notes.push(m.tag); }
  for (const a in st.anims) { st.notes.push(ANIM_DESC[a]); if (a === 'roll') st.speed *= 1.2; }
  st.arms = spec.arms || 1;
  if (st.arms > 1) { if (st.range > 0) st.notes.push(`${st.arms} ${spec.armWord} → fires ${st.arms} shots at once`); else { const f = 1 + 0.5 * (st.arms - 1); st.dmg *= f; st.notes.push(`${st.arms} ${spec.armWord} → damage ×${f.toFixed(1)}`); } }
  if (st.elem === 'shock') st.dmg *= 1.25;
  if (st.elem) st.notes.push(ELEM_DESC[st.elem]);
  if (spec.flying && !base.flying) st.notes.push('flying');
  if (st.flying && !base.flying && !st.static) st.speed *= 1.2;
  st.hp = Math.max(1, Math.round(st.hp)); st.dmg = Math.round(st.dmg * 10) / 10; st.speed = Math.round(st.speed);
  st.desc = base.desc;
  return st;
}

MP.ARCH = ARCH; MP.TYPE_NAMES = TYPE_NAMES; MP.parseWish = parseWish; MP.analyze = analyze; MP.buildStats = buildStats; MP.clamp = clamp;
})(window.MP);
