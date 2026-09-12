# Three.js experiments

```bash
npm run dev
```

Each experiment is a self-contained page under `experiments/`, served at its own
URL. The menu at `/` lists them automatically.

| Path | What it is |
| --- | --- |
| `/experiments/01-isometric-floor/` | Orthographic isometric camera, checkerboard floor, arrow-key movement in two styles |
| `/experiments/02-stick-figure/` | Jointed stick character with outlines, a lathed torso and tube limbs |
| `/experiments/03-character-builder/` | The same figure with a lil-gui panel driving its proportions and colours. Saved looks are in [presets.md](experiments/03-character-builder/presets.md) |
| `/experiments/04-speech-bubbles/` | Speech bubbles as real HTML in the scene, via CSS2DRenderer |
| `/experiments/05-drifting-speech/` | Speech as a stream of single characters that drift and decay on a half-life |
| `/experiments/06-interaction/` | Walk up to things and press Enter: a lamp, a crate you carry, a sign you read |

## Adding one

Copy any experiment folder and rename it. The naming pattern is `NN-what-it-is`,
which sets the order in the menu and becomes its title. Nothing needs
registering: the menu discovers folders at build time, and so does the Vite
config.

Keep experiments self-contained. Copying a hundred lines between them is fine
and is the point — an experiment you can butcher without breaking the others is
worth more than a shared abstraction. If something survives being copied three
times, move it to `src/`.
