# Contributing – add your creation to the game

Every creature in Magic Pencil is a drawing plus a name. Yours can become one of the
**unknown challengers** other players face in raids and castle garrisons.

## Add a design (no coding needed)

1. Play the game (`index.html` or the live site) and open **✎ Studio**.
2. Draw your masterpiece. Outline with the pen, colour it in with the bucket or crayon.
   Give it a name that is also its wish – e.g. `4 arm archer`, `giant strong green monster`,
   `fire dragon guard`, `fast ice wolf`. The Spellbook in the game lists every word that matters.
3. **Save to library**, then press **Export** under the library bar. That downloads
   `magic-pencil-library.json`.
4. Open `community/designs.json`, paste your design object(s) into the array and add an
   `"author": "your name"` field. Keep the `strokes`, `name` and `size` fields exactly as exported
   (the `thumb` field can be removed to keep the file small).
5. Open a pull request titled `design: <name>`.

Rules: family friendly, your own drawing, one design per PR is easiest to review.

## Improve the game

Everything is plain JavaScript with no build step:

| file | what it does |
| --- | --- |
| `vocab.js` | words → behaviour (`parseWish`), shape → stats (`analyze`, `buildStats`) |
| `paint.js` | the crayon renderer used by the world and the studio |
| `world.js` | the cartoon world: sky, hills, biomes, castles |
| `studio.js` | the Design Studio and the library |
| `game.js` | units, AI, kingdoms, camera, input, HUD |

Open `index.html` through any static server (`python3 -m http.server`) and hack away.
New creature words, new modifiers, new biomes and new enemy sprites are all welcome.
