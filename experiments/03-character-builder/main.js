import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
// The parameters. Everything about the body comes from this one object, which
// is also exactly what the GUI edits — there is no second copy of the state to
// keep in sync.
// ---------------------------------------------------------------------------
const DEFAULTS = {
  headRadius: 0.34,
  headSquash: 1.05,
  skin: '#f7c89c',

  torsoHeight: 0.6,
  torsoWidth: 0.215,
  waist: 0.86,
  shirt: '#2f7fd0',

  legLength: 0.58,
  legThickness: 0.042,
  stance: 0.05,

  armLength: 0.52,
  armThickness: 0.036,
  armSplay: 0.13,

  outline: 1.07,
  ink: '#101014',

  walkSwing: 0.5,
  speed: 2.6,
};

const params = { ...DEFAULTS };

// ---------------------------------------------------------------------------
// Building the body.
//
// `root` holds position and facing and is never rebuilt, so changing a slider
// does not teleport the character back to the middle of the floor. Its single
// child, the assembled body, is thrown away and made again.
// ---------------------------------------------------------------------------
const root = new THREE.Group();
scene.add(root);

// Parts the walk cycle needs to reach. Repopulated on every rebuild.
let body = null;
let joints = null;

function buildBody() {
  // Materials are created per build so this body owns them outright and can
  // dispose them without affecting anything else.
  const inkMaterial = new THREE.MeshBasicMaterial({ color: params.ink });
  const skinMaterial = new THREE.MeshBasicMaterial({ color: params.skin });
  const shirtMaterial = new THREE.MeshBasicMaterial({ color: params.shirt });

  // Only BACK faces are drawn, so an enlarged copy of a shape shows up as a
  // rim around its silhouette and nothing else. Cartoon outlines, no
  // post-processing.
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: params.ink,
    side: THREE.BackSide,
  });

  const group = new THREE.Group();

  function inked(geometry, material) {
    const part = new THREE.Group();

    const fill = new THREE.Mesh(geometry, material);
    fill.castShadow = true;
    part.add(fill);

    const shell = new THREE.Mesh(geometry, outlineMaterial);
    shell.scale.setScalar(params.outline);
    part.add(shell);

    return part;
  }

  // A stroke with volume: a tube swept along a curve, with a sphere capping
  // each end because tubes are left open.
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
    group.add(pivot);
    return pivot;
  }

  // Everything stacks up from the leg length, so the figure stays assembled
  // whatever the sliders say.
  const hipY = params.legLength + 0.02;
  const torsoY = hipY + params.torsoHeight / 2 - 0.04;
  const torsoTop = torsoY + params.torsoHeight / 2;
  const shoulderY = torsoTop - 0.08;
  const headY = torsoTop + params.headRadius * params.headSquash - 0.06;

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const { legLength: leg, armLength: arm } = params;

  const leftLeg = joint(-params.torsoWidth * 0.45, hipY);
  const rightLeg = joint(params.torsoWidth * 0.45, hipY);
  leftLeg.add(noodle(
    [V(0, 0, 0), V(-params.stance * 0.6, -leg / 2, 0.01), V(-params.stance, -leg, 0)],
    params.legThickness,
  ));
  rightLeg.add(noodle(
    [V(0, 0, 0), V(params.stance * 0.6, -leg / 2, 0.01), V(params.stance, -leg, 0)],
    params.legThickness,
  ));

  const leftArm = joint(-params.torsoWidth * 0.72, shoulderY);
  const rightArm = joint(params.torsoWidth * 0.72, shoulderY);
  leftArm.add(noodle(
    [V(0, 0, 0), V(-params.armSplay * 0.7, -arm / 2, 0.02), V(-params.armSplay, -arm, 0)],
    params.armThickness,
  ));
  rightArm.add(noodle(
    [V(0, 0, 0), V(params.armSplay * 0.7, -arm / 2, 0.02), V(params.armSplay, -arm, 0)],
    params.armThickness,
  ));

  // The torso silhouette, revolved around the vertical axis. Sketching an
  // outline as a few points and smoothing it with a spline is a far easier way
  // to reach a blobby shape than deforming a sphere.
  const w = params.torsoWidth;
  const h = params.torsoHeight;
  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0.001, -h / 2),
    new THREE.Vector2(w * 0.65, -h * 0.475),
    new THREE.Vector2(w * 0.93, -h * 0.35),
    new THREE.Vector2(w, -h * 0.17),
    new THREE.Vector2(w * params.waist, h * 0.03),
    new THREE.Vector2(w * 0.95, h * 0.23),
    new THREE.Vector2(w * 0.74, h * 0.43),
    new THREE.Vector2(0.001, h / 2),
  ]).getPoints(48);

  // A spline can dip past its control points, and a negative radius would turn
  // the surface inside out.
  for (const point of profile) point.x = Math.max(point.x, 0.001);

  const torso = inked(new THREE.LatheGeometry(profile, 40), shirtMaterial);
  torso.position.y = torsoY;
  group.add(torso);

  const head = new THREE.Group();
  head.position.y = headY;
  group.add(head);

  const ball = inked(new THREE.SphereGeometry(params.headRadius, 32, 24), skinMaterial);
  ball.scale.y = params.headSquash;
  head.add(ball);

  // Face features scale with the head. They sit in front of the fill, and the
  // outline shell does not hide them because its front faces are culled.
  const r = params.headRadius;
  const eyeGeometry = new THREE.SphereGeometry(r * 0.13, 12, 8);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, inkMaterial);
    eye.position.set(side * r * 0.34, r * 0.2 * params.headSquash, r * 0.88);
    head.add(eye);
  }

  const mouth = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 12, 8), inkMaterial);
  mouth.position.set(0, -r * 0.24 * params.headSquash, r * 0.94);
  mouth.scale.set(1.1, 0.5, 0.4);
  head.add(mouth);

  return { group, joints: { leftLeg, rightLeg, leftArm, rightArm } };
}

// Geometries and materials live in GPU memory that JavaScript's garbage
// collector knows nothing about. Dropping the last reference to a mesh is not
// enough — without dispose() every slider drag would leak a whole body.
function discard(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

function rebuild() {
  if (body) {
    root.remove(body);
    discard(body);
  }

  const built = buildBody();
  body = built.group;
  joints = built.joints;
  root.add(body);
}

rebuild();

// ---------------------------------------------------------------------------
// The panel. lil-gui ships inside the three package, so it costs no extra
// dependency. It edits `params` in place and calls rebuild on any change.
// ---------------------------------------------------------------------------
const gui = new GUI({ title: 'Body' });

const headFolder = gui.addFolder('Head');
headFolder.add(params, 'headRadius', 0.15, 0.6, 0.01).name('size');
headFolder.add(params, 'headSquash', 0.7, 1.4, 0.01).name('squash');
headFolder.addColor(params, 'skin').name('skin');

const torsoFolder = gui.addFolder('Torso');
torsoFolder.add(params, 'torsoHeight', 0.25, 1.1, 0.01).name('height');
torsoFolder.add(params, 'torsoWidth', 0.08, 0.45, 0.005).name('width');
torsoFolder.add(params, 'waist', 0.5, 1.2, 0.01).name('waist');
torsoFolder.addColor(params, 'shirt').name('shirt');

const legFolder = gui.addFolder('Legs');
legFolder.add(params, 'legLength', 0.2, 1.2, 0.01).name('length');
legFolder.add(params, 'legThickness', 0.015, 0.12, 0.002).name('thickness');
legFolder.add(params, 'stance', -0.2, 0.3, 0.01).name('stance');

const armFolder = gui.addFolder('Arms');
armFolder.add(params, 'armLength', 0.2, 1, 0.01).name('length');
armFolder.add(params, 'armThickness', 0.015, 0.1, 0.002).name('thickness');
armFolder.add(params, 'armSplay', -0.1, 0.4, 0.01).name('splay');

const inkFolder = gui.addFolder('Ink');
inkFolder.add(params, 'outline', 1, 1.3, 0.005).name('outline');
inkFolder.addColor(params, 'ink').name('colour');

const moveFolder = gui.addFolder('Movement');
moveFolder.add(params, 'speed', 0.5, 8, 0.1).name('speed');
moveFolder.add(params, 'walkSwing', 0, 1.4, 0.05).name('swing');
moveFolder.close();

// One handler for every controller in the panel.
gui.onChange(rebuild);

gui.add({
  randomise() {
    const pick = (lo, hi) => lo + Math.random() * (hi - lo);
    params.headRadius = pick(0.2, 0.55);
    params.headSquash = pick(0.8, 1.3);
    params.torsoHeight = pick(0.3, 0.95);
    params.torsoWidth = pick(0.1, 0.38);
    params.waist = pick(0.55, 1.15);
    params.legLength = pick(0.25, 1);
    params.legThickness = pick(0.02, 0.09);
    params.stance = pick(-0.1, 0.22);
    params.armLength = pick(0.3, 0.85);
    params.armThickness = pick(0.02, 0.07);
    params.armSplay = pick(-0.05, 0.3);
    rebuild();
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  },
}, 'randomise').name('Randomise');

gui.add({
  reset() {
    Object.assign(params, DEFAULTS);
    rebuild();
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  },
}, 'reset').name('Reset');

// ---------------------------------------------------------------------------
// Movement — continuous, camera-relative.
// ---------------------------------------------------------------------------
const KEY_AXES = {
  ArrowUp: { forward: 1, right: 0 },
  ArrowDown: { forward: -1, right: 0 },
  ArrowLeft: { forward: 0, right: -1 },
  ArrowRight: { forward: 0, right: 1 },
};

const pressed = new Set();

window.addEventListener('keydown', (event) => {
  if (!(event.key in KEY_AXES)) return;
  event.preventDefault();
  pressed.add(event.key);
});

window.addEventListener('keyup', (event) => pressed.delete(event.key));
window.addEventListener('blur', () => pressed.clear());

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
  if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(params.speed);

  velocity.lerp(desired, 1 - Math.exp(-RESPONSIVENESS * delta));

  root.position.addScaledVector(velocity, delta);
  root.position.x = THREE.MathUtils.clamp(root.position.x, -LIMIT, LIMIT);
  root.position.z = THREE.MathUtils.clamp(root.position.z, -LIMIT, LIMIT);

  const speed = velocity.length();

  // Turn the short way round, or the figure spins most of a circle to reach a
  // heading just the other side of the seam.
  if (speed > 0.05) {
    const targetYaw = Math.atan2(velocity.x, velocity.z);
    const shortest = Math.atan2(
      Math.sin(targetYaw - root.rotation.y),
      Math.cos(targetYaw - root.rotation.y),
    );
    root.rotation.y += shortest * (1 - Math.exp(-TURN_RATE * delta));
  }

  // Legs swing in opposite phase, arms mirror the opposite leg. Amplitude
  // scales with speed, so slowing to a halt settles the limbs back to rest.
  phase += speed * 3.2 * delta;
  const swing = Math.sin(phase) * params.walkSwing * (speed / params.speed);

  joints.leftLeg.rotation.x = swing;
  joints.rightLeg.rotation.x = -swing;
  joints.leftArm.rotation.x = -swing * 0.8;
  joints.rightArm.rotation.x = swing * 0.8;

  const bob = Math.abs(Math.sin(phase)) * 0.05 * (speed / params.speed);
  root.position.y = bob + Math.sin(elapsed * 1.6) * 0.008;
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
});

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  update(delta, clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
});
