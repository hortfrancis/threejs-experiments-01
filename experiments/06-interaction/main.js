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
// The interaction system.
//
// Rather than hard-coding a check per object, anything interactive registers
// itself with a reach, a label and what to do. Each frame the nearest thing
// within reach becomes the focus, its prompt appears, and Enter runs it. New
// objects need no changes here at all.
// ---------------------------------------------------------------------------
const interactables = [];
let focused = null;

function interactable({ group, reach = 1.3, promptHeight, label, onInteract }) {
  const element = document.createElement('div');
  element.className = 'prompt';

  const key = document.createElement('span');
  key.className = 'key';
  key.textContent = '\u23CE'; // the return symbol, as it appears on a key cap

  const what = document.createElement('span');
  element.append(key, what);
  element.style.display = 'none';

  const prompt = new CSS2DObject(element);
  prompt.position.y = promptHeight;
  group.add(prompt);

  const item = { group, reach, label, onInteract, element, what, focus: 0 };
  interactables.push(item);
  return item;
}

const here = new THREE.Vector3();

function updateFocus(delta) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const item of interactables) {
    // World position, not local: the crate changes parent when carried.
    item.group.getWorldPosition(here);

    // Distance on the floor only. Height should not decide what is in reach.
    const distance = Math.hypot(here.x - root.position.x, here.z - root.position.z);

    if (distance < item.reach && distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  focused = nearest;

  for (const item of interactables) {
    const target = item === focused ? 1 : 0;
    item.focus += (target - item.focus) * (1 - Math.exp(-16 * delta));

    // A small swell, so the thing you are about to use is obvious without
    // needing an outline shader.
    item.group.scale.setScalar(1 + item.focus * 0.07);

    const visible = item.focus > 0.02;
    item.element.style.display = visible ? '' : 'none';

    if (visible) {
      item.element.style.opacity = String(item.focus);
      // Labels change with state, so they are read rather than stored.
      item.what.textContent = item.label();
    }
  }
}

// ---------------------------------------------------------------------------
// Collision.
//
// Each solid thing gets a box on the floor plane, sized in its own local
// space. Working in local space is what makes rotation free: the sign is
// turned at an angle, and nothing here has to know that.
//
// The box is then grown by the width of the character, which turns him from a
// circle into a single point. That is the whole trick — testing a point
// against a slightly larger box is far simpler than testing two shapes, and it
// gives identical results everywhere except exactly at the corners.
// ---------------------------------------------------------------------------
const BODY_RADIUS = 0.28;

const colliders = [];

function collider({ object, halfWidth, halfDepth, active = () => true }) {
  colliders.push({ object, halfWidth, halfDepth, active });
}

const colliderPosition = new THREE.Vector3();
const local = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const inverseRotation = new THREE.Quaternion();

function resolveCollisions() {
  for (const box of colliders) {
    if (!box.active()) continue;

    // Position and rotation only. Reading the object's full world matrix would
    // drag in the swell applied to whatever is in focus, and the solid part of
    // a thing should not grow when you look at it.
    box.object.getWorldPosition(colliderPosition);
    box.object.getWorldQuaternion(rotation);
    inverseRotation.copy(rotation).invert();

    local.copy(root.position).sub(colliderPosition);
    local.y = 0;
    local.applyQuaternion(inverseRotation);

    const halfWidth = box.halfWidth + BODY_RADIUS;
    const halfDepth = box.halfDepth + BODY_RADIUS;

    if (Math.abs(local.x) >= halfWidth || Math.abs(local.z) >= halfDepth) continue;

    // Inside. Push out along whichever axis needs to move the least, which is
    // what lets him slide along a face instead of sticking to it.
    const outX = halfWidth - Math.abs(local.x);
    const outZ = halfDepth - Math.abs(local.z);

    if (outX < outZ) local.x = (local.x < 0 ? -1 : 1) * halfWidth;
    else local.z = (local.z < 0 ? -1 : 1) * halfDepth;

    local.applyQuaternion(rotation).add(colliderPosition);
    root.position.x = local.x;
    root.position.z = local.z;
  }
}

// ---------------------------------------------------------------------------
// Panels.
//
// Text belongs to the thing that has something to say, not to the character
// reading it. An object can own a panel, show it for itself, and close it
// again. The same key that opened it closes it; walking off closes it too,
// fading by distance rather than on a timer, so backing away dims it
// gradually and stepping in again brings it straight back.
// ---------------------------------------------------------------------------
const panels = [];

function panel({ group, height, reach, html }) {
  const element = document.createElement('div');
  element.className = 'panel';
  element.innerHTML = html;
  element.style.display = 'none';

  const object = new CSS2DObject(element);
  object.position.y = height;
  object.center.set(0.5, 1); // hang it by its bottom edge, above the object
  group.add(object);

  const item = { group, element, object, reach, open: false, shown: 0 };
  panels.push(item);
  return item;
}

const panelPosition = new THREE.Vector3();

function updatePanels(delta) {
  for (const item of panels) {
    item.group.getWorldPosition(panelPosition);

    const distance = Math.hypot(
      panelPosition.x - root.position.x,
      panelPosition.z - root.position.z,
    );

    // Full strength anywhere within reach, falling off to nothing a little
    // beyond it.
    const nearness = THREE.MathUtils.clamp(
      (item.reach * 2.2 - distance) / (item.reach * 1.2),
      0,
      1,
    );

    if (nearness <= 0) item.open = false;

    const target = item.open ? nearness : 0;
    item.shown += (target - item.shown) * (1 - Math.exp(-12 * delta));

    const visible = item.shown > 0.01;
    item.element.style.display = visible ? '' : 'none';
    if (visible) item.element.style.opacity = String(item.shown);
  }
}

// ---------------------------------------------------------------------------
// A lamp. Toggling it adds real light to the scene, which the floor picks up
// because the floor uses a material that responds to lighting. The figure does
// not, being flat unlit ink.
// ---------------------------------------------------------------------------
const lamp = new THREE.Group();
lamp.position.set(-2.6, 0, -1.4);
scene.add(lamp);

const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.6, 10), inkMaterial);
post.position.y = 0.8;
post.castShadow = true;
lamp.add(post);

const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.07, 14), inkMaterial);
foot.position.y = 0.035;
foot.castShadow = true;
lamp.add(foot);

const bulbMaterial = new THREE.MeshBasicMaterial({ color: '#6d6a60' });
const bulb = inked(new THREE.SphereGeometry(0.17, 20, 14), bulbMaterial);
bulb.position.y = 1.68;
lamp.add(bulb);

// Range matters more than brightness here: a point light falls off to nothing
// at its distance, which is what gives the pool of light an edge.
const lampLight = new THREE.PointLight('#ffc76b', 0, 5, 1.6);
lampLight.position.y = 1.68;
lamp.add(lampLight);

let lampOn = false;

collider({ object: lamp, halfWidth: 0.2, halfDepth: 0.2 });

interactable({
  group: lamp,
  reach: 1.2,
  promptHeight: 2.1,
  label: () => (lampOn ? 'Turn the lamp off' : 'Turn the lamp on'),
  onInteract() {
    lampOn = !lampOn;
    lampLight.intensity = lampOn ? 4.5 : 0;
    bulbMaterial.color.set(lampOn ? '#ffd98a' : '#6d6a60');
  },
});

// ---------------------------------------------------------------------------
// A crate, which can be carried. This is the reparenting idea again: picking
// it up makes it a child of the figure so it inherits his movement for free,
// and putting it down hands it back to the scene.
// ---------------------------------------------------------------------------
const CRATE_HALF = 0.22;

const crate = inked(new THREE.BoxGeometry(CRATE_HALF * 2, CRATE_HALF * 2, CRATE_HALF * 2),
  new THREE.MeshBasicMaterial({ color: '#e8734a' }));
crate.position.set(2.3, CRATE_HALF, 1.5);
crate.rotation.y = 0.3;
scene.add(crate);

let carrying = false;

// Off while it is in his hands, or it would be pushing him away from himself.
collider({ object: crate, halfWidth: CRATE_HALF, halfDepth: CRATE_HALF, active: () => !carrying });

interactable({
  group: crate,
  reach: 1,
  promptHeight: 0.75,
  label: () => (carrying ? 'Put the crate down' : 'Pick the crate up'),
  onInteract() {
    carrying = !carrying;

    if (carrying) {
      // add(), not attach(): the crate is meant to snap into his hands, so
      // there is no world transform worth preserving.
      root.add(crate);
      crate.position.set(0, headY + body.headRadius * body.headSquash + 0.12, 0);
      crate.rotation.set(0, 0.3, 0);
    } else {
      // attach() the other way, which keeps the crate exactly where it is in
      // the world, so it lands wherever he happens to be standing.
      scene.attach(crate);
      crate.position.y = CRATE_HALF;
      crate.rotation.x = 0;
      crate.rotation.z = 0;
    }
  },
});

// ---------------------------------------------------------------------------
// A sign, which he reads aloud.
// ---------------------------------------------------------------------------
const sign = new THREE.Group();
sign.position.set(1.1, 0, -2.9);
sign.rotation.y = -0.35;
scene.add(sign);

const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), inkMaterial);
signPost.position.y = 0.55;
signPost.castShadow = true;
sign.add(signPost);

const board = inked(new THREE.BoxGeometry(0.8, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: '#fff8e8' }));
board.position.y = 1.05;
sign.add(board);

// Three short bars to suggest writing, without needing any text in the scene.
for (let i = 0; i < 3; i++) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.5 - i * 0.12, 0.045, 0.02), inkMaterial);
  line.position.set(-0.08 + i * 0.03, 1.17 - i * 0.13, 0.05);
  sign.add(line);
}

const SIGN_REACH = 1.2;

const signPanel = panel({
  group: sign,
  height: 2.55,
  reach: SIGN_REACH,
  html: `
    <h2>Notice</h2>
    <p>The floor is exactly ten tiles across. It has always been ten tiles across.</p>
    <p>Beware of the lamp.</p>
    <p class="faded">The rest has faded. Someone has drawn a duck on it.</p>
  `,
});

// The board's footprint rather than the post's, so he cannot walk through the
// face of it. It is turned 20 degrees, and the local-space test handles that
// without a single line about angles.
collider({ object: sign, halfWidth: 0.4, halfDepth: 0.06 });

interactable({
  group: sign,
  reach: SIGN_REACH,
  promptHeight: 1.6,
  label: () => (signPanel.open ? 'Close the sign' : 'Read the sign'),
  onInteract() {
    signPanel.open = !signPanel.open;
  },
});

// ---------------------------------------------------------------------------
// Input. Arrows walk, Enter uses whatever is in reach.
// ---------------------------------------------------------------------------
const KEY_AXES = {
  ArrowUp: { forward: 1, right: 0 },
  ArrowDown: { forward: -1, right: 0 },
  ArrowLeft: { forward: 0, right: -1 },
  ArrowRight: { forward: 0, right: 1 },
};

const pressed = new Set();

window.addEventListener('keydown', (event) => {
  if (event.key in KEY_AXES) {
    event.preventDefault();
    pressed.add(event.key);
    return;
  }

  if (event.key === 'Enter' && !event.repeat) {
    event.preventDefault();
    if (focused) focused.onInteract();
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

  // Move first, then push back out of anything he ended up inside. Correcting
  // the position rather than the velocity is what makes sliding along a wall
  // fall out on its own.
  resolveCollisions();

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

  // Arms stay down when his hands are full.
  const armSwing = carrying ? 0 : swing;
  leftArm.rotation.x = -armSwing * 0.8;
  rightArm.rotation.x = armSwing * 0.8;

  const bob = Math.abs(Math.sin(phase)) * 0.05 * (speed / body.speed);
  root.position.y = bob + Math.sin(elapsed * 1.6) * 0.008;

  updateFocus(delta);
  updatePanels(delta);
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
  labelRenderer.render(scene, camera);
});
