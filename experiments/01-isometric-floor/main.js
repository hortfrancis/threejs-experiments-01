import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// 1. Renderer — owns the <canvas> and draws a scene from a camera's viewpoint.
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// 2. Scene — the container everything visible gets added to.
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#12141c');

// ---------------------------------------------------------------------------
// 3. Camera — orthographic, so there is no perspective foreshortening.
//    That flatness is what reads as "isometric"; the angle comes from where
//    the camera sits. Equal x/y/z distances give the classic 2:1-ish view.
// ---------------------------------------------------------------------------
// How many world units tall the view is. Smaller number = more zoomed in.
const viewSize = 14;
const aspect = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  (-viewSize * aspect) / 2, // left
  (viewSize * aspect) / 2,  // right
  viewSize / 2,             // top
  -viewSize / 2,            // bottom
  0.1,                      // near clipping plane
  200,                      // far clipping plane
);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

// ---------------------------------------------------------------------------
// 4. Lights — MeshStandardMaterial is unlit black without them.
// ---------------------------------------------------------------------------
// Ambient light fills every surface equally. Too much of it and shadows wash
// out, which is what makes objects look pasted onto the scene.
scene.add(new THREE.AmbientLight('#8891b5', 0.9));

const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
// Deliberately off to one side of the camera. A light shining from roughly
// where you are standing hides the shadow behind the object it belongs to.
sun.position.set(-7, 12, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// Nudges the shadow test along each surface's normal, which avoids the stripy
// self-shadowing you otherwise get on large flat surfaces.
sun.shadow.normalBias = 0.02;
// A directional light's shadow uses its own orthographic camera; widen it so
// the whole floor falls inside, otherwise shadows get clipped.
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
scene.add(sun);

// ---------------------------------------------------------------------------
// 5. The floor — a checkerboard of flat tiles on the XZ plane.
//    In Three.js, Y is up by convention, so the "ground" spans X and Z.
// ---------------------------------------------------------------------------
const GRID = 10;      // tiles per side
const TILE = 1;       // world units per tile

// Tile 0 sits at one edge, tile GRID-1 at the other, with the grid centred on
// the origin. Everything that needs to sit on a tile goes through this.
function tileCentre(i) {
  return (i - (GRID - 1) / 2) * TILE;
}

// The inverse: which tile is a given world coordinate standing on. Needed when
// free movement hands control back to grid movement.
function tileAt(world) {
  const i = Math.round(world / TILE + (GRID - 1) / 2);
  return THREE.MathUtils.clamp(i, 0, GRID - 1);
}

const floor = new THREE.Group();

// Geometry and materials are reused across every tile. Creating one per tile
// would work, but sharing them is much cheaper.
const tileGeometry = new THREE.PlaneGeometry(TILE, TILE);
const lightTile = new THREE.MeshStandardMaterial({ color: '#cbd2e8', roughness: 0.9 });
const darkTile = new THREE.MeshStandardMaterial({ color: '#98a1c0', roughness: 0.9 });

for (let x = 0; x < GRID; x++) {
  for (let z = 0; z < GRID; z++) {
    const isLight = (x + z) % 2 === 0;
    const tile = new THREE.Mesh(tileGeometry, isLight ? lightTile : darkTile);

    // A plane is born standing up in the XY plane; tip it flat.
    tile.rotation.x = -Math.PI / 2;

    tile.position.set(tileCentre(x), 0, tileCentre(z));

    tile.receiveShadow = true;
    floor.add(tile);
  }
}

scene.add(floor);

// ---------------------------------------------------------------------------
// 6. The box — the thing you drive around with the arrow keys.
// ---------------------------------------------------------------------------
const box = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: '#e8734a', roughness: 0.6 }),
);
box.castShadow = true;
box.position.set(1.5, 0.5, -0.5); // y = 0.5 puts its base on the floor
scene.add(box);

// ---------------------------------------------------------------------------
// 7. Input — both movement styles share one set of held keys.
// ---------------------------------------------------------------------------
// A keydown fires once, then repeats on the OS's own delay, which is useless
// for smooth movement. So track which keys are down and read the set each
// frame. It also lets two keys combine into a diagonal.
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const pressed = new Set();

window.addEventListener('keydown', (event) => {
  if (!ARROWS.includes(event.key)) return;
  event.preventDefault(); // arrow keys would otherwise scroll the page
  pressed.add(event.key);
});

window.addEventListener('keyup', (event) => pressed.delete(event.key));

// Losing focus (alt-tab, clicking away) can swallow the keyup, leaving a key
// stuck down. Clearing on blur avoids a box that wanders off on its own.
window.addEventListener('blur', () => pressed.clear());

// ---------------------------------------------------------------------------
// 7a. Free movement — continuous, in the directions the camera sees.
// ---------------------------------------------------------------------------
// Each arrow is expressed in camera space rather than world space: "forward"
// means up the screen, whatever angle the camera happens to be at.
const KEY_AXES = {
  ArrowUp: { forward: 1, right: 0 },
  ArrowDown: { forward: -1, right: 0 },
  ArrowLeft: { forward: 0, right: -1 },
  ArrowRight: { forward: 0, right: 1 },
};

const SPEED = 5;           // world units, i.e. tiles, per second
const RESPONSIVENESS = 14; // higher reaches full speed sooner

// The box's centre stays half its width inside the floor's edge.
const LIMIT = (GRID * TILE) / 2 - 0.5;

// All reused every frame. Allocating vectors inside a render loop makes
// garbage 60 times a second.
const velocity = new THREE.Vector3();
const desired = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function updateFree(delta) {
  // Flatten the camera's view direction onto the ground plane. That is what
  // "up the screen" means in world coordinates. Recomputing it every frame is
  // what keeps the controls correct after you orbit the view.
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  // Screen-right is perpendicular to both the view direction and world up.
  right.crossVectors(forward, WORLD_UP);

  // Add up every held key. Opposite keys cancel out, which is what you want.
  desired.set(0, 0, 0);
  for (const key of pressed) {
    const axis = KEY_AXES[key];
    desired.addScaledVector(forward, axis.forward);
    desired.addScaledVector(right, axis.right);
  }

  // Normalising before scaling stops diagonals being faster than straight
  // lines, which is the classic bug in eight-way movement.
  if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(SPEED);

  // Ease towards the target velocity instead of snapping to it, so starts and
  // stops have a little weight. The exponential keeps the feel identical at
  // any frame rate; a plain lerp factor would not.
  velocity.lerp(desired, 1 - Math.exp(-RESPONSIVENESS * delta));

  box.position.addScaledVector(velocity, delta);

  // Keep it on the floor.
  box.position.x = THREE.MathUtils.clamp(box.position.x, -LIMIT, LIMIT);
  box.position.z = THREE.MathUtils.clamp(box.position.z, -LIMIT, LIMIT);
}

// ---------------------------------------------------------------------------
// 7b. Grid movement — one tile per press, along the world axes.
// ---------------------------------------------------------------------------
// These are world directions, not camera ones, so on screen they read rotated
// 45 degrees. Making them camera-relative would turn each step into a grid
// diagonal, and diagonals preserve the parity of x + z, so the box could only
// ever reach half the tiles.
const STEPS = {
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

const SLIDE_SPEED = 6; // tiles per second

// Which tile the box is heading for. In this mode that, not box.position, is
// the real state; the mesh just catches up to it.
const boxTile = { x: 0, z: 0 };
const boxTarget = new THREE.Vector3();
const toTarget = new THREE.Vector3();

function updateGrid(delta) {
  toTarget.subVectors(boxTarget, box.position);
  const remaining = toTarget.length();

  if (remaining > 0.0001) {
    // Move at a fixed speed, but never overshoot the tile we are aiming at.
    const stride = SLIDE_SPEED * TILE * delta;
    if (stride >= remaining) box.position.copy(boxTarget);
    else box.position.addScaledVector(toTarget.divideScalar(remaining), stride);
    return;
  }

  // Standing still on a tile: take the newest held key and start a new step.
  const key = [...pressed].pop();
  if (!key) return;

  const step = STEPS[key];
  boxTile.x = THREE.MathUtils.clamp(boxTile.x + step.x, 0, GRID - 1);
  boxTile.z = THREE.MathUtils.clamp(boxTile.z + step.z, 0, GRID - 1);
  boxTarget.set(tileCentre(boxTile.x), 0.5, tileCentre(boxTile.z));
}

// ---------------------------------------------------------------------------
// 7c. The toggle. The button is plain HTML sitting over the canvas — Three.js
//     has nothing to do with interface elements.
// ---------------------------------------------------------------------------
const modeButton = document.getElementById('mode');
let gridMode = false;

function setMode(useGrid) {
  gridMode = useGrid;

  if (gridMode) {
    // Handing over from free movement: adopt whichever tile the box is nearest
    // and slide to its centre, so the two systems agree where it is.
    boxTile.x = tileAt(box.position.x);
    boxTile.z = tileAt(box.position.z);
    boxTarget.set(tileCentre(boxTile.x), 0.5, tileCentre(boxTile.z));
  } else {
    // Start from a standstill rather than inheriting the slide's momentum.
    velocity.set(0, 0, 0);
  }

  modeButton.textContent = gridMode ? 'Movement: grid' : 'Movement: free';
}

modeButton.addEventListener('click', () => {
  setMode(!gridMode);
  // Drop focus, or Space and Enter would keep re-triggering the button.
  modeButton.blur();
});

function updateBox(delta) {
  if (gridMode) updateGrid(delta);
  else updateFree(delta);
}

setMode(false);

// ---------------------------------------------------------------------------
// 8. Controls — drag to orbit. Delete this block to lock the isometric view.
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ---------------------------------------------------------------------------
// 9. Keep the canvas matched to the window.
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  const newAspect = window.innerWidth / window.innerHeight;
  camera.left = (-viewSize * newAspect) / 2;
  camera.right = (viewSize * newAspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix(); // required after changing camera settings
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// 10. Render loop — one draw per display refresh.
// ---------------------------------------------------------------------------
// Frames are not evenly spaced, so movement is scaled by how long the last one
// actually took. Without this the box travels faster on a 144Hz screen.
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  // Cap the step so a backgrounded tab does not resume with one huge jump.
  const delta = Math.min(clock.getDelta(), 0.1);

  updateBox(delta);
  controls.update();
  renderer.render(scene, camera);
});
