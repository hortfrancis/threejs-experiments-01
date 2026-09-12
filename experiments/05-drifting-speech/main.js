import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

// ---------------------------------------------------------------------------
// Scene, camera, floor.
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// A second renderer that draws no pixels at all. It takes HTML elements
// attached to objects in the scene, projects each object's position to screen
// coordinates, and moves the element there with a CSS transform. The text is
// therefore real DOM: crisp at any zoom, styleable, no font files to load.
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.id = 'labels';
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#faf6ef');

const viewSize = 8;
const aspect = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  (-viewSize * aspect) / 2,
  (viewSize * aspect) / 2,
  viewSize / 2,
  -viewSize / 2,
  0.1,
  200,
);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight('#cfc6b6', 1.6));

const sun = new THREE.DirectionalLight('#fffaf0', 2.2);
sun.position.set(-7, 12, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.normalBias = 0.02;
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
scene.add(sun);

const GRID = 10;
const TILE = 1;

const floor = new THREE.Group();
const tileGeometry = new THREE.PlaneGeometry(TILE, TILE);
const lightTile = new THREE.MeshStandardMaterial({ color: '#f2ece1', roughness: 1 });
const darkTile = new THREE.MeshStandardMaterial({ color: '#e3dacb', roughness: 1 });

for (let x = 0; x < GRID; x++) {
  for (let z = 0; z < GRID; z++) {
    const tile = new THREE.Mesh(tileGeometry, (x + z) % 2 === 0 ? lightTile : darkTile);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set((x - (GRID - 1) / 2) * TILE, 0, (z - (GRID - 1) / 2) * TILE);
    tile.receiveShadow = true;
    floor.add(tile);
  }
}

scene.add(floor);

// ---------------------------------------------------------------------------
// The figure — the "Happy chappy" preset from experiment 03.
// ---------------------------------------------------------------------------
const body = {
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
};

const inkMaterial = new THREE.MeshBasicMaterial({ color: body.ink });
const skinMaterial = new THREE.MeshBasicMaterial({ color: body.skin });
const shirtMaterial = new THREE.MeshBasicMaterial({ color: body.shirt });
const outlineMaterial = new THREE.MeshBasicMaterial({ color: body.ink, side: THREE.BackSide });

const root = new THREE.Group();
scene.add(root);

function inked(geometry, material) {
  const part = new THREE.Group();

  const fill = new THREE.Mesh(geometry, material);
  fill.castShadow = true;
  part.add(fill);

  const shell = new THREE.Mesh(geometry, outlineMaterial);
  shell.scale.setScalar(body.outline);
  part.add(shell);

  return part;
}

function noodle(points, radius) {
  const curve = new THREE.CatmullRomCurve3(points);
  const limb = new THREE.Group();

  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 8, false), inkMaterial);
  tube.castShadow = true;
  limb.add(tube);

  for (const t of [0, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), inkMaterial);
    cap.position.copy(curve.getPoint(t));
    cap.castShadow = true;
    limb.add(cap);
  }

  return limb;
}

function joint(x, y) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  root.add(pivot);
  return pivot;
}

const hipY = body.legLength + 0.02;
const torsoY = hipY + body.torsoHeight / 2 - 0.04;
const torsoTop = torsoY + body.torsoHeight / 2;
const shoulderY = torsoTop - 0.08;
const headY = torsoTop + body.headRadius * body.headSquash - 0.06;

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const leftLeg = joint(-body.torsoWidth * 0.45, hipY);
const rightLeg = joint(body.torsoWidth * 0.45, hipY);
leftLeg.add(noodle(
  [V(0, 0, 0), V(-body.stance * 0.6, -body.legLength / 2, 0.01), V(-body.stance, -body.legLength, 0)],
  body.legThickness,
));
rightLeg.add(noodle(
  [V(0, 0, 0), V(body.stance * 0.6, -body.legLength / 2, 0.01), V(body.stance, -body.legLength, 0)],
  body.legThickness,
));

const leftArm = joint(-body.torsoWidth * 0.72, shoulderY);
const rightArm = joint(body.torsoWidth * 0.72, shoulderY);
leftArm.add(noodle(
  [V(0, 0, 0), V(-body.armSplay * 0.7, -body.armLength / 2, 0.02), V(-body.armSplay, -body.armLength, 0)],
  body.armThickness,
));
rightArm.add(noodle(
  [V(0, 0, 0), V(body.armSplay * 0.7, -body.armLength / 2, 0.02), V(body.armSplay, -body.armLength, 0)],
  body.armThickness,
));

const w = body.torsoWidth;
const h = body.torsoHeight;
const profile = new THREE.SplineCurve([
  new THREE.Vector2(0.001, -h / 2),
  new THREE.Vector2(w * 0.65, -h * 0.475),
  new THREE.Vector2(w * 0.93, -h * 0.35),
  new THREE.Vector2(w, -h * 0.17),
  new THREE.Vector2(w * body.waist, h * 0.03),
  new THREE.Vector2(w * 0.95, h * 0.23),
  new THREE.Vector2(w * 0.74, h * 0.43),
  new THREE.Vector2(0.001, h / 2),
]).getPoints(48);

for (const point of profile) point.x = Math.max(point.x, 0.001);

const torso = inked(new THREE.LatheGeometry(profile, 40), shirtMaterial);
torso.position.y = torsoY;
root.add(torso);

const head = new THREE.Group();
head.position.y = headY;
root.add(head);

const ball = inked(new THREE.SphereGeometry(body.headRadius, 32, 24), skinMaterial);
ball.scale.y = body.headSquash;
head.add(ball);

const r = body.headRadius;
const eyeGeometry = new THREE.SphereGeometry(r * 0.13, 12, 8);
for (const side of [-1, 1]) {
  const eye = new THREE.Mesh(eyeGeometry, inkMaterial);
  eye.position.set(side * r * 0.34, r * 0.2 * body.headSquash, r * 0.88);
  head.add(eye);
}

const mouth = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 12, 8), inkMaterial);
mouth.position.set(0, -r * 0.24 * body.headSquash, r * 0.94);
mouth.scale.set(1.1, 0.5, 0.4);
head.add(mouth);

// ---------------------------------------------------------------------------
// Speech, as a stream of individual characters.
//
// Every keystroke spawns one glyph in the air above his head and lets go of
// it. Each drifts leftwards at a constant rate and decays on a half-life, so
// what you get is not text but a trail of sound: type fluently and the letters
// stay packed tightly enough to read as words, hesitate and your sentence
// spreads out and dissolves before you finish it.
//
// The newest character sits at his head and older ones trail off to the left,
// which is why the line still reads left to right.
// ---------------------------------------------------------------------------
// Unlike the character builder, nothing here needs rebuilding when a value
// changes. Every glyph's position and opacity is recomputed from these numbers
// on every frame, so a slider affects the letters already in the air as well
// as the next ones — drag the half-life down and the whole trail evaporates.
const speech = {
  pace: 2,         // drift speed, in character widths per second
  gap: 1.05,       // minimum letter spacing, in character widths
  lift: 0,         // upward drift, world units per second
  curl: 0.05,      // how much that lift accelerates

  lifetime: 4.5,   // seconds from spoken to completely gone
  curve: 1,        // shape of the fade; see fadeAt() below
  restart: 0.9,    // silence, in seconds, that ends the current utterance

  tilt: 9,         // degrees of random rotation per letter
  size: 22,        // font size in pixels
  ink: '#101014',  // colour when freshly spoken
  fade: '#595959', // and the colour it has drifted to by the end
};

// Reused every frame. THREE.Color parses CSS colour strings and interpolates
// between them, so there is no need to pull in anything else to do this.
const inkColour = new THREE.Color();
const fadeColour = new THREE.Color();
const blended = new THREE.Color();

// How visible a character is, from 1 when spoken to 0 at the end of its life.
//
// The curve is the exponent on the remaining life, which is a single number
// that covers the whole range of shapes:
//
//   below 1   holds its brightness, then drops away sharply at the end
//   1         an even, linear fade
//   above 1   dims quickly at first, then lingers faintly for a long time
//
// Whatever the curve, it reaches exactly zero at the end, so nothing ever pops
// out of existence.
function fadeAt(age) {
  return Math.pow(1 - age / speech.lifetime, speech.curve);
}

// An orthographic camera maps a fixed number of world units to the window
// height, which gives an exact conversion between pixels and world units. The
// stream then keeps the same letter spacing at any window size.
let worldPerPixel = viewSize / window.innerHeight;

// A monospace glyph is about 0.6 of its font size wide. Knowing that in world
// units is what lets letters be placed off each other's edges rather than by
// timing alone.
function glyphWidth() {
  return speech.size * 0.6 * worldPerPixel;
}

// Minimum centre-to-centre distance between neighbours. At a gap of 1 they
// touch exactly, so anything from 1 upwards can never overlap.
function advance() {
  return glyphWidth() * speech.gap;
}

// Shared with the movement code below: the camera's flattened view direction
// and world up, from which every screen-relative direction is derived.
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const glyphs = [];
const MAX_GLYPHS = 400;

// Time since the last keystroke. Starts high so the very first character is
// treated as the opening of a fresh utterance.
let silence = Infinity;

// Reused each frame and at each keystroke.
const spawnPoint = new THREE.Vector3();
const screenLeft = new THREE.Vector3();
const rightward = new THREE.Vector3();
const separation = new THREE.Vector3();

// The direction that reads as "leftwards" on screen. Because the camera is
// orthographic and this vector is flattened onto the ground, moving along it
// is pure horizontal motion in the final image, whatever the camera angle.
function updateScreenLeft() {
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  screenLeft.crossVectors(forward, WORLD_UP).negate();
}

function speak(character) {
  updateScreenLeft();

  const element = document.createElement('div');
  const glyph = document.createElement('span');
  glyph.className = 'glyph';
  glyph.textContent = character;

  // A touch of rotation per letter, set once, so the trail looks spoken
  // rather than typeset. The renderer owns the outer element's transform, so
  // the tilt has to go on an inner span.
  glyph.style.transform = `rotate(${(Math.random() - 0.5) * speech.tilt}deg)`;
  element.append(glyph);

  const object = new CSS2DObject(element);

  // Above his head, and slightly to the right, so the stream flows out across
  // open air rather than over his face.
  head.getWorldPosition(spawnPoint);
  object.position
    .copy(spawnPoint)
    .addScaledVector(screenLeft, -0.22)
    .setY(spawnPoint.y + body.headRadius * body.headSquash + 0.35);

  // Kerning, but only within one utterance. After a pause the chain is broken
  // and this character starts back at his mouth, instead of being tacked onto
  // the end of a sentence that is still drifting away and fading out.
  const continuing = silence < speech.restart;
  silence = 0;

  // The previous letter has been drifting since it was typed. If it has not
  // yet cleared a full advance, this one is placed off its edge rather than at
  // the mouth, so letters can never land on top of each other. Type faster
  // than the drift and the words queue up ahead of him instead.
  const previous = continuing ? glyphs[glyphs.length - 1] : null;
  if (previous) {
    rightward.copy(screenLeft).negate();
    separation.subVectors(object.position, previous.object.position);

    const clearance = separation.dot(rightward);
    const needed = advance();

    if (clearance < needed) object.position.addScaledVector(rightward, needed - clearance);
  }

  scene.add(object);

  glyphs.push({
    element,
    // The colour now differs from letter to letter, by age, so it can no
    // longer come from a single CSS variable shared by all of them.
    glyph,
    object,
    age: 0,
    // Only the direction is fixed at birth, so turning the camera later does
    // not drag old words around with it. Speed is read from the sliders each
    // frame rather than baked in here.
    direction: screenLeft.clone(),
  });

  if (glyphs.length > MAX_GLYPHS) {
    const oldest = glyphs.shift();
    oldest.object.removeFromParent();
    oldest.element.remove();
  }
}

function updateGlyphs(delta) {
  silence += delta;

  // Parsed once per frame rather than once per letter.
  inkColour.set(speech.ink);
  fadeColour.set(speech.fade);

  // Drift is now purely how fast the trail leaves, measured in character
  // widths per second. Letter spacing is handled at spawn, so the two controls
  // no longer multiply into one another.
  const lateral = glyphWidth() * speech.pace;

  for (let i = glyphs.length - 1; i >= 0; i--) {
    const item = glyphs[i];
    item.age += delta;

    // Past the end of its life it is removed. Testing the age rather than the
    // opacity matters: a fractional curve on a negative remainder is NaN.
    if (item.age >= speech.lifetime) {
      item.object.removeFromParent();
      item.element.remove();
      glyphs.splice(i, 1);
      continue;
    }

    const opacity = fadeAt(item.age);

    // Colour travels evenly with time, whatever shape the opacity fade takes,
    // so a word visibly changes hue as it drifts off even on a flat curve.
    blended.copy(inkColour).lerp(fadeColour, item.age / speech.lifetime);
    item.glyph.style.color = '#' + blended.getHexString();

    item.object.position.addScaledVector(item.direction, lateral * delta);
    item.object.position.y += (speech.lift + speech.curl * item.age) * delta;
    item.element.style.opacity = String(opacity);
  }
}

// ---------------------------------------------------------------------------
// The panel. Size and colour reach the glyphs as CSS custom properties, so one
// assignment restyles every letter on screen at once.
// ---------------------------------------------------------------------------
function applyTypeStyle() {
  const style = document.documentElement.style;
  style.setProperty('--glyph-size', speech.size + 'px');
  style.setProperty('--ink', speech.ink);
}

applyTypeStyle();

const gui = new GUI({ title: 'Speech' });

const streamFolder = gui.addFolder('Stream');
streamFolder.add(speech, 'pace', 0.2, 20, 0.1).name('drift (widths/sec)');
streamFolder.add(speech, 'gap', 0.5, 6, 0.05).name('gap (× width)');
streamFolder.add(speech, 'lift', -0.4, 1, 0.01).name('lift');
streamFolder.add(speech, 'curl', 0, 0.6, 0.01).name('curl');

const decayFolder = gui.addFolder('Decay');
decayFolder.add(speech, 'lifetime', 0.5, 20, 0.1).name('lifetime (sec)');
decayFolder.add(speech, 'curve', 0.2, 4, 0.05).name('fade curve');
decayFolder.add(speech, 'restart', 0.2, 4, 0.05).name('restart after (sec)');

const typeFolder = gui.addFolder('Type');
typeFolder.add(speech, 'size', 8, 40, 1).name('size').onChange(applyTypeStyle);
typeFolder.add(speech, 'tilt', 0, 30, 1).name('tilt');
typeFolder.addColor(speech, 'ink').name('colour').onChange(applyTypeStyle);
typeFolder.addColor(speech, 'fade').name('fade to');

const walkFolder = gui.addFolder('Walk');
walkFolder.add(body, 'speed', 0.5, 12, 0.1).name('speed');
walkFolder.add(body, 'walkSwing', 0, 1.4, 0.05).name('swing');
walkFolder.close();

gui.add({
  hush() {
    for (const item of glyphs) {
      item.object.removeFromParent();
      item.element.remove();
    }
    glyphs.length = 0;
  },
}, 'hush').name('Clear the air');

// ---------------------------------------------------------------------------
// Input. Arrows walk, everything printable talks, so both work at once.
// ---------------------------------------------------------------------------
const KEY_AXES = {
  ArrowUp: { forward: 1, right: 0 },
  ArrowDown: { forward: -1, right: 0 },
  ArrowLeft: { forward: 0, right: -1 },
  ArrowRight: { forward: 0, right: 1 },
};

const pressed = new Set();

// How much the head is bouncing from talking. Each keystroke tops it up.
let chatter = 0;

window.addEventListener('keydown', (event) => {
  if (event.key in KEY_AXES) {
    event.preventDefault();
    pressed.add(event.key);
    return;
  }

  // Leave browser and OS shortcuts alone.
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  // Deliberately unhandled. You cannot unsay a word, and backspace would
  // otherwise navigate the page back.
  if (event.key === 'Backspace') {
    event.preventDefault();
    return;
  }

  // Any single-character key is something typeable: letters, digits,
  // punctuation, space. Named keys like Shift or F5 are longer than one
  // character, which is a neat way to tell them apart.
  if (event.key.length === 1) {
    event.preventDefault();

    // Space goes through the same path as every other character. It draws
    // nothing, but because each letter is now placed off the edge of the one
    // before it, an invisible glyph still holds a slot in the chain and the
    // gap appears immediately. The earlier version had to shove every letter
    // already in the air along instead, which made the sentence lurch.
    chatter = 1;
    speak(event.key);
  }
});

window.addEventListener('keyup', (event) => pressed.delete(event.key));
window.addEventListener('blur', () => pressed.clear());

// ---------------------------------------------------------------------------
// Movement.
// ---------------------------------------------------------------------------
const RESPONSIVENESS = 12;
const TURN_RATE = 10;
const LIMIT = (GRID * TILE) / 2 - 0.3;

const velocity = new THREE.Vector3();
const desired = new THREE.Vector3();

let phase = 0;

function update(delta, elapsed) {
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, WORLD_UP);

  desired.set(0, 0, 0);
  for (const key of pressed) {
    const axis = KEY_AXES[key];
    desired.addScaledVector(forward, axis.forward);
    desired.addScaledVector(right, axis.right);
  }
  if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(body.speed);

  velocity.lerp(desired, 1 - Math.exp(-RESPONSIVENESS * delta));

  root.position.addScaledVector(velocity, delta);
  root.position.x = THREE.MathUtils.clamp(root.position.x, -LIMIT, LIMIT);
  root.position.z = THREE.MathUtils.clamp(root.position.z, -LIMIT, LIMIT);

  const speed = velocity.length();

  if (speed > 0.05) {
    const targetYaw = Math.atan2(velocity.x, velocity.z);
    const shortest = Math.atan2(
      Math.sin(targetYaw - root.rotation.y),
      Math.cos(targetYaw - root.rotation.y),
    );
    root.rotation.y += shortest * (1 - Math.exp(-TURN_RATE * delta));
  }

  phase += speed * 3.2 * delta;
  const swing = Math.sin(phase) * body.walkSwing * (speed / body.speed);

  leftLeg.rotation.x = swing;
  rightLeg.rotation.x = -swing;
  leftArm.rotation.x = -swing * 0.8;
  rightArm.rotation.x = swing * 0.8;

  const bob = Math.abs(Math.sin(phase)) * 0.05 * (speed / body.speed);
  root.position.y = bob + Math.sin(elapsed * 1.6) * 0.008;

  // Talking wobble: each keystroke sets chatter to 1 and it decays from there,
  // so the head jiggles while you type and settles when you stop.
  chatter = Math.max(0, chatter - delta * 3.5);
  head.position.y = headY + Math.sin(elapsed * 34) * 0.022 * chatter;

  updateGlyphs(delta);
}

// ---------------------------------------------------------------------------
// Controls, resize, render loop.
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.8, 0);

window.addEventListener('resize', () => {
  const newAspect = window.innerWidth / window.innerHeight;
  camera.left = (-viewSize * newAspect) / 2;
  camera.right = (viewSize * newAspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  worldPerPixel = viewSize / window.innerHeight;
});

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  update(delta, clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
  // The label layer is a second render pass over the same scene and camera.
  labelRenderer.render(scene, camera);
});
