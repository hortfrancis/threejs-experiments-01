import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

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
// Speech.
//
// One bubble is "live": it is parented to the figure, so it follows him about
// while you type. Pressing Enter, or just stopping for a moment, releases it —
// at which point it is handed to the scene at its current world position and
// left behind to drift up and fade. Walking while talking leaves a trail.
// ---------------------------------------------------------------------------
const BUBBLE_Y = headY + body.headRadius * body.headSquash + 0.55;
const IDLE_RELEASE = 2.2;  // seconds of silence before a bubble lets go
const LIFETIME = 3.2;      // seconds a released bubble takes to fade out
const RISE = 0.55;         // world units per second it drifts upward

function makeBubble() {
  const element = document.createElement('div');
  element.className = 'bubble';

  const text = document.createElement('span');
  const caret = document.createElement('span');
  caret.className = 'caret';
  element.append(text, caret);

  // A CSS2DObject is an Object3D like any other: it has a position, it can be
  // parented, and the renderer keeps its element pinned to wherever it lands.
  const object = new CSS2DObject(element);
  object.position.y = BUBBLE_Y;
  object.center.set(0.08, 1); // anchor near the bottom-left, at the tail

  return { element, text, caret, object };
}

let live = makeBubble();
let liveText = '';
let silence = 0;
const released = [];

root.add(live.object);
live.element.style.display = 'none';

function refreshLive() {
  live.text.textContent = liveText;
  live.element.style.display = liveText ? '' : 'none';
}

function releaseBubble() {
  if (!liveText) return;

  live.caret.remove();

  // attach() reparents while preserving the world transform, so the bubble
  // stays exactly where it appeared instead of jumping to the scene origin.
  scene.attach(live.object);
  released.push({ ...live, age: 0 });

  live = makeBubble();
  liveText = '';
  root.add(live.object);
  live.element.style.display = 'none';
}

function updateBubbles(delta) {
  if (liveText) {
    silence += delta;
    if (silence >= IDLE_RELEASE) releaseBubble();
  }

  for (let i = released.length - 1; i >= 0; i--) {
    const bubble = released[i];
    bubble.age += delta;
    bubble.object.position.y += RISE * delta;

    const t = bubble.age / LIFETIME;

    if (t >= 1) {
      bubble.object.removeFromParent();
      bubble.element.remove();
      released.splice(i, 1);
      continue;
    }

    // Hold full opacity for a moment, then fade away on a curve.
    bubble.element.style.opacity = String(Math.min(1, (1 - t) * 1.6));
  }
}

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

  if (event.key === 'Enter') {
    event.preventDefault();
    releaseBubble();
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    liveText = liveText.slice(0, -1);
    silence = 0;
    refreshLive();
    return;
  }

  // Any single-character key is something typeable: letters, digits,
  // punctuation, space. Named keys like Shift or F5 are longer than one
  // character, which is a neat way to tell them apart.
  if (event.key.length === 1) {
    event.preventDefault();
    liveText += event.key;
    silence = 0;
    chatter = 1;
    refreshLive();
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
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

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

  updateBubbles(delta);
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
