/*
 * OmniRay project page — live point-cloud viewers, embedded in index.html.
 *
 * three.js r164.1, pinned, loaded from jsDelivr via the import map in index.html.
 * Adapted from the CAM3R demo viewer (nam1410.github.io/cam3r/demo).
 *
 * Design notes
 * ------------
 * A WebGL context is a scarce resource (browsers keep roughly 8-16 alive per
 * page), so each section owns one viewer rig and swaps the point clouds when
 * a tab is selected: four contexts for the benchmark comparison, one for the
 * zero-shot example. A visitor downloads one example at a time.
 *
 * The benchmark panels are driven by a single master camera. Every panel has
 * its own OrbitControls bound to that camera and they share one target, so a
 * drag, zoom or pan in any panel moves all of them; the slave cameras copy the
 * master pose every frame while keeping their own aspect ratio.
 *
 * Every cloud is a monocular prediction in the camera frame of its input image
 * (+x right, +y down, +z forward). Depth is recovered only up to a global
 * scale, and the baselines write out at very different scales, so each cloud
 * is normalised at render time: recentred on its coordinate-wise median and
 * scaled so that the 90th-percentile distance from that centre is 1. A
 * percentile rather than the bounding sphere is used because outdoor scenes
 * carry a few very distant sky and horizon points that would otherwise shrink
 * everything else into a dot. The .ply files on disk keep their original
 * coordinates.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const DEFAULT_POINT_SIZE = 0.012;

/* Home pose: behind and slightly above the camera that took the picture,
   looking forward along +z (the scene's +y points down, so "above" is -y). */
const HOME_POSITION = [0, -0.7, -2.1];

/* The four panels of the benchmark comparison, in display order: the method
   key used to build the .ply path, and the label used while loading. */
export const BENCHMARK_METHODS = [
  ['da3', 'Depth Anything 3'],
  ['unik3d', 'UniK3D'],
  ['omniray', 'OmniRay'],
  ['gt', 'ground truth']
];

/* ------------------------------------------------------------ normalise */

function quickPercentile(values, q) {
  // values: Float32Array; sorted copy of at most 60k samples
  const n = values.length;
  const step = Math.max(1, Math.floor(n / 60000));
  const sample = new Float32Array(Math.ceil(n / step));
  for (let i = 0, j = 0; i < n; i += step) sample[j++] = values[i];
  sample.sort();
  const k = Math.min(sample.length - 1, Math.max(0, Math.round(q * (sample.length - 1))));
  return sample[k];
}

/** Median centre and 90th-percentile radius of a position attribute. */
function robustFrame(geometry) {
  const pos = geometry.getAttribute('position').array;
  const n = pos.length / 3;
  const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
    xs[m] = x; ys[m] = y; zs[m] = z; m++;
  }
  if (m === 0) return { center: new THREE.Vector3(), radius: 1 };
  const cx = quickPercentile(xs.subarray(0, m), 0.5);
  const cy = quickPercentile(ys.subarray(0, m), 0.5);
  const cz = quickPercentile(zs.subarray(0, m), 0.5);
  const d = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const dx = xs[i] - cx, dy = ys[i] - cy, dz = zs[i] - cz;
    d[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  let r = quickPercentile(d, 0.9);
  if (!isFinite(r) || r < 1e-6) r = 1;
  return { center: new THREE.Vector3(cx, cy, cz), radius: r };
}

/* ------------------------------------------------------------------ panel */

function makePanel(el, background) {
  const canvas = el.querySelector('canvas');
  const overlay = el.querySelector('.overlay');
  const overlayText = overlay.querySelector('.msg');

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.01, 500);
  camera.up.set(0, -1, 0);          // camera-frame clouds: +y is down
  camera.position.set(...HOME_POSITION);

  return {
    el, canvas, renderer, scene, camera, overlay, overlayText,
    points: null,
    status(kind, text) {
      if (kind === 'hidden') { overlay.hidden = true; return; }
      overlay.hidden = false;
      overlay.classList.toggle('error', kind === 'error');
      overlayText.textContent = text;
    },
    setCloud(geometry, size) {
      this.clear();
      const { center, radius } = robustFrame(geometry);
      const material = new THREE.PointsMaterial({
        size: size, vertexColors: true, sizeAttenuation: true
      });
      if (!geometry.hasAttribute('color')) {
        material.vertexColors = false;
        material.color = new THREE.Color(0xbfc9d4);
      }
      const pts = new THREE.Points(geometry, material);
      // normalise: centre on the median point, scale the p90 radius to 1
      pts.scale.setScalar(1 / radius);
      pts.position.copy(center).multiplyScalar(-1 / radius);
      this.points = pts;
      this.scene.add(pts);
    },
    clear() {
      if (!this.points) return;
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      this.points.material.dispose();
      this.points = null;
    },
    resize() {
      const w = Math.max(1, this.el.clientWidth);
      const h = Math.max(1, this.el.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      return { w, h };
    }
  };
}

/* ------------------------------------------------------------------- rig */

/**
 * A viewer rig owns one or more panels, a shared master camera and a render
 * loop that only runs while the rig is on screen.
 */
class Rig {
  /**
   * linked (default true): every panel shares one master camera, for comparing
   * methods on the same scene. Unlinked: each panel orbits its own camera, for
   * showing different scenes side by side (the teaser).
   */
  constructor(root, { linked = true, background = 0x0b0e13 } = {}) {
    this.root = root;
    this.linked = linked;
    this.panels = Array.from(root.querySelectorAll('.vpanel')).map((el) => makePanel(el, background));
    this.master = this.panels[0].camera;
    this.pointSize = DEFAULT_POINT_SIZE;
    this.loader = new PLYLoader();
    this.token = 0;
    this.visible = false;
    this.running = false;
    this.pending = null;

    this.controls = this.panels.map((p) => {
      const c = new OrbitControls(linked ? this.master : p.camera, p.canvas);
      c.enableDamping = false;      // several controls on one camera must not fight
      c.enablePan = true;
      c.screenSpacePanning = true;
      c.rotateSpeed = 0.9;
      c.zoomSpeed = 0.9;
      c.minDistance = 0.05;
      c.maxDistance = 60;
      return c;
    });
    // every control shares one target object, so panning stays in lockstep
    if (linked) {
      for (let i = 1; i < this.controls.length; i++) {
        this.controls[i].target = this.controls[0].target;
      }
    }

    this.home();

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(root);
    window.addEventListener('resize', () => this.resize());

    const io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      if (!this.visible) return;
      this.start();
      if (this.pending) {
        const q = this.pending;
        this.pending = null;
        this.show(q.urls, q.labels);
      }
    }, { rootMargin: '200px' });
    io.observe(root);

    this.resize();
    this.render();
  }

  home() {
    this.panels.forEach((p) => {
      // a square panel has less horizontal room than a 4:3 one, so back off a little
      const k = p.camera.aspect < 1.2 ? 1.3 : 1;
      p.camera.position.set(HOME_POSITION[0] * k, HOME_POSITION[1] * k, HOME_POSITION[2] * k);
      p.camera.up.set(0, -1, 0);
      p.camera.lookAt(0, 0, 0);
    });
    this.controls.forEach((c) => { c.target.set(0, 0, 0); c.update(); });
  }

  setPointSize(v) {
    this.pointSize = v;
    this.panels.forEach((p) => { if (p.points) p.points.material.size = v; });
  }

  /**
   * Ask for a set of clouds. Nothing is fetched until the rig scrolls into
   * view, so opening the page does not pull every example at once.
   */
  request(urls, labels) {
    if (this.visible) return this.show(urls, labels);
    this.token++;
    this.pending = { urls, labels };
    this.panels.forEach((p, i) => {
      p.clear();
      p.status('loading', 'Loading ' + labels[i] + '…');
    });
    return Promise.resolve([]);
  }

  /** Load a set of urls (one per panel) and reframe once they are in. */
  async show(urls, labels) {
    this.token++;
    const mine = this.token;
    const results = await Promise.all(
      urls.map((u, i) => new Promise((resolve) => {
        const panel = this.panels[i];
        panel.clear();
        panel.status('loading', 'Loading ' + labels[i] + '…');
        this.loader.load(
          u,
          (geometry) => {
            if (mine !== this.token) { geometry.dispose(); resolve(false); return; }
            try {
              panel.setCloud(geometry, this.pointSize);
              panel.status('hidden');
              resolve(true);
            } catch (err) {
              console.error('[omniray] build failed: ' + u, err);
              panel.status('error', 'Could not display this point cloud.');
              resolve(false);
            }
          },
          (xhr) => {
            if (mine !== this.token) return;
            if (xhr && xhr.lengthComputable && xhr.total) {
              const pct = Math.round((xhr.loaded / xhr.total) * 100);
              panel.status('loading', 'Loading ' + labels[i] + '… ' + pct + '%');
            }
          },
          (err) => {
            console.error('[omniray] load failed: ' + u, err);
            if (mine !== this.token) { resolve(false); return; }
            panel.status('error',
              'Could not load this point cloud (' + u.split('/').pop() +
              '). Try reloading the page.');
            resolve(false);
          }
        );
      }))
    );
    if (mine === this.token && results.some(Boolean)) this.home();
    return results;
  }

  resize() {
    this.panels.forEach((p, i) => {
      const { w, h } = p.resize();
      if (i === 0) {
        this.master.aspect = w / h;
        this.master.updateProjectionMatrix();
      }
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      if (!this.visible) return;
      this.controls.forEach((c) => c.update());
      this.render();
    };
    requestAnimationFrame(tick);
  }

  render() {
    this.panels.forEach((p, i) => {
      if (this.linked && i > 0) {
        // slave cameras track the master pose but keep their own aspect
        p.camera.position.copy(this.master.position);
        p.camera.quaternion.copy(this.master.quaternion);
        p.camera.up.copy(this.master.up);
        p.camera.zoom = this.master.zoom;
        p.camera.updateProjectionMatrix();
      }
      p.renderer.render(p.scene, p.camera);
    });
  }
}

/* ------------------------------------------------------- section wiring */

/** Start a rig on the .vstage inside root, or show an error in its panels. */
function startRig(root, opts) {
  try {
    return new Rig(root.querySelector('.vstage'), opts);
  } catch (err) {
    // one section failing (no context left, driver bug) must not take the
    // other one down with it
    console.error('[omniray] could not start the viewer in #' + root.id, err);
    root.querySelectorAll('.vpanel .overlay').forEach((o) => {
      o.hidden = false;
      o.classList.add('error');
      o.querySelector('.msg').textContent =
        'The live viewer could not start in this browser.';
    });
    return null;
  }
}

function wireToolbar(root, rig) {
  const sizeInput = root.querySelector('input[type="range"]');
  if (sizeInput) {
    sizeInput.value = String(DEFAULT_POINT_SIZE);
    sizeInput.addEventListener('input', () => rig.setPointSize(parseFloat(sizeInput.value)));
  }
  const resetBtn = root.querySelector('button[data-action="reset"]');
  if (resetBtn) resetBtn.addEventListener('click', () => rig.home());
}

function wireSection(rootId, examples, urlsFor, labelsFor, onSelect, base) {
  const root = document.getElementById(rootId);
  if (!root) return null;
  const rig = startRig(root, { linked: true });
  if (!rig) return null;
  wireToolbar(root, rig);

  buildTabs(root, examples, base);
  wireTabs(root, (i) => {
    onSelect(root, examples[i]);
    rig.request(urlsFor(examples[i]), labelsFor(examples[i]));
  });
  return rig;
}

/**
 * Fill the .vtabs strip with one thumbnail button per example, so the visitor
 * chooses an input image by clicking the picture itself.
 */
function buildTabs(root, examples, base) {
  const strip = root.querySelector('.vtabs');
  if (!strip) return;
  strip.innerHTML = '';
  examples.forEach((ex, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === 0));
    const img = document.createElement('img');
    img.src = base + ex.dir + '/thumb.jpg';
    img.alt = '';
    img.loading = 'lazy';
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = ex.tab || ex.name;
    if (ex.heldout) {
      const h = document.createElement('span');
      h.className = 'heldout';
      h.textContent = 'held out';
      lbl.appendChild(h);
    }
    b.appendChild(img);
    b.appendChild(lbl);
    strip.appendChild(b);
  });
}

/**
 * Wire a .vtabs strip inside root: click and left/right arrow selection, with
 * aria-selected kept in sync and the first tab chosen on load.
 */
function wireTabs(root, onIndex) {
  const tabs = Array.from(root.querySelectorAll('.vtabs button'));
  let current = -1;

  function select(i) {
    if (i === current) return;
    current = i;
    tabs.forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
    onIndex(i);
  }

  tabs.forEach((b, i) => {
    b.addEventListener('click', () => select(i));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = tabs.length;
      const j = (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
      tabs[j].focus();
      select(j);
    });
  });

  select(0);
}

function checkWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function setInput(root, ex, base) {
  root.querySelector('[data-slot="name"]').textContent = ex.name;
  root.querySelector('[data-slot="src"]').textContent = ex.source;
  const img = root.querySelector('[data-slot="input"]');
  img.src = base + ex.dir + '/input.jpg';
  img.alt = ex.name + ': the single input image';
  const note = root.querySelector('[data-slot="views"]');
  if (note) {
    note.textContent = ex.note || '';
    note.hidden = !ex.note;
  }
}

/* ------------------------------------------------------------------ data */

/**
 * The teaser: one column per camera family, each an input image over its own
 * OmniRay cloud. Different scenes, so the panels are not linked.
 */
function wireTeaser(rootId, examples, base) {
  const root = document.getElementById(rootId);
  if (!root || !examples) return null;
  // white panes, like the paper figure the teaser reproduces
  const rig = startRig(root, { linked: false, background: 0xffffff });
  if (!rig) return null;
  wireToolbar(root, rig);
  root.querySelectorAll('[data-slot="input"]').forEach((img, i) => {
    const ex = examples[i];
    if (!ex) return;
    img.src = base + ex.dir + '/input.jpg';
    img.alt = ex.tab + ' input image from ' + ex.source;
  });
  rig.request(
    examples.map((ex) => base + ex.dir + '/omniray.ply'),
    examples.map((ex) => ex.tab)
  );
  return rig;
}

export function boot(BENCHMARK, ZEROSHOT, opts = {}) {
  const base = opts.base || '';   // prefix for asset paths, e.g. 'demo/' from the landing page
  const guard = (fn) => { try { fn(); } catch (err) { console.error('[omniray]', err); } };

  if (!checkWebGL()) {
    document.querySelectorAll('.vpanel .overlay').forEach((o) => {
      o.hidden = false;
      o.classList.add('error');
      o.querySelector('.msg').textContent =
        'This browser does not have WebGL available, so the live viewers ' +
        'cannot run. The figures on the project page show the same reconstructions.';
    });
    return;
  }

  guard(() => wireTeaser('teaser-widget', opts.teaser, base));

  // Four panels, one per method, all driven by the rig's single master camera.
  guard(() => wireSection(
    'benchmark-widget', BENCHMARK,
    (ex) => BENCHMARK_METHODS.map(([key]) => base + ex.dir + '/' + key + '.ply'),
    () => BENCHMARK_METHODS.map(([, label]) => label),
    (root, ex) => setInput(root, ex, base),
    base
  ));

  guard(() => wireSection(
    'zeroshot-widget', ZEROSHOT,
    (ex) => [base + ex.dir + '/pred.ply'],
    () => ['OmniRay prediction'],
    (root, ex) => setInput(root, ex, base),
    base
  ));
}
