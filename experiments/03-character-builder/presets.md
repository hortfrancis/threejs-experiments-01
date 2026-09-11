# Character presets

Values read off the builder panel at `/experiments/03-character-builder/`.
To make one the starting point, paste its object over `DEFAULTS` in `main.js`.

## Happy chappy

Saved 11 September 2026. White head, electric blue shirt, very thin limbs, and
a fast bouncy walk. The thin limbs against a heavy 1.1 outline are what give it
the inked look.

| Group | Value | |
| --- | --- | --- |
| Head | size | 0.23 |
| | squash | 1.1 |
| | skin | `#ffffff` |
| Torso | height | 0.49 |
| | width | 0.165 |
| | waist | 0.96 |
| | shirt | `#1e00ff` |
| Legs | length | 0.5 |
| | thickness | 0.015 |
| | stance | 0.05 |
| Arms | length | 0.5 |
| | thickness | 0.015 |
| | splay | 0.25 |
| Ink | outline | 1.1 |
| | colour | `#000000` |
| Movement | speed | 6.5 |
| | swing | 0.9 |

```js
{
  headRadius: 0.23,
  headSquash: 1.1,
  skin: '#ffffff',

  torsoHeight: 0.49,
  torsoWidth: 0.165,
  waist: 0.96,
  shirt: '#1e00ff',

  legLength: 0.5,
  legThickness: 0.015,
  stance: 0.05,

  armLength: 0.5,
  armThickness: 0.015,
  armSplay: 0.25,

  outline: 1.1,
  ink: '#000000',

  walkSwing: 0.9,
  speed: 6.5,
}
```
