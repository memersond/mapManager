# Assets

## Pipeline (`tools/asepritePlugin.ts`)
- Vite plugin. On dev start and build, packs every `.ase`/`.aseprite` under `assets/` into `public/generated/atlas.png` + `atlas.json` with the Aseprite CLI. In dev it re-exports and reloads when an Aseprite file changes.
- Decision: one atlas so every sprite shares a texture and Phaser can batch them in a single draw call.
- Output is gitignored; Aseprite is required to build. Binary is `$ASEPRITE`, else the default Steam install, else `aseprite` on `PATH`.
- Frames are named `<file name>/<frame index>` (e.g. `trees/1`), so file names must be unique across folders.

## Runtime (`src/assets/SpriteAtlas.ts`)
- `BootScene` loads the atlas and creates a looping animation for every multi-frame sprite, using the frame durations set in Aseprite.
- Multi-frame sprites can be shown as an animation or as random variants; resources choose via `spriteMode`. See [[Resources]].
- Aseprite tags are not used yet; a file is one animation.
