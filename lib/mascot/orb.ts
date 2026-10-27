// The Campeos orb: a glassy 3D mascot with a face on its visor. Ported from
// the "Campeos Orb" design page. Everything here is plain TypeScript with no
// React, so it can be unit-tested for its small pure pieces and reused
// anywhere. components/mascot/Mascot.tsx is the React wrapper.
//
// Three.js is passed in (not imported at the top) so the library is only
// downloaded when a mascot is actually shown. See Mascot.tsx.

import type * as ThreeNS from "three";

export type Three = typeof ThreeNS;

export type OrbMood = "idle" | "happy" | "love" | "wink" | "thinking" | "surprised" | "sleepy";

export const ORB_MOODS: OrbMood[] = ["idle", "happy", "love", "wink", "thinking", "surprised", "sleepy"];

export interface OrbOptions {
  /** Drag to spin it, tap to hop. Off for decorative orbs and buttons. */
  interactive?: boolean;
  /** Eyes follow the cursor. */
  follow?: boolean;
  /** Blinks and looks around by itself. */
  alive?: boolean;
  /** Also hops and makes a face now and then (only when idle). */
  restless?: boolean;
  /** The soft purple glow behind it. Turn off for small orbs: the glow is
   * drawn inside the canvas and gets cut off at its edge. */
  glow?: boolean;
  /** The ring that orbits it. */
  ring?: boolean;
  /** The little thought bubble in the "thinking" mood. Turn off where it
   * can't fit, or where something else (like typing dots) says the same. */
  bubble?: boolean;
  /** How much room the orb has in its canvas. 1 = the original framing.
   * Below 1 = bigger orb, tighter fit. Never goes below MIN_FIT, because
   * any tighter and the bottom of the orb is cut off. For the thinking
   * bubble to show at full size, use 1 or more. */
  fit?: number;
  /** Put the orb in the middle of the canvas. By default it sits a little
   * low, which leaves extra room above for hops and the thinking bubble.
   * Use this when the canvas has to line up with other things, like a
   * header, and nothing can poke out of it. */
  centered?: boolean;
  /** Reduce motion (set from the user's system setting). */
  reducedMotion?: boolean;
}

export interface Orb {
  setMood(mood: OrbMood): void;
  /** A one-off happy face (then back to the real mood). */
  glimpse(mood: OrbMood, seconds?: number): void;
  hop(): void;
  spin(): void;
  nod(): void;
  shake(): void;
  setAlive(on: boolean): void;
  /** Shows or hides the ring that orbits the orb. */
  setRing(on: boolean): void;
  /** Stops drawing (offscreen, hidden). */
  setPaused(paused: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const TAU = Math.PI * 2;

/** How the orb's colors change with its mood. */
export const MOOD_STYLE: Record<OrbMood, { tint: [number, number, number]; halo: number; dim: number }> = {
  idle: { tint: [0, 0, 0], halo: 0x7b3dff, dim: 1 },
  happy: { tint: [0.03, 0, 0.07], halo: 0x9a4dff, dim: 1 },
  love: { tint: [0.2, 0, 0.1], halo: 0xff3fb8, dim: 1 },
  wink: { tint: [0.04, 0, 0.1], halo: 0xb04dff, dim: 1 },
  thinking: { tint: [0, 0.02, 0.07], halo: 0x6a4dff, dim: 1 },
  surprised: { tint: [0.06, 0.04, 0.1], halo: 0x9a6dff, dim: 1.05 },
  sleepy: { tint: [0, 0, 0], halo: 0x5a3dd0, dim: 0.72 },
};

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
function ease(k: number): number {
  return k * k * (3 - 2 * k);
}
function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** The smallest `fit` that still shows the whole orb. Any tighter and the
 * bottom of the orb (and its glow) is cut off by the edge of the canvas. */
export const MIN_FIT = 0.8;

export function clampFit(fit: number): number {
  return Math.max(MIN_FIT, fit);
}

export interface BubbleBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where the "thinking" bubble goes, in the orb's own units. It normally sits
 * up and to the right of the orb. When the canvas is small and that would
 * poke out past the edge, it shrinks and slides in so it's never cut off.
 *  - halfW / halfH: how much the camera can see either side of centre
 *  - lookY: the height the camera is aimed at
 *  - rootY: the orb's current height (it moves when it hops)
 *  - pop: 0..1, how far the bubble has popped open
 */
export function bubbleLayout(halfW: number, halfH: number, lookY: number, rootY: number, pop: number, bob: number): BubbleBox {
  const W = 1.4;
  const H = 0.98;
  const LEFT = 0.45;
  const PAD = 0.06;
  const fitK = clamp((halfW - PAD - LEFT) / W, 0.15, 1);
  const w = W * pop * fitK;
  const h = H * pop * fitK;
  const x = LEFT + w / 2;
  const y = Math.min(rootY + 1.3 + bob, lookY + halfH - PAD - h / 2);
  return { x, y, w, h };
}

interface CanvasTex {
  c: HTMLCanvasElement;
  x: CanvasRenderingContext2D;
  t: ThreeNS.CanvasTexture;
}

/** Throws if WebGL isn't available. The caller shows a still picture instead. */
export function createOrb(T: Three, canvas: HTMLCanvasElement, opts: OrbOptions = {}): Orb {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });

  const RM = !!opts.reducedMotion;
  const fit = clampFit(opts.fit ?? 1);

  function lin(h: number): ThreeNS.Color {
    return new T.Color(h).convertSRGBToLinear();
  }
  function canvasTex(w: number, h: number): CanvasTex {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return { c, x: c.getContext("2d") as CanvasRenderingContext2D, t };
  }
  function spriteMat(map: ThreeNS.Texture, extra: Partial<ThreeNS.SpriteMaterialParameters>): ThreeNS.SpriteMaterial {
    return new T.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, ...extra });
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 50);
  // The height the camera is aimed at. -0.2 is the middle of the orb.
  const LOOK_Y = opts.centered ? -0.2 : 0.25;
  camera.position.set(0, LOOK_Y, 7.2);
  camera.lookAt(0, LOOK_Y, 0);

  /* ---------- reflections: a tiny studio of coloured light panels ---------- */
  const envScene = new T.Scene();
  envScene.background = new T.Color(0x05020f);
  function panel(color: number, inten: number, w: number, h: number, x: number, y: number, z: number) {
    const m = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(inten), side: T.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  }
  panel(0xffffff, 5, 7, 2.2, -4, 4.5, 4);
  panel(0xb06bff, 3, 4, 5, 6, 1, 3);
  panel(0xff4fe8, 0.45, 6, 2, 0, -4.5, 3);
  panel(0x6a3dff, 2.5, 7, 7, 0, 3, -6);
  panel(0xffffff, 1.6, 1.4, 5, 4.5, 3, 1);
  const pm = new T.PMREMGenerator(renderer);
  const envTex = pm.fromScene(envScene, 0.035).texture;
  pm.dispose();

  /* ---------- rig ---------- */
  const REST_Y = -0.2;
  const root = new T.Group();
  root.position.y = REST_Y;
  scene.add(root);
  const spinG = new T.Group();
  root.add(spinG);

  // core: deep indigo sphere with a bright fresnel edge
  const coreMat = new T.ShaderMaterial({
    uniforms: { uTint: { value: new T.Color(0, 0, 0) }, uDim: { value: 1 }, uTime: { value: 0 } },
    vertexShader:
      "varying vec3 vN; varying vec3 vV; varying vec3 vP;" +
      "void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }",
    fragmentShader:
      "uniform vec3 uTint; uniform float uDim; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;" +
      "void main(){" +
      " vec3 n = normalize(vN); vec3 v = normalize(vV);" +
      " float f = pow(1.0 - max(dot(n, v), 0.0), 2.0);" +
      " vec3 deep = vec3(0.045, 0.02, 0.23); vec3 mid = vec3(0.21, 0.08, 0.60); vec3 rim = vec3(0.80, 0.56, 1.0);" +
      " vec3 c = mix(deep, mid, smoothstep(0.0, 0.7, f));" +
      " c = mix(c, rim, smoothstep(0.5, 1.0, f) * 0.95);" +
      " float low = smoothstep(0.0, -0.95, vP.y) * (0.65 + 0.35 * smoothstep(0.3, -0.7, vP.x)); c += vec3(0.62, 0.12, 0.72) * low * 0.42;" +
      " float l = max(dot(n, normalize(vec3(-0.5, 0.7, 0.6))), 0.0); c += vec3(0.35, 0.25, 0.72) * pow(l, 3.0) * 0.5;" +
      " vec3 q = floor(vP * 46.0); float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);" +
      " c += vec3(0.85, 0.75, 1.0) * step(0.9965, h) * (0.55 + 0.45 * sin(uTime * 3.0 + h * 60.0)) * (1.0 - f * 0.6);" +
      " c += uTint; c *= uDim; gl_FragColor = vec4(c, 1.0); }",
  });
  const core = new T.Mesh(new T.SphereGeometry(0.96, 96, 64), coreMat);
  root.add(core);

  // glass shell: adds only reflections on top of the core
  const shellMat = new T.MeshStandardMaterial({
    color: 0x5a3cd8,
    metalness: 1,
    roughness: 0.1,
    envMap: envTex,
    envMapIntensity: 0.8,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const shellMesh = new T.Mesh(new T.SphereGeometry(1.0, 96, 64), shellMat);
  shellMesh.renderOrder = 1;
  root.add(shellMesh);

  // bright rim light on the edge
  const rimMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uCol: { value: new T.Color(0.62, 0.34, 1.0) } },
    vertexShader:
      "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader:
      "uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.2); gl_FragColor = vec4(uCol * f * 1.7, f); }",
  });
  const rimMesh = new T.Mesh(new T.SphereGeometry(1.035, 96, 64), rimMat);
  rimMesh.renderOrder = 2;
  root.add(rimMesh);

  // visor
  const VIS_Y = 0.25;
  const thC = Math.acos(VIS_Y / 0.992);
  const vt = canvasTex(1100, 700);
  (function () {
    const c = vt.x;
    const cx = 550;
    const cy = 350;
    const rx = 470;
    const ry = 272;
    function ell(rxx: number, ryy: number, ox?: number, oy?: number) {
      c.ellipse(cx + (ox || 0), cy + (oy || 0), rxx, ryy, 0, 0, TAU);
    }
    c.save();
    c.shadowColor = "rgba(150,100,255,0.9)";
    c.shadowBlur = 28;
    c.fillStyle = "#000";
    c.beginPath();
    ell(rx, ry);
    c.fill();
    c.restore();
    const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
    g.addColorStop(0, "#0d0728");
    g.addColorStop(0.3, "#030009");
    g.addColorStop(1, "#000000");
    c.fillStyle = g;
    c.beginPath();
    ell(rx, ry);
    c.fill();
    c.save();
    c.beginPath();
    ell(rx, ry);
    c.clip();
    const inner = c.createRadialGradient(cx, cy, ry * 0.5, cx, cy, rx);
    inner.addColorStop(0, "rgba(0,0,0,0)");
    inner.addColorStop(1, "rgba(110,70,230,0.28)");
    c.fillStyle = inner;
    c.fillRect(0, 0, 1100, 700);
    c.beginPath();
    ell(rx - 20, ry - 18);
    c.clip();
    const cg = c.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.3, cy + ry * 0.4);
    cg.addColorStop(0, "rgba(255,255,255,0.42)");
    cg.addColorStop(0.5, "rgba(210,180,255,0.14)");
    cg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = cg;
    c.beginPath();
    c.rect(0, 0, 1100, 700);
    ell(rx - 20, ry - 18, 46, 40);
    c.fill("evenodd");
    c.restore();
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,0.4)";
    c.lineWidth = 7;
    c.beginPath();
    c.ellipse(cx, cy, rx - 26, ry - 24, 0, -1.0, -0.2);
    c.stroke();
    const rg = c.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    rg.addColorStop(0, "#e2d2ff");
    rg.addColorStop(0.5, "#8458ff");
    rg.addColorStop(1, "#c19bff");
    c.save();
    c.shadowColor = "rgba(160,110,255,0.8)";
    c.shadowBlur = 10;
    c.strokeStyle = rg;
    c.lineWidth = 9;
    c.beginPath();
    ell(rx, ry);
    c.stroke();
    c.restore();
    vt.t.needsUpdate = true;
  })();
  const visor = new T.Mesh(
    new T.SphereGeometry(0.978, 96, 64, Math.PI / 2 - 1.1, 2.2, thC - 0.7, 1.4),
    new T.MeshBasicMaterial({ map: vt.t, transparent: true, depthWrite: false, toneMapped: false })
  );
  visor.renderOrder = 5;
  spinG.add(visor);

  // collar ring + skirt
  function ringBand(y: number, r: number, tube: number, col: number, op: number) {
    const m = new T.Mesh(
      new T.TorusGeometry(r, tube, 12, 120),
      new T.MeshBasicMaterial({ color: lin(col), transparent: true, opacity: op, toneMapped: false, depthWrite: false })
    );
    m.rotation.x = Math.PI / 2;
    m.position.y = y;
    spinG.add(m);
  }
  ringBand(-0.2, 0.985, 0.016, 0xd2bcff, 0.75);
  const skirt = new T.Mesh(
    new T.TorusGeometry(0.62, 0.1, 28, 120),
    new T.MeshStandardMaterial({
      color: 0x6b45f0,
      metalness: 0.75,
      roughness: 0.14,
      envMap: envTex,
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = -0.7;
  skirt.renderOrder = 3;
  root.add(skirt);

  // face: canvas drawn every frame, wrapped on the visor
  const FW = 640;
  const FH = 480;
  const EX = 110;
  const CY = 240;
  const fc = document.createElement("canvas");
  fc.width = FW;
  fc.height = FH;
  const fx = fc.getContext("2d") as CanvasRenderingContext2D;
  const faceTex = new T.CanvasTexture(fc);
  faceTex.encoding = T.sRGBEncoding;
  faceTex.anisotropy = 4;
  const faceGeo = new T.SphereGeometry(0.992, 64, 48, Math.PI / 2 - 0.8, 1.6, thC - 0.6, 1.2);
  const face = new T.Mesh(
    faceGeo,
    new T.MeshBasicMaterial({
      map: faceTex,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  face.renderOrder = 6;
  spinG.add(face);

  // badge: the Campeos logo, redrawn as vectors so it stays sharp on the orb
  const bt = canvasTex(2048, 1600);
  bt.t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  (function () {
    const c = bt.x;
    const k = 1.85;
    function logoPaths() {
      c.beginPath();
      c.moveTo(62, 570);
      c.bezierCurveTo(58, 585, 72, 600, 95, 598);
      c.bezierCurveTo(112, 596, 125, 586, 150, 568);
      c.bezierCurveTo(200, 530, 250, 515, 310, 515);
      c.lineTo(790, 515);
      c.bezierCurveTo(850, 515, 900, 485, 945, 435);
      c.lineTo(1045, 308);
      c.bezierCurveTo(1052, 298, 1048, 288, 1035, 285);
      c.lineTo(385, 285);
      c.bezierCurveTo(320, 285, 265, 315, 218, 368);
      c.lineTo(70, 560);
      c.bezierCurveTo(64, 567, 62, 568, 62, 570);
      c.closePath();
      c.moveTo(300, 555);
      c.lineTo(800, 555);
      c.bezierCurveTo(815, 555, 828, 566, 818, 580);
      c.lineTo(710, 715);
      c.bezierCurveTo(665, 770, 625, 793, 565, 793);
      c.lineTo(80, 793);
      c.bezierCurveTo(56, 793, 47, 775, 60, 758);
      c.lineTo(150, 640);
      c.bezierCurveTo(190, 590, 240, 555, 300, 555);
      c.closePath();
    }
    // soft dark backing so the logo pops against the glass
    c.save();
    c.translate(1024, 800);
    c.scale(1, 0.5);
    const bk = c.createRadialGradient(0, 0, 0, 0, 0, 980);
    bk.addColorStop(0, "rgba(6,0,36,0.62)");
    bk.addColorStop(0.6, "rgba(6,0,36,0.3)");
    bk.addColorStop(1, "rgba(6,0,36,0)");
    c.fillStyle = bk;
    c.fillRect(-1100, -1100, 2200, 2200);
    c.restore();
    c.save();
    c.translate(1024 - 557 * k, 800 - 539 * k);
    c.scale(k, k);
    // soft glow underneath, then the crisp shape on top
    c.save();
    c.shadowColor = "rgba(255,60,230,0.4)";
    c.shadowBlur = 14;
    c.fillStyle = "#9b2bd8";
    logoPaths();
    c.fill();
    c.restore();
    const gr = c.createLinearGradient(60, 0, 1050, 0);
    gr.addColorStop(0, "#4021e0");
    gr.addColorStop(0.18, "#5220d6");
    gr.addColorStop(0.5, "#a024cc");
    gr.addColorStop(0.82, "#ee10b6");
    gr.addColorStop(1, "#ff0aac");
    c.fillStyle = gr;
    logoPaths();
    c.fill();
    c.save();
    logoPaths();
    c.clip();
    const hg2 = c.createLinearGradient(0, 285, 0, 793);
    hg2.addColorStop(0, "rgba(255,255,255,0.22)");
    hg2.addColorStop(0.5, "rgba(255,255,255,0.03)");
    hg2.addColorStop(1, "rgba(0,0,30,0.12)");
    c.fillStyle = hg2;
    c.fillRect(0, 250, 1100, 580);
    c.restore();
    c.restore();
    bt.t.needsUpdate = true;
  })();
  const badge = new T.Mesh(
    new T.SphereGeometry(0.984, 96, 64, Math.PI / 2 + 0.12 - 0.6, 1.2, Math.acos(-0.55 / 0.984) - 0.465, 0.93),
    new T.MeshBasicMaterial({ map: bt.t, transparent: true, depthWrite: false, toneMapped: false })
  );
  badge.renderOrder = 7;
  spinG.add(badge);

  /* ---------- sprites ---------- */

  // halo behind the orb
  const halo = canvasTex(256, 256);
  const hg = halo.x.createRadialGradient(128, 128, 0, 128, 128, 128);
  hg.addColorStop(0, "rgba(255,255,255,0.9)");
  hg.addColorStop(0.35, "rgba(255,255,255,0.35)");
  hg.addColorStop(1, "rgba(255,255,255,0)");
  halo.x.fillStyle = hg;
  halo.x.fillRect(0, 0, 256, 256);
  halo.t.needsUpdate = true;
  const haloSp = new T.Sprite(spriteMat(halo.t, { opacity: 0.5, color: new T.Color(0x7b3dff) }));
  haloSp.scale.set(5.4, 5.4, 1);
  haloSp.position.set(0, REST_Y, -1.6);
  haloSp.renderOrder = -5;
  scene.add(haloSp);

  // curved shine along the glass edge (stays facing the camera)
  const cres = canvasTex(512, 512);
  (function () {
    const c = cres.x;
    c.lineCap = "round";
    c.shadowColor = "rgba(255,255,255,0.85)";
    c.shadowBlur = 14;
    function arc(r: number, a0: number, a1: number, w: number, al: number, col?: string) {
      c.strokeStyle = col || "rgba(255,255,255," + al + ")";
      c.lineWidth = w;
      c.beginPath();
      c.arc(256, 256, r, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
      c.stroke();
    }
    arc(214, 196, 266, 12, 0.8);
    arc(197, 214, 256, 4, 0.55);
    arc(214, 292, 338, 6, 0.5);
    arc(214, 20, 58, 5, 0.34, "rgba(255,170,250,0.5)");
    cres.t.needsUpdate = true;
  })();
  const shine = new T.Sprite(spriteMat(cres.t, { opacity: 0.95, blending: T.AdditiveBlending, depthTest: false }));
  shine.scale.set(2.3, 2.3, 1);
  shine.position.set(0, 0, 0);
  shine.renderOrder = 21;
  root.add(shine);

  // glass glare (stays facing the camera)
  const gl = canvasTex(256, 128);
  const gg = gl.x.createRadialGradient(128, 64, 0, 128, 64, 120);
  gg.addColorStop(0, "rgba(255,255,255,0.95)");
  gg.addColorStop(0.5, "rgba(255,255,255,0.25)");
  gg.addColorStop(1, "rgba(255,255,255,0)");
  gl.x.save();
  gl.x.translate(128, 64);
  gl.x.scale(1, 0.5);
  gl.x.translate(-128, -64);
  gl.x.fillStyle = gg;
  gl.x.fillRect(0, 0, 256, 256);
  gl.x.restore();
  gl.t.needsUpdate = true;
  const glare = new T.Sprite(spriteMat(gl.t, { opacity: 0.12, blending: T.AdditiveBlending, depthTest: false, rotation: 0.6 }));
  glare.scale.set(0.95, 0.5, 1);
  glare.position.set(-0.46, 0.62, 1.1);
  glare.renderOrder = 20;
  root.add(glare);
  const glare2 = new T.Sprite(spriteMat(gl.t, { opacity: 0.3, blending: T.AdditiveBlending, depthTest: false, rotation: 0.9 }));
  glare2.scale.set(0.2, 0.12, 1);
  glare2.position.set(-0.74, 0.28, 1.0);
  glare2.renderOrder = 20;
  root.add(glare2);

  // thinking bubble
  const bub = canvasTex(256, 180);
  const bubSp = new T.Sprite(spriteMat(bub.t, { depthTest: false }));
  bubSp.scale.set(0.01, 0.01, 1);
  bubSp.renderOrder = 30;
  scene.add(bubSp);
  function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function drawBubble(t: number) {
    const c = bub.x;
    c.clearRect(0, 0, 256, 180);
    c.fillStyle = "rgba(40,20,112,0.94)";
    c.strokeStyle = "rgba(190,155,255,0.95)";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(48, 112);
    c.lineTo(30, 166);
    c.lineTo(92, 118);
    c.closePath();
    c.fill();
    c.stroke();
    rr(c, 14, 14, 228, 106, 53);
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(40,20,112,1)";
    c.beginPath();
    c.moveTo(52, 114);
    c.lineTo(36, 150);
    c.lineTo(88, 116);
    c.closePath();
    c.fill();
    c.fillStyle = "#f0e5ff";
    for (let i = 0; i < 3; i++) {
      const y = 67 - Math.max(0, Math.sin(t * 6 - i * 0.8)) * 12;
      c.beginPath();
      c.arc(78 + i * 50, y, 11, 0, TAU);
      c.fill();
    }
    bub.t.needsUpdate = true;
  }

  // sparks
  const sk = canvasTex(128, 128);
  (function () {
    const c = sk.x;
    c.strokeStyle = "#ff9cf5";
    c.lineWidth = 9;
    c.lineCap = "round";
    c.shadowColor = "rgba(255,90,240,0.9)";
    c.shadowBlur = 10;
    [-80, -45, -10].forEach(function (a) {
      const r = (a * Math.PI) / 180;
      c.beginPath();
      c.moveTo(24 + Math.cos(r) * 26, 104 + Math.sin(r) * 26);
      c.lineTo(24 + Math.cos(r) * 74, 104 + Math.sin(r) * 74);
      c.stroke();
    });
    sk.t.needsUpdate = true;
  })();
  const sparkSp = new T.Sprite(spriteMat(sk.t, { depthTest: false }));
  sparkSp.scale.set(0.01, 0.01, 1);
  sparkSp.renderOrder = 30;
  scene.add(sparkSp);

  // hearts
  const ht = canvasTex(96, 96);
  (function () {
    const c = ht.x;
    const s = 30;
    const cx = 48;
    const cy = 46;
    c.shadowColor = "rgba(255,80,200,0.95)";
    c.shadowBlur = 12;
    const g = c.createLinearGradient(0, 14, 0, 82);
    g.addColorStop(0, "#ffb3ea");
    g.addColorStop(1, "#ff4fc4");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx, cy + s * 0.7);
    c.bezierCurveTo(cx - s * 1.25, cy - s * 0.05, cx - s * 0.95, cy - s * 1.0, cx, cy - s * 0.35);
    c.bezierCurveTo(cx + s * 0.95, cy - s * 1.0, cx + s * 1.25, cy - s * 0.05, cx, cy + s * 0.7);
    c.fill();
    ht.t.needsUpdate = true;
  })();
  interface HeartData {
    life: number;
    max: number;
    vx: number;
    vy: number;
    base: number;
  }
  const hearts: ThreeNS.Sprite[] = [];
  for (let hi = 0; hi < 9; hi++) {
    const hs = new T.Sprite(spriteMat(ht.t, { opacity: 0, depthTest: false }));
    hs.visible = false;
    hs.renderOrder = 25;
    hs.userData = { life: 0, max: 1, vx: 0, vy: 0, base: 0.3 } as HeartData;
    scene.add(hs);
    hearts.push(hs);
  }
  function spawnHeart() {
    for (let i = 0; i < hearts.length; i++) {
      const h = hearts[i];
      if (!h.visible) {
        h.visible = true;
        const u = h.userData as HeartData;
        u.life = 0;
        u.max = rnd(1.5, 2.4);
        u.vx = rnd(-0.3, 0.3);
        u.vy = rnd(0.5, 0.95);
        u.base = rnd(0.24, 0.46);
        h.position.set(root.position.x + rnd(-0.9, 0.9), root.position.y + rnd(0.1, 0.9), 0.8);
        return;
      }
    }
  }

  // orbit ring (optional)
  const ringMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new T.Color(0.62, 0.36, 1.0) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform float uTime; uniform vec3 uCol; varying vec2 vUv; void main(){ float a = vUv.x * 6.28318; float head = 0.5 + 0.5 * sin(a - uTime * 2.2); float g = 0.28 + 0.72 * pow(head, 3.0); gl_FragColor = vec4(uCol * g * 1.5, g); }",
  });
  const ringHolder = new T.Group();
  ringHolder.visible = false;
  const ringMesh = new T.Mesh(new T.TorusGeometry(1.72, 0.024, 12, 180), ringMat);
  ringMesh.rotation.set(1.28, 0, -0.14);
  ringHolder.add(ringMesh);
  ringHolder.position.y = REST_Y;
  scene.add(ringHolder);

  /* ---------- faces ---------- */
  interface FaceParams {
    lx: number;
    ly: number;
    blink: number;
    t: number;
  }
  function glow(c: CanvasRenderingContext2D, fn: () => void) {
    c.save();
    c.shadowColor = "rgba(190,110,255,0.95)";
    c.shadowBlur = 34;
    c.fillStyle = "#f6edff";
    c.strokeStyle = "#f6edff";
    c.lineCap = "round";
    c.lineJoin = "round";
    fn();
    fn();
    c.restore();
  }
  function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
    c.beginPath();
    c.ellipse(x, y, rx, Math.max(2, ry), 0, 0, TAU);
    c.fill();
  }
  function heart(c: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    c.beginPath();
    c.moveTo(cx, cy + s * 0.7);
    c.bezierCurveTo(cx - s * 1.25, cy - s * 0.05, cx - s * 0.95, cy - s * 1.0, cx, cy - s * 0.35);
    c.bezierCurveTo(cx + s * 0.95, cy - s * 1.0, cx + s * 1.25, cy - s * 0.05, cx, cy + s * 0.7);
    c.fill();
  }
  function arcEye(c: CanvasRenderingContext2D, x: number, y: number) {
    c.lineWidth = 13;
    c.beginPath();
    c.moveTo(x - 40, y + 16);
    c.quadraticCurveTo(x, y - 36, x + 40, y + 16);
    c.stroke();
  }
  function smile(c: CanvasRenderingContext2D, y: number) {
    c.lineWidth = 11;
    c.beginPath();
    c.arc(FW / 2, y, 44, 0.12 * Math.PI, 0.88 * Math.PI);
    c.stroke();
  }
  const DRAW: Record<OrbMood, (c: CanvasRenderingContext2D, p: FaceParams) => void> = {
    idle(c, p) {
      const h = 60 * (1 - p.blink * 0.93);
      glow(c, () => {
        oval(c, FW / 2 - EX + p.lx, CY + p.ly, 34, h);
        oval(c, FW / 2 + EX + p.lx, CY + p.ly, 34, h);
      });
    },
    happy(c, p) {
      glow(c, () => {
        arcEye(c, FW / 2 - EX + p.lx, CY + p.ly);
        arcEye(c, FW / 2 + EX + p.lx, CY + p.ly);
        smile(c, CY + 78 + p.ly);
      });
    },
    love(c, p) {
      const s = 56 * (1 + 0.09 * Math.sin(p.t * 8));
      glow(c, () => {
        heart(c, FW / 2 - EX + p.lx, CY + p.ly - 6, s);
        heart(c, FW / 2 + EX + p.lx, CY + p.ly - 6, s);
        c.beginPath();
        c.arc(FW / 2, CY + 74 + p.ly, 38, 0, Math.PI);
        c.closePath();
        c.fill();
      });
    },
    wink(c, p) {
      const h = 60 * (1 - p.blink * 0.93);
      glow(c, () => {
        oval(c, FW / 2 - EX + p.lx, CY + p.ly, 34, h);
        const x = FW / 2 + EX + p.lx;
        const y = CY + p.ly;
        c.lineWidth = 14;
        c.beginPath();
        c.moveTo(x + 32, y - 32);
        c.lineTo(x - 26, y);
        c.lineTo(x + 32, y + 32);
        c.stroke();
      });
    },
    thinking(c, p) {
      const h = 46 * (1 - p.blink * 0.93);
      glow(c, () => {
        oval(c, FW / 2 - EX + 24 + p.lx, CY - 30 + p.ly, 28, h);
        oval(c, FW / 2 + EX + 24 + p.lx, CY - 30 + p.ly, 28, h);
      });
    },
    surprised(c, p) {
      const h = 78 * (1 - p.blink * 0.9);
      glow(c, () => {
        oval(c, FW / 2 - EX + p.lx, CY - 6 + p.ly, 38, h);
        oval(c, FW / 2 + EX + p.lx, CY - 6 + p.ly, 38, h);
        c.lineWidth = 10;
        c.beginPath();
        c.ellipse(FW / 2, CY + 116 + p.ly, 17, 22, 0, 0, TAU);
        c.stroke();
      });
    },
    sleepy(c, p) {
      glow(c, () => {
        c.lineWidth = 12;
        [-1, 1].forEach((s) => {
          const x = FW / 2 + s * EX + p.lx;
          const y = CY + 4 + p.ly;
          c.beginPath();
          c.moveTo(x - 36, y - 4);
          c.quadraticCurveTo(x, y + 30, x + 36, y - 4);
          c.stroke();
        });
        c.font = "600 56px system-ui, sans-serif";
        c.fillText("z", 452, 96 - Math.sin(p.t * 1.6) * 6);
        c.font = "600 36px system-ui, sans-serif";
        c.fillText("z", 494, 52 - Math.sin(p.t * 1.6 + 1) * 5);
      });
    },
  };

  /* ---------- state ---------- */
  const G = 24;
  const HOP_V = 6.0;
  const SPR_K = 70;
  const SPR_C = 9.5;
  const st = {
    mood: "idle" as OrbMood,
    glimpse: null as OrbMood | null,
    glimpseT: 0,
    faceFrom: "idle" as OrbMood,
    faceTo: "idle" as OrbMood,
    faceK: 1,
    y: 0,
    vy: 0,
    air: false,
    hops: 0,
    wind: -1,
    sq: 0,
    sqv: 0,
    sqT: 0,
    yaw: 0,
    yawv: 0,
    yawT: 0,
    dragging: false,
    nod: -1,
    shake: -1,
    blinkP: -1,
    blink: 0,
    nextBlink: 2.2,
    lookX: 0,
    lookY: 0,
    autoLook: null as { x: number; y: number } | null,
    autoLookT: 0,
    th: 0,
    thv: 0,
    sparks: 0,
    heartT: 0,
    dimCur: 1,
    alive: opts.alive !== false && !RM,
    glowOn: opts.glow !== false,
    ringOn: !!opts.ring,
  };
  const auto = { look: 2.5, hop: 7, glimpse: 11 };
  const pointer = { x: 0, y: 0, active: false, last: 0 };
  const tintCur = new T.Color(0, 0, 0);
  const haloCur = new T.Color(0x7b3dff);
  const ringCol = new T.Color(0.62, 0.36, 1.0);
  const tmpColor = new T.Color();

  function bounce() {
    if (st.wind >= 0 || st.air) return;
    st.wind = 0.13;
    st.sqT = -0.25;
  }
  function spinOnce() {
    st.yawT += TAU;
    st.yawv -= 3.5;
  }
  function nodOnce() {
    if (st.nod < 0) st.nod = 0;
  }
  function shakeOnce() {
    if (st.shake < 0) st.shake = 0;
  }
  function glimpse(mood: OrbMood, seconds: number) {
    st.glimpse = mood;
    st.glimpseT = seconds;
  }

  /* ---------- pointer: eyes follow, drag to spin, tap to hop ---------- */
  function onWindowPointerMove(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    const r = canvas.getBoundingClientRect();
    pointer.x = clamp((e.clientX - (r.left + r.width / 2)) / Math.max(1, r.width * 0.5), -1, 1);
    pointer.y = clamp(-(e.clientY - (r.top + r.height * 0.5)) / Math.max(1, r.height * 0.5), -1, 1);
    pointer.active = true;
    pointer.last = performance.now();
  }
  function onDocLeave() {
    pointer.active = false;
  }
  if (opts.follow !== false) {
    window.addEventListener("pointermove", onWindowPointerMove);
    document.documentElement.addEventListener("pointerleave", onDocLeave);
  }

  const drag = { x: 0, t: 0, moved: 0, t0: 0 };
  function onDown(e: PointerEvent) {
    st.dragging = true;
    drag.x = e.clientX;
    drag.t = performance.now();
    drag.t0 = drag.t;
    drag.moved = 0;
    st.yawv = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not supported: dragging still works while the pointer stays on the canvas */
    }
    canvas.style.cursor = "grabbing";
  }
  function onMove(e: PointerEvent) {
    if (!st.dragging) return;
    const now = performance.now();
    const dx = e.clientX - drag.x;
    const dtm = Math.max(1, now - drag.t);
    st.yaw += dx * 0.012;
    st.yawv = clamp((dx * 0.012) / (dtm / 1000), -26, 26);
    drag.moved += Math.abs(dx);
    drag.x = e.clientX;
    drag.t = now;
  }
  function onUp() {
    if (!st.dragging) return;
    st.dragging = false;
    canvas.style.cursor = "grab";
    if (drag.moved < 6 && performance.now() - drag.t0 < 400) {
      bounce();
      if (st.mood === "sleepy") glimpse("surprised", 1.4);
      else if (st.mood === "idle") glimpse("happy", 1.5);
      st.yawT = Math.round(st.yaw / TAU) * TAU;
    } else {
      st.yawT = Math.round((st.yaw + st.yawv * 0.22) / TAU) * TAU;
    }
  }
  if (opts.interactive) {
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
  }

  /* ---------- sizing ---------- */
  // How much the camera can see either side of the middle, in orb units.
  // Filled in by resize().
  const view = { halfW: 2, halfH: 2 };
  function resize(w: number, h: number) {
    const W = Math.max(40, w);
    const H = Math.max(40, h);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.z = 6.3 * fit * Math.max(1, 0.96 / camera.aspect);
    camera.updateProjectionMatrix();
    view.halfH = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    view.halfW = view.halfH * camera.aspect;
  }
  resize(canvas.clientWidth || 200, canvas.clientHeight || 200);

  /* ---------- frame ---------- */
  const clock = new T.Clock();
  let time = 0;
  let paused = false;
  let raf = 0;
  let disposed = false;
  const prm: FaceParams = { lx: 0, ly: 0, blink: 0, t: 0 };

  function drawFace(t: number) {
    fx.clearRect(0, 0, FW, FH);
    prm.lx = st.lookX * 22;
    prm.ly = -st.lookY * 14;
    prm.blink = st.blink;
    prm.t = t;
    const k = st.faceK;
    if (k < 1 && st.faceFrom !== st.faceTo) {
      fx.save();
      fx.globalAlpha = 1 - ease(k);
      fx.translate(FW / 2, CY);
      fx.scale(1.22, 1.22);
      fx.translate(-FW / 2, -CY);
      DRAW[st.faceFrom](fx, prm);
      fx.restore();
    }
    fx.save();
    fx.globalAlpha = k < 1 ? ease(k) : 1;
    const sc = (0.88 + 0.12 * ease(k)) * 1.22;
    fx.translate(FW / 2, CY);
    fx.scale(sc, sc);
    fx.translate(-FW / 2, -CY);
    DRAW[st.faceTo](fx, prm);
    fx.restore();
    faceTex.needsUpdate = true;
  }

  function update(dt: number, t: number) {
    const now = performance.now();
    if (pointer.active && now - pointer.last > 4000) pointer.active = false;
    let shown: OrbMood = st.glimpse || st.mood;

    // alive: little autonomous behaviours
    if (st.alive && !st.dragging) {
      auto.look -= dt;
      if (auto.look <= 0) {
        auto.look = rnd(3, 6.5);
        if (Math.random() < 0.7) {
          st.autoLook = { x: rnd(-0.9, 0.9), y: rnd(-0.5, 0.5) };
          st.autoLookT = rnd(1, 2.2);
        }
      }
      if (st.autoLook) {
        st.autoLookT -= dt;
        if (st.autoLookT <= 0) st.autoLook = null;
      }
      if (opts.restless !== false && st.mood === "idle" && !pointer.active) {
        auto.hop -= dt;
        if (auto.hop <= 0) {
          auto.hop = rnd(9, 17);
          bounce();
        }
        auto.glimpse -= dt;
        if (auto.glimpse <= 0) {
          auto.glimpse = rnd(11, 19);
          const faces: OrbMood[] = ["happy", "wink", "surprised"];
          glimpse(faces[Math.floor(Math.random() * 3)], 1.7);
        }
      }
    } else {
      st.autoLook = null;
    }

    // look
    let tx = 0;
    let ty = 0;
    if (pointer.active) {
      tx = pointer.x;
      ty = pointer.y;
    } else if (st.autoLook) {
      tx = st.autoLook.x;
      ty = st.autoLook.y;
    }
    if (shown === "sleepy") {
      tx *= 0.2;
      ty = -0.3;
    }
    const lk = Math.min(1, dt * 6);
    st.lookX += (tx - st.lookX) * lk;
    st.lookY += (ty - st.lookY) * lk;

    // blink
    st.nextBlink -= dt;
    if (st.nextBlink <= 0 && st.blinkP < 0) {
      st.blinkP = 0;
      st.nextBlink = rnd(2.2, 5.4);
    }
    if (st.blinkP >= 0) {
      st.blinkP += dt / 0.16;
      if (st.blinkP >= 1) {
        st.blinkP = -1;
        st.blink = 0;
      } else st.blink = Math.sin(st.blinkP * Math.PI);
    }

    // glimpse timeout
    if (st.glimpse) {
      st.glimpseT -= dt;
      if (st.glimpseT <= 0) st.glimpse = null;
    }
    shown = st.glimpse || st.mood;
    if (shown !== st.faceTo) {
      st.faceFrom = st.faceTo;
      st.faceTo = shown;
      st.faceK = 0;
      st.sqv += 1.4;
    }
    st.faceK = Math.min(1, st.faceK + dt / 0.2);

    // bounce physics with squash and stretch
    if (st.wind >= 0) {
      st.wind -= dt;
      if (st.wind < 0) {
        st.wind = -1;
        st.vy = HOP_V;
        st.air = true;
        st.hops = 2;
        st.sqv += 4;
      }
    }
    if (st.air) {
      st.vy -= G * dt;
      st.y += st.vy * dt;
      st.sqT = clamp(Math.abs(st.vy) * 0.022, 0, 0.15);
      if (st.y <= 0 && st.vy < 0) {
        const imp = -st.vy;
        st.y = 0;
        st.sq = -Math.min(0.3, imp * 0.045);
        st.sqv = 0;
        if (st.hops > 0 && imp * 0.36 > 1.5) {
          st.vy = imp * 0.36;
          st.hops--;
        } else {
          st.air = false;
          st.vy = 0;
          st.sqT = 0;
        }
      }
    } else if (st.wind < 0) {
      st.sqT = 0;
    }
    st.sqv += ((st.sqT - st.sq) * 240 - st.sqv * 15) * dt;
    st.sq += st.sqv * dt;

    // spin spring
    if (!st.dragging) {
      st.yawv += ((st.yawT - st.yaw) * SPR_K - st.yawv * SPR_C) * dt;
      st.yaw += st.yawv * dt;
      if (Math.abs(st.yawT - st.yaw) < 0.003 && Math.abs(st.yawv) < 0.02 && Math.abs(st.yawT) > TAU * 0.9) {
        const kk = Math.round(st.yawT / TAU) * TAU;
        st.yaw -= kk;
        st.yawT -= kk;
      }
    }
    let nodOff = 0;
    let shakeOff = 0;
    if (st.nod >= 0) {
      st.nod += dt / 0.9;
      if (st.nod >= 1) st.nod = -1;
      else nodOff = Math.sin(st.nod * Math.PI * 3) * 0.32 * (1 - st.nod * 0.5);
    }
    if (st.shake >= 0) {
      st.shake += dt / 0.9;
      if (st.shake >= 1) st.shake = -1;
      else shakeOff = Math.sin(st.shake * TAU * 2.5) * 0.65 * (1 - st.shake);
    }

    // apply to rig
    const air = clamp(st.y / 0.25, 0, 1);
    const amp = RM ? 0.012 : 0.05;
    const bob = Math.sin(t * 1.6) * amp * (1 - air) * (shown === "sleepy" ? 0.5 : 1);
    const sy = 1 + st.sq + Math.sin(t * 2.1) * 0.01;
    const sx = 1 / Math.sqrt(sy);
    root.scale.set(sx, sy, sx);
    root.position.y = REST_Y + st.y + bob + (sy - 1) * 0.96 * (1 - air);
    root.rotation.x =
      -st.lookY * 0.16 * (shown === "sleepy" ? 0 : 1) + nodOff + (shown === "sleepy" ? 0.18 + Math.sin(t * 1.1) * 0.03 : 0);
    root.rotation.z = -st.lookX * 0.06 + Math.sin(t * 0.9) * (RM ? 0 : 0.03);
    spinG.rotation.y = st.yaw + st.lookX * 0.36 + shakeOff;
    haloSp.position.set(0, root.position.y * 0.8 + REST_Y * 0.2, -1.6);
    ringHolder.position.y = REST_Y + st.y * 0.6;

    // moods: colours
    const M = MOOD_STYLE[shown];
    const ck = Math.min(1, dt * 5);
    tintCur.r += (M.tint[0] - tintCur.r) * ck;
    tintCur.g += (M.tint[1] - tintCur.g) * ck;
    tintCur.b += (M.tint[2] - tintCur.b) * ck;
    coreMat.uniforms.uTint.value.copy(tintCur);
    coreMat.uniforms.uTime.value = t;
    st.dimCur += (M.dim - st.dimCur) * ck;
    coreMat.uniforms.uDim.value = st.dimCur;
    haloCur.lerp(tmpColor.set(M.halo), ck);
    haloSp.material.color.copy(haloCur);
    haloSp.material.opacity += ((st.glowOn ? 0.5 * st.dimCur : 0) - haloSp.material.opacity) * ck;
    ringCol.lerp(tmpColor.set(M.halo), ck);
    ringMat.uniforms.uCol.value.copy(ringCol).multiplyScalar(1.2);
    rimMat.uniforms.uCol.value.copy(haloCur).lerp(tmpColor.setRGB(0.7, 0.5, 1), 0.5);
    ringHolder.visible = st.ringOn;
    ringMat.uniforms.uTime.value = t;

    drawFace(t);

    // thinking bubble
    const thT = shown === "thinking" ? 1 : 0;
    st.thv += ((thT - st.th) * 260 - st.thv * 18) * dt;
    st.th += st.thv * dt;
    const ths = Math.max(0, st.th);
    if (opts.bubble !== false && ths > 0.02) {
      drawBubble(t);
      const bb = bubbleLayout(view.halfW, view.halfH, LOOK_Y, root.position.y, ths, Math.sin(t * 2) * 0.04);
      bubSp.visible = true;
      bubSp.scale.set(bb.w, bb.h, 1);
      bubSp.position.set(root.position.x + bb.x, bb.y, 0.8);
    } else bubSp.visible = false;

    // sparks
    const spT = shown === "wink" || shown === "surprised" ? 1 : 0;
    st.sparks += (spT - st.sparks) * Math.min(1, dt * 12);
    if (st.sparks > 0.03) {
      const fl = 1 + 0.07 * Math.sin(t * 14);
      sparkSp.visible = true;
      sparkSp.scale.set(0.62 * st.sparks * fl, 0.62 * st.sparks * fl, 1);
      sparkSp.material.opacity = st.sparks * (0.75 + 0.25 * Math.sin(t * 14));
      sparkSp.position.set(root.position.x + 1.05, root.position.y + 1.0, 0.8);
    } else sparkSp.visible = false;

    // hearts
    if (shown === "love") {
      st.heartT -= dt;
      if (st.heartT <= 0) {
        spawnHeart();
        st.heartT = rnd(0.2, 0.42);
      }
    }
    hearts.forEach((h) => {
      if (!h.visible) return;
      const u = h.userData as HeartData;
      u.life += dt;
      const k = u.life / u.max;
      if (k >= 1) {
        h.visible = false;
        return;
      }
      h.position.x += u.vx * dt;
      h.position.y += u.vy * dt;
      h.material.opacity = Math.pow(Math.sin(k * Math.PI), 0.7);
      const s = u.base * (0.6 + 0.6 * k);
      h.scale.set(s, s, 1);
    });
  }

  function frame() {
    if (disposed || paused) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    update(dt, time);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setMood(mood) {
      st.mood = mood;
      st.glimpse = null;
    },
    glimpse(mood, seconds = 1.5) {
      glimpse(mood, seconds);
    },
    hop: bounce,
    spin: spinOnce,
    nod: nodOnce,
    shake: shakeOnce,
    setAlive(on) {
      st.alive = on && !RM;
    },
    setRing(on) {
      st.ringOn = on;
    },
    setPaused(p) {
      if (disposed || p === paused) return;
      paused = p;
      if (!p) {
        clock.getDelta(); // don't treat the pause as one giant frame
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onWindowPointerMove);
      document.documentElement.removeEventListener("pointerleave", onDocLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      [scene, envScene].forEach((s) =>
        s.traverse((obj) => {
          const o = obj as ThreeNS.Mesh;
          if (o.geometry) o.geometry.dispose();
          const m = o.material as ThreeNS.Material | ThreeNS.Material[] | undefined;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else if (m) m.dispose();
        })
      );
      [vt, bt, halo, cres, gl, bub, sk, ht].forEach((x) => x.t.dispose());
      faceTex.dispose();
      envTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
