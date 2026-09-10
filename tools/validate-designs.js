#!/usr/bin/env node
/* Validates a community designs file. Usage: node tools/validate-designs.js <file> [--base <file-on-main>] */
const fs = require('fs');
const [, , file, ...rest] = process.argv;
const baseIdx = rest.indexOf('--base'); const baseFile = baseIdx >= 0 ? rest[baseIdx + 1] : null;
const errors = [];
const fail = m => { console.log('- ' + m); process.exit(1); };
if (!file) fail('usage: node tools/validate-designs.js community/designs.json');
let arr;
try { arr = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail('community/designs.json is not valid JSON: ' + e.message); }
if (!Array.isArray(arr)) fail('The file must be a JSON array of designs: [ {...}, {...} ]');
const size = fs.statSync(file).size;
if (size > 3e6) errors.push(`The file is ${(size / 1e6).toFixed(1)} MB; keep it under 3 MB (remove the "thumb" field from your design)`);
const ids = new Set(), KINDS = new Set(['line', 'crayon', 'fill']);
const bad = /https?:\/\/|www\.|<|>|\b(fuck|shit|bitch|cunt|nigg|fag|dick|porn|sex|nazi|hitler|rape)/i;
arr.forEach((d, i) => {
  const where = `design #${i + 1}${d && typeof d.name === 'string' ? ` ("${d.name.slice(0, 40)}")` : ''}`;
  if (!d || typeof d !== 'object') return errors.push(`${where}: must be an object`);
  if (typeof d.id !== 'string' || !/^[\w-]{3,60}$/.test(d.id)) errors.push(`${where}: "id" must be 3-60 letters, digits, - or _`);
  else if (ids.has(d.id)) errors.push(`${where}: duplicate id "${d.id}"`); else ids.add(d.id);
  if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 60) errors.push(`${where}: "name" must be 1-60 characters (it is also the creature's wish)`);
  else if (bad.test(d.name)) errors.push(`${where}: the name contains a link or a word we don't allow – keep it family friendly`);
  if (d.author != null && (typeof d.author !== 'string' || d.author.length > 40 || bad.test(d.author))) errors.push(`${where}: "author" must be a short, family-friendly name (no links)`);
  if (d.size != null && !(typeof d.size === 'number' && d.size >= 40 && d.size <= 420)) errors.push(`${where}: "size" must be a number between 40 and 420`);
  if (!Array.isArray(d.strokes) || !d.strokes.length) return errors.push(`${where}: "strokes" must be a non-empty array (export it from the Studio)`);
  if (d.strokes.length > 600) errors.push(`${where}: too many strokes (${d.strokes.length}); keep it under 600`);
  let pts = 0;
  d.strokes.forEach((s, j) => {
    if (!s || typeof s !== 'object') return errors.push(`${where}: stroke ${j + 1} must be an object`);
    if (s.kind != null && !KINDS.has(s.kind)) errors.push(`${where}: stroke ${j + 1} has unknown kind "${s.kind}" (line, crayon or fill)`);
    if (!Array.isArray(s.pts) || !s.pts.length) return errors.push(`${where}: stroke ${j + 1} needs a "pts" array`);
    pts += s.pts.length;
    if (!s.pts.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 1e5 && Math.abs(p.y) < 1e5)) errors.push(`${where}: stroke ${j + 1} has invalid points (each must be {"x": number, "y": number})`);
    if (s.color != null && !/^#[0-9a-f]{3,8}$/i.test(s.color)) errors.push(`${where}: stroke ${j + 1} colour "${s.color}" must be a hex colour like #e8a7bd`);
    if (s.width != null && !(Number.isFinite(s.width) && s.width > 0 && s.width <= 60)) errors.push(`${where}: stroke ${j + 1} width must be between 1 and 60`);
  });
  if (pts > 40000) errors.push(`${where}: ${pts} points is a lot; keep a design under 40,000 points`);
  for (const k of Object.keys(d)) if (!['id', 'name', 'size', 'author', 'strokes', 'thumb', 'created'].includes(k)) errors.push(`${where}: unexpected field "${k}" (allowed: id, name, size, author, strokes, thumb, created)`);
});
if (baseFile) { try { for (const d of JSON.parse(fs.readFileSync(baseFile, 'utf8'))) if (d && d.id && !ids.has(d.id)) errors.push(`the design "${d.name}" (${d.id}) was removed – please only add or update your own designs`); } catch (e) { /* no base file */ } }
if (errors.length) { console.log(errors.map(e => '- ' + e).join('\n')); process.exit(1); }
console.log(`OK: ${arr.length} design(s) valid`);
