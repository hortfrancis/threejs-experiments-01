import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Scene, camera, floor — same isometric setup as experiment 01, on paper
// colours so a black ink figure reads against it.
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
// The figure.
//
// Built as a hierarchy, not a pile of meshes. Each limb hangs inside an empty
// Group placed at the joint, because a mesh rotates around its own centre —
// rotate the leg directly and it spins about its middle like a propeller. Put
// an empty at the hip, hang the leg below it, and rotating the empty swings
// the leg from the hip.
// ---------------------------------------------------------------------------
const INK = '#101014';
const SKIN = '#f7c89c';
const SHIRT = '#2f7fd0';

// Flat, unlit colour. MeshBasicMaterial ignores every light in the scene,
// which is what gives comic art its even fill instead of a 3D gradient.
const inkMaterial = new THREE.MeshBasicMaterial({ color: INK });

// The outline shell. Rendering only BACK faces means the front of the shell is
// culled away, so a slightly enlarged copy of a shape shows up only as a rim
// around its silhouette. This is the cheap standard trick for cartoon outlines
// and needs no post-processing.
const outlineMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

function inked(geometry, colour, thickness) {
  const group = new THREE.Group();

  const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colour }));
  fill.castShadow = true;
  group.add(fill);

  const shell = new THREE.Mesh(geometry, outlineMaterial);
  shell.scale.setScalar(thickness); // uniform scale, so the rim is slightly
  group.add(shell);                 // thicker on the wider parts of a shape

  return group;
}

const figure = new THREE.Group();
scene.add(figure);

// --- Limbs: strokes, drawn as tubes along a curve --------------------------
// On the question of strokes: THREE.Line exists but its linewidth is ignored
// on nearly every platform, so it is always one pixel. Real strokes come from
// either Line2 in the addons, which draws lines with a width in screen pixels,
// or from geometry like this — a tube swept along a curve, which unlike a flat
// line has volume, catches shadows and can be bent into a hand-drawn wobble.
function noodle(points, radius) {
  const curve = new THREE.CatmullRomCurve3(points);
  const group = new THREE.Group();

  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 8, false), inkMaterial);
  tube.castShadow = true;
  group.add(tube);

  // A tube's ends are left open, so you would see straight through them. A
  // small sphere at each end caps it and gives the rounded finish of a pen.
  for (const t of [0, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), inkMaterial);
    cap.position.copy(curve.getPoint(t));
    cap.castShadow = true;
    group.add(cap);
  }

  return group;
}

function joint(x, y) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  figure.add(pivot);
  return pivot;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Legs, bowing very slightly outwards.
const leftLeg = joint(-0.09, 0.6);
const rightLeg = joint(0.09, 0.6);
leftLeg.add(noodle([V(0, 0, 0), V(-0.04, -0.3, 0.01), V(-0.05, -0.58, 0)], 0.042));
rightLeg.add(noodle([V(0, 0, 0), V(0.04, -0.3, 0.01), V(0.05, -0.58, 0)], 0.042));

// Arms, hung from the top corners of the torso and splayed wider.
const leftArm = joint(-0.15, 1.1);
const rightArm = joint(0.15, 1.1);
leftArm.add(noodle([V(0, 0, 0), V(-0.09, -0.27, 0.02), V(-0.13, -0.52, 0)], 0.036));
rightArm.add(noodle([V(0, 0, 0), V(0.09, -0.27, 0.02), V(0.13, -0.52, 0)], 0.036));

// --- Torso: a peanut, made by revolving a profile --------------------------
// LatheGeometry spins a 2D outline around the Y axis. Sketching the silhouette
// as a handful of points and letting a spline smooth it is far easier than
// trying to reach a blobby shape by deforming a sphere.
const torsoProfile = new THREE.SplineCurve([
  new THREE.Vector2(0.001, -0.3),
  new THREE.Vector2(0.14, -0.285),
  new THREE.Vector2(0.2, -0.21),
  new THREE.Vector2(0.215, -0.1),
  new THREE.Vector2(0.185, 0.02),  // a slight waist
  new THREE.Vector2(0.205, 0.14),  // chest above it
  new THREE.Vector2(0.16, 0.26),
  new THREE.Vector2(0.001, 0.3),
]).getPoints(48);

// A spline can dip past its control points; a negative radius would turn the
// surface inside out.
for (const point of torsoProfile) point.x = Math.max(point.x, 0.001);

const torso = inked(new THREE.LatheGeometry(torsoProfile, 40), SHIRT, 1.06);
torso.position.y = 0.9;
figure.add(torso);

// --- Head ------------------------------------------------------------------
const HEAD_R = 0.34;

const head = new THREE.Group();
head.position.y = 1.5;
figure.add(head);
head.add(inked(new THREE.SphereGeometry(HEAD_R, 32, 24), SKIN, 1.08));

// Face. The outline shell does not hide these: its front faces are culled, so
// anything sitting in front of the fill still shows through.
const eyeGeometry = new THREE.SphereGeometry(0.045, 12, 8);
for (const side of [-1, 1]) {
  const eye = new THREE.Mesh(eyeGeometry, inkMaterial);
  eye.position.set(side * 0.115, 0.07, 0.3);
  head.add(eye);
}

const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), inkMaterial);
mouth.position.set(0, -0.08, 0.32);
mouth.scale.set(1.1, 0.5, 0.4);
head.add(mouth);

// ---------------------------------------------------------------------------
// Movement — continuous, camera-relative, as in experiment 01.
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

const SPEED = 2.6;
const RESPONSIVENESS = 12;
const TURN_RATE = 10;
const LIMIT = (GRID * TILE) / 2 - 0.3;

const velocity = new THREE.Vector3();
const desired = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// How far through the walk cycle we are. One full loop is two steps.
let phase = 0;

function updateFigure(delta, elapsed) {
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
  if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(SPEED);

  velocity.lerp(desired, 1 - Math.exp(-RESPONSIVENESS * delta));

  figure.position.addScaledVector(velocity, delta);
  figure.position.x = THREE.MathUtils.clamp(figure.position.x, -LIMIT, LIMIT);
  figure.position.z = THREE.MathUtils.clamp(figure.position.z, -LIMIT, LIMIT);

  const speed = velocity.length();

  // Turn to face the way we are going. Rotating towards the target the short
  // way round matters: without wrapping the difference into -PI..PI the figure
  // spins most of a circle to get somewhere just past the seam.
  if (speed > 0.05) {
    const targetYaw = Math.atan2(velocity.x, velocity.z);
    const shortest = Math.atan2(
      Math.sin(targetYaw - figure.rotation.y),
      Math.cos(targetYaw - figure.rotation.y),
    );
    figure.rotation.y += shortest * (1 - Math.exp(-TURN_RATE * delta));
  }

  // The walk cycle. Legs swing in opposite phase, arms mirror the opposite
  // leg, which is what real walking does and what makes it read as walking.
  // Amplitude scales with speed, so slowing to a halt settles the limbs back
  // to rest with no special case for stopping.
  phase += speed * 3.2 * delta;
  const swing = Math.sin(phase) * 0.5 * (speed / SPEED);

  leftLeg.rotation.x = swing;
  rightLeg.rotation.x = -swing;
  leftArm.rotation.x = -swing * 0.8;
  rightArm.rotation.x = swing * 0.8;

  // A bob on every step, plus a slow breath so standing still is not frozen.
  const bob = Math.abs(Math.sin(phase)) * 0.05 * (speed / SPEED);
  figure.position.y = bob + Math.sin(elapsed * 1.6) * 0.008;
}

// ---------------------------------------------------------------------------
// Controls, resize, render loop.
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.6, 0);

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
  updateFigure(delta, clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
});
