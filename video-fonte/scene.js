import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1920, H = 1080;
const HEX = { blue: '#2F5BEA', orange: '#FF7A1A', slate: '#2B3042', yellow: '#FFD23F', paper: '#EDF0F6' };

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOut = x => 1 - Math.pow(1 - x, 3);
const eIn = x => x * x * x;
const eBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;

// ---------- renderer ----------
const stage = document.getElementById('stage');
const ov = document.getElementById('ov');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.insertBefore(renderer.domElement, ov);

const scene = new THREE.Scene();
scene.background = new THREE.Color(HEX.paper);
scene.fog = new THREE.Fog(HEX.paper, 26, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d0e2, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -6, near: 1, far: 50 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// floor: caderno quadriculado
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#E7EBF3'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#D3DAE8'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1200, 120); tex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 120),
    new THREE.MeshStandardMaterial({ map: tex, roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(300, 0, -20); floor.receiveShadow = true;
  scene.add(floor);
}

// ---------- text textures ----------
const PPU = 220;
const mctx = document.createElement('canvas').getContext('2d');
function parse(str) { // "Espero [que] você|linha 2" -> lines of segments
  return str.split('|').map(line => {
    const segs = []; const re = /\[([^\]]+)\]|([^\[]+)/g; let m;
    while ((m = re.exec(line))) segs.push(m[1] ? { t: m[1], h: true } : { t: m[2] });
    return segs;
  });
}
function measure(str, size, weight = 700, font = 'Bricolage') {
  mctx.font = `${weight} ${size * PPU}px ${font}`;
  return Math.max(...parse(str).map(l => l.reduce((a, s) => a + mctx.measureText(s.t).width, 0))) / PPU;
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function textTex(wU, hU, str, o = {}) {
  const { bg, fg = '#fff', size = .6, weight = 700, font = 'Bricolage', hl = '#FFD84D', hlFg = '#171A26', dx = 0, align = 'center', padL = .4 } = o;
  const cw = Math.round(wU * PPU), ch = Math.round(hU * PPU);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
  const fs = size * PPU; g.font = `${weight} ${fs}px ${font}`; g.textBaseline = 'middle';
  const lines = parse(str), lh = fs * 1.2;
  lines.forEach((segs, i) => {
    const y = ch / 2 + (i - (lines.length - 1) / 2) * lh;
    const ws = segs.map(s => g.measureText(s.t).width), tot = ws.reduce((a, b) => a + b, 0);
    let x = align === 'center' ? (cw - tot) / 2 + dx * PPU : padL * PPU;
    segs.forEach((s, j) => {
      if (s.h) { g.fillStyle = hl; rrect(g, x - fs * .1, y - fs * .6, ws[j] + fs * .2, fs * 1.16, fs * .2); g.fill(); g.fillStyle = hlFg; }
      else g.fillStyle = fg;
      g.fillText(s.t, x, y + fs * .05); x += ws[j];
    });
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  tex.repeat.set(1 / wU, 1 / hU); tex.offset.set(.5, .5);
  return tex;
}

// ---------- shapes ----------
function rr(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
const SOCK = .46, KNOB = .33;
function socketShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, -SOCK); s.absarc(x + w, 0, SOCK, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function knobShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, KNOB); s.absarc(x, 0, KNOB, Math.PI / 2, Math.PI * 1.5, false);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function tagShape(w, h, r, dir) { // dir -1: ponta à esquerda, 1: ponta à direita
  const m = x => dir < 0 ? x : -x, p = h * .42, s = new THREE.Shape();
  s.moveTo(m(-w / 2), 0); s.lineTo(m(-w / 2 + p), h / 2); s.lineTo(m(w / 2 - r), h / 2);
  s.quadraticCurveTo(m(w / 2), h / 2, m(w / 2), h / 2 - r); s.lineTo(m(w / 2), -h / 2 + r);
  s.quadraticCurveTo(m(w / 2), -h / 2, m(w / 2 - r), -h / 2); s.lineTo(m(-w / 2 + p), -h / 2); s.lineTo(m(-w / 2), 0);
  const hole = new THREE.Path(); hole.absarc(m(-w / 2 + p * .78), 0, .13, 0, Math.PI * 2, false); s.holes.push(hole);
  return { s, dx: dir < 0 ? p / 2 : -p / 2 };
}

function mat(color, map) {
  return new THREE.MeshPhysicalMaterial({ color: map ? 0xffffff : color, map: map || null, roughness: .42, clearcoat: .55, clearcoatRoughness: .3 });
}
function extrude(shape, depth, color, tex) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .07, bevelSize: .06, bevelSegments: 5, curveSegments: 28 });
  geo.translate(0, 0, -depth / 2);
  const side = mat(color);
  const m = new THREE.Mesh(geo, [tex ? mat(color, tex) : side, side]);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function pivot(mesh, w, h) { const g = new THREE.Group(); g.add(mesh); g.userData = { w, h, mesh }; return g; }

const BH = 1.5, BD = .7, TS = .6;
const fg = { slate: '#F5F6FA', blue: '#FFFFFF', orange: '#2A1606', yellow: '#1B1B1B' };
const hlFor = { slate: '#FFD84D', blue: '#FFD84D', orange: '#FFF3C4', yellow: '#FFFFFF' };
function block(text, color = 'slate', o = {}) {
  const size = o.size || TS, w = o.w || measure(text, size) + 1.0, h = o.h || BH;
  const tex = textTex(w, h, text, { bg: HEX[color], fg: fg[color], size, hl: hlFor[color] });
  const shape = o.socket ? socketShape(w, h, .22) : rr(w, h, .22);
  return pivot(extrude(shape, o.d || BD, HEX[color], tex), w, h);
}
function piece(text, color = 'blue', o = {}) {
  const size = o.size || TS, w = o.w || measure(text, size) + 1.1, h = BH;
  const tex = textTex(w, h, text, { bg: HEX[color], fg: fg[color], size, hl: hlFor[color], dx: .12 });
  return pivot(extrude(knobShape(w, h, .22), BD, HEX[color], tex), w, h);
}
function tag(text, dir = -1, o = {}) {
  const size = o.size || TS, h = BH, w = o.w || measure(text, size) + 1.0 + h * .42;
  const { s, dx } = tagShape(w, h, .22, dir);
  const tex = textTex(w, h, text, { bg: HEX.orange, fg: fg.orange, size, hl: hlFor.orange, dx });
  return pivot(extrude(s, BD, HEX.orange, tex), w, h);
}
function coin(text) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, .42, 72), mat(HEX.yellow));
  cyl.rotation.x = Math.PI / 2; cyl.castShadow = true; g.add(cyl);
  const tex = textTex(2.3, 2.3, text, { bg: HEX.yellow, fg: fg.yellow, size: text.length > 2 ? .78 : 1.0, weight: 800 });
  tex.repeat.set(1, 1); tex.offset.set(0, 0);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.1, 72), new THREE.MeshPhysicalMaterial({ map: tex, roughness: .4, clearcoat: .6 }));
  face.position.z = .212; g.add(face);
  const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -.212; g.add(back);
  g.userData = { w: 2.3, h: 2.3 };
  return g;
}
function clock() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, .28, 64), mat('#FFFFFF'));
  body.rotation.x = Math.PI / 2; body.castShadow = true; g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.86, .1, 20, 64), mat(HEX.orange)); rim.castShadow = true; g.add(rim);
  for (let i = 0; i < 12; i++) {
    const tk = new THREE.Mesh(new THREE.BoxGeometry(.05, i % 3 ? .1 : .18, .04), mat(HEX.slate));
    const a = i / 12 * Math.PI * 2; tk.position.set(Math.sin(a) * .66, Math.cos(a) * .66, .16); tk.rotation.z = -a; g.add(tk);
  }
  const mk = (len, wd) => { const p = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(wd, len, .05), mat(HEX.slate)); b.position.y = len / 2 - .06; p.add(b); p.position.z = .19; g.add(p); return p; };
  g.userData.hr = mk(.42, .09); g.userData.mn = mk(.6, .06);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.07, 20, 12), mat(HEX.orange)); dot.position.z = .22; g.add(dot);
  return g;
}
function ring(color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.55, .66, 64), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  m.visible = false; return m;
}
function ghost(src) {
  const m = new THREE.Mesh(src.userData.mesh.geometry, new THREE.MeshBasicMaterial({ color: HEX.blue, transparent: true, opacity: .2, depthWrite: false }));
  const g = new THREE.Group(); g.add(m); g.userData = { ...src.userData, mat: m.material }; return g;
}

// ---------- overlay helpers ----------
const els = [];
function el(cls, html) { const d = document.createElement('div'); d.className = 'abs ' + cls; d.innerHTML = html; ov.appendChild(d); els.push(d); return d; }
function place(d, x, y, op, ax = .5, ay = 0, sc = 1) {
  if (op <= 0.001) { d.style.opacity = 0; return; }
  const w = d.offsetWidth, h = d.offsetHeight;
  d.style.opacity = op;
  d.style.transform = `translate(${x - w * ax}px, ${y - h * ay}px) scale(${sc})`;
}
const v3 = new THREE.Vector3();
function scr(obj, x = 0, y = 0, z = 0) {
  obj.updateWorldMatrix(true, false);
  v3.set(x, y, z); obj.localToWorld(v3); v3.project(camera);
  return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H];
}
const fadeIn = (lt, a, d = .4) => eOut(P(lt, a, a + d));
const win = (lt, a, b, d = .35) => Math.min(eOut(P(lt, a, a + d)), 1 - P(lt, b - d, b));

// ---------- animation helpers ----------
function setBase(o, x, y, z = 0, s = 1) { o.userData.base = { x, y, z, s }; return o; }
function rest(o) { const b = o.userData.base; o.position.set(b.x, b.y, b.z); o.rotation.set(0, 0, 0); o.scale.setScalar(b.s); o.visible = true; }
function pop(o, lt, a, d = .7) {
  const b = o.userData.base, p = P(lt, a, a + d);
  o.visible = p > 0;
  o.position.set(b.x, b.y + (1 - eOut(p)) * 1.2, b.z);
  o.scale.setScalar(b.s * Math.max(.001, eBack(p)));
  o.rotation.set(0, (1 - eOut(p)) * -.5, 0);
}
function flyIn(o, lt, a, d, from, rot = [.5, -.8, .35]) {
  const b = o.userData.base, p = P(lt, a, a + d), e = eOut(p);
  o.visible = p > 0;
  o.position.set(lerp(b.x + from[0], b.x, e), lerp(b.y + from[1], b.y, e), lerp(b.z + from[2], b.z, e));
  o.rotation.set(rot[0] * (1 - e), rot[1] * (1 - e), rot[2] * (1 - e));
  o.scale.setScalar(b.s);
}
function flyOut(o, lt, a, d, to, rot = [.6, .9, -.5]) {
  const b = o.userData.base, p = P(lt, a, a + d), e = eIn(p);
  o.visible = p < 1;
  o.position.set(b.x + to[0] * e, b.y + to[1] * e, b.z + to[2] * e);
  o.rotation.set(rot[0] * e, rot[1] * e, rot[2] * e);
}
function flip(a, b, lt, t0, d = 1.1) {
  const p = eIO(P(lt, t0, t0 + d));
  if (p < .5) { a.visible = true; b.visible = false; a.rotation.y = p * Math.PI; }
  else { a.visible = false; b.visible = true; b.rotation.y = (p - 1) * Math.PI; }
}
function pulse(o, lt, a) { const p = P(lt, a, a + .45); if (p > 0 && p < 1) o.scale.multiplyScalar(1 + Math.sin(p * Math.PI) * .07); }
function ringFx(r, lt, a, at) {
  const p = P(lt, a, a + .9); r.visible = p > 0 && p < 1;
  r.position.copy(at); r.scale.setScalar(1 + eOut(p) * 3.2); r.material.opacity = (1 - p) * .85;
}
// layout of a 2-part composite: returns centers of left and right parts
function duo(left, right, cx = 0, s = 1, gap = .04) {
  const tot = (left.userData.w + right.userData.w + gap) * s;
  return [cx - tot / 2 + left.userData.w * s / 2, cx - tot / 2 + (left.userData.w + gap) * s + right.userData.w * s / 2];
}
const yb = (o, s = 1) => o.userData.h * s / 2 + .03;

// ---------- scenes ----------
const SPACING = 44;
const scenes = [];
const REAL = { 'Abertura': 5, 'Substantiva': 9, 'Teste do ISSO': 6, 'Adverbial': 10, 'Teste da retirada': 8, 'Pegadinha: QUE': 7, 'Questão Fuvest': 13, 'Resumo': 6 };
function addScene(name, odur, cam, build) { if (!REAL[name]) return; scenes.push({ name, odur, dur: REAL[name], sp: odur / REAL[name], cam, build }); }

// 0 — Abertura
addScene('Abertura', 7, { y: 2.9, z: 16.5, ly: 2.75 }, (g) => {
  const pz = piece('SUBSTANTIVA', 'blue', { size: .52 }); const tg = tag('ADVERBIAL', -1, { size: .52 });
  const xa = new THREE.Group();
  for (const r of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, .26, .26), mat('#9AA3BD')); b.rotation.z = r * Math.PI / 4; b.castShadow = true; xa.add(b); }
  const ck = clock(); ck.scale.setScalar(.62);
  setBase(pz, -4.3, yb(pz)); setBase(tg, 4.3, yb(tg)); setBase(xa, 0, .9); setBase(ck, 4.9, 2.35, .2, .62);
  g.add(pz, tg, xa, ck);
  const title = el('', `<div class="eb">Orações subordinadas</div><h1><span class="s">Substantiva</span> <span class="x">×</span> <span class="a">Adverbial</span></h1><p>Como diferenciar de uma vez por todas</p>`); title.id = 'title';
  return (lt) => {
    pop(pz, lt, .6); pop(tg, lt, .85); pop(xa, lt, 1.2, .6); pop(ck, lt, 1.5, .6);
    const f = Math.sin(lt * 1.6) * .08;
    pz.position.y += f; tg.position.y -= f; pz.rotation.y += Math.sin(lt * .8) * .12; tg.rotation.y -= Math.sin(lt * .8) * .12;
    xa.rotation.y = lt * .9;
    ck.userData.mn.rotation.z = -lt * 2.2; ck.userData.hr.rotation.z = -lt * .3;
    const op = win(lt, .3, 6.9, .6);
    place(title, W / 2, 120 + (1 - fadeIn(lt, .3, .8)) * 30, op, .5, 0);
  };
});

// 1 — Substantiva
addScene('Substantiva', 13, { y: 3.4, z: 15.5, ly: 0.15 }, (g) => {
  const p = block('Espero', 'slate', { socket: true }); const q = piece('[que] você venha', 'blue');
  const [xp, xq] = duo(p, q, 0, 1, .06);
  setBase(p, xp, yb(p)); setBase(q, xq, yb(q));
  const gh = ghost(q); setBase(gh, xq, yb(q));
  const r = ring(HEX.blue);
  g.add(p, q, gh, r);
  const hand = el('hand', 'o quê?');
  const lp = el('tag', 'Oração principal');
  const lq = el('tag sub', 'Oração subordinada substantiva<small>objeto direto de “espero”</small>');
  return (lt) => {
    pop(p, lt, .5);
    rest(gh); gh.visible = lt > 1.5 && lt < 6.4;
    gh.userData.mat.opacity = (.1 + .12 * (.5 + .5 * Math.sin(lt * 5))) * fadeIn(lt, 1.5, .5) * (1 - P(lt, 5.6, 6.4));
    flyIn(q, lt, 4.6, 1.8, [6, 5, 2.5]);
    pulse(p, lt, 6.4); pulse(q, lt, 6.4);
    ringFx(r, lt, 6.35, new THREE.Vector3(xp + p.userData.w / 2, yb(p), .6));
    const [hx, hy] = scr(gh, 0, BH / 2 + .25);
    place(hand, hx, hy, win(lt, 2.2, 5.4), .5, 1, 1 + .04 * Math.sin(lt * 4));
    const [ax, ay] = scr(p, 0, -BH / 2 - .1); place(lp, ax, ay + 18, win(lt, 8.2, 12.8));
    const [bx, by] = scr(q, 0, -BH / 2 - .1); place(lq, bx, by + 18, win(lt, 8.5, 12.8));
  };
});

// 2 — Teste do ISSO
addScene('Teste do ISSO', 8, { y: 3.4, z: 15.5, ly: 0.15 }, (g) => {
  const p = block('Espero', 'slate', { socket: true }); const q = piece('[que] você venha', 'blue');
  const q2 = piece('[ISSO]', 'blue', { w: q.userData.w, size: .7 });
  const [xp, xq] = duo(p, q, 0, 1, .06);
  setBase(p, xp, yb(p)); setBase(q, xq, yb(q)); setBase(q2, xq, yb(q));
  g.add(p, q, q2);
  const ok = el('tag ok', '✔ “Espero isso.”<small>a frase continua perfeita</small>');
  return (lt) => {
    pop(p, lt, .3, .5); pop(q, lt, .45, .5); rest(q2); q2.visible = false;
    if (lt > 2.2) { rest(q); flip(q, q2, lt, 2.2, 1.2); }
    pulse(q2, lt, 3.4);
    const [x, y] = scr(q2, 0, BH / 2 + .2); place(ok, x, y - 10, win(lt, 3.6, 7.9), .5, 1);
  };
});

// 3 — Adverbial
addScene('Adverbial', 14, { y: 3.4, z: 16, ly: 0.15 }, (g) => {
  const b = block('O jogo foi adiado.', 'slate'); const b2 = block('o jogo foi adiado.', 'slate', { w: b.userData.w });
  const t = tag('[Como] choveu,', -1);
  const [xt, xb] = duo(t, b, 0, 1, .05);
  setBase(b, xb, yb(b)); setBase(b2, xb, yb(b));
  // pivô da etiqueta na borda direita (ponto de encaixe)
  const tp = new THREE.Group(); t.position.x = -t.userData.w / 2; tp.add(t); tp.userData = { ...t.userData };
  setBase(tp, xt + t.userData.w / 2, yb(t));
  const r = ring(HEX.orange);
  g.add(b, b2, tp, r);
  const ok = el('tag ok', '✔ já é uma frase completa');
  const qs = ['quando?', 'por quê?', 'em que condição?'].map(s => el('q', s));
  const lt1 = el('tag adv', 'Oração subordinada adverbial<small>circunstância de causa</small>');
  const lb = el('tag', 'Oração principal');
  return (lt) => {
    pop(b, lt, .5); b2.visible = false;
    if (lt > 6.8) { rest(b2); b.visible = false; pulse(b2, lt, 6.8); }
    flyIn(tp, lt, 5.0, 1.8, [-7, 3.5, 1.5], [0, .6, .9]);
    if (lt > 6.8) tp.rotation.z = Math.sin((lt - 6.8) * 7) * .16 * Math.exp(-(lt - 6.8) * 2.2);
    ringFx(r, lt, 6.75, new THREE.Vector3(xb - b.userData.w / 2, yb(b), .6));
    const [ox, oy] = scr(b, 0, BH / 2 + .2); place(ok, ox, oy - 10, win(lt, 1.6, 4.8), .5, 1);
    const pos = [[-1.2, 2.6], [1.6, 2.9], [4.2, 2.45]];
    qs.forEach((d, i) => { const [x, y] = scr(b, pos[i][0] - 1.5, pos[i][1] - .4); place(d, x, y + Math.sin(lt * 2 + i) * 6, win(lt, 2.8 + i * .4, 6.6)); });
    const [ax, ay] = scr(t, 0, -BH / 2 - .1); place(lt1, ax, ay + 18, win(lt, 8.2, 13.8));
    const [cx, cy] = scr(b, 0, -BH / 2 - .1); place(lb, cx, cy + 18, win(lt, 8.5, 13.8));
  };
});

// 4 — Teste do advérbio + mobilidade
addScene('Teste do advérbio', 9, { y: 3.4, z: 16.5, ly: 0.15 }, (g) => {
  const t = tag('[Se] estudar,', -1); const tN = tag('[Nesse caso],', -1, { w: t.userData.w });
  const b = block('você passará.', 'slate');
  const b3 = block('Você passará', 'slate'); const t3 = tag('[se] estudar.', 1);
  const [xt, xb] = duo(t, b, 0, 1, .05);
  const [xb3, xt3] = duo(b3, t3, 0, 1, .05);
  setBase(t, xt, yb(t)); setBase(tN, xt, yb(t)); setBase(b, xb, yb(b)); setBase(b3, xb3, yb(b)); setBase(t3, xt3, yb(t));
  g.add(t, tN, b, b3, t3);
  const ok = el('tag ok', '✔ “Nesse caso, você passará.”');
  return (lt) => {
    pop(t, lt, .3, .5); pop(b, lt, .45, .5); tN.visible = b3.visible = t3.visible = false;
    if (lt > 2.0 && lt < 5.8) { rest(t); rest(tN); flip(t, tN, lt, 2.0, 1.1); if (lt > 4.5) { rest(tN); rest(t); flip(tN, t, lt, 4.5, 1.1); } }
    if (lt >= 5.8) {
      const p = eIO(P(lt, 5.8, 7.6)), arc = Math.sin(p * Math.PI) * 2.2;
      const tt = p < .5 ? t : t3; t.visible = p < .5; t3.visible = p >= .5;
      tt.position.set(lerp(xt, xt3, p), yb(t) + arc, Math.sin(p * Math.PI) * 1.2); tt.scale.setScalar(1);
      tt.rotation.set(0, p < .5 ? p * Math.PI : (p - 1) * Math.PI, 0);
      const bb = p < .5 ? b : b3; b.visible = p < .5; b3.visible = p >= .5;
      bb.position.set(lerp(xb, xb3, p), yb(b), 0); bb.rotation.set(0, 0, 0); bb.scale.setScalar(1);
      pulse(b3, lt, 6.7);
    }
    const [x, y] = scr(b, -b.userData.w / 2, BH / 2 + .2); place(ok, x, y - 10, win(lt, 3.1, 4.5), .5, 1);
  };
});

// 5 — Teste da retirada
addScene('Teste da retirada', 10, { y: 3.6, z: 19, ly: 0.2 }, (g) => {
  const S = .7;
  const p = block('Espero', 'slate', { socket: true }); const q = piece('[que] você venha', 'blue');
  const t = tag('[Como] choveu,', -1); const b = block('o jogo foi adiado.', 'slate'); const b2 = block('O jogo foi adiado.', 'slate', { w: b.userData.w });
  const [xp, xq] = duo(p, q, -4.7, S, .06 / S); const [xt, xb] = duo(t, b, 4.4, S, .05 / S);
  setBase(p, xp, yb(p, S), 0, S); setBase(q, xq, yb(q, S), 0, S); setBase(t, xt, yb(t, S), 0, S); setBase(b, xb, yb(b, S), 0, S); setBase(b2, xb, yb(b, S), 0, S);
  g.add(p, q, t, b, b2);
  const bad = el('tag bad', '✖ “Espero…” o quê?<small>ficou incompleta → SUBSTANTIVA</small>');
  const ok = el('tag ok', '✔ “O jogo foi adiado.”<small>continua completa → ADVERBIAL</small>');
  return (lt) => {
    pop(p, lt, .3, .5); pop(q, lt, .4, .5); pop(t, lt, .5, .5); pop(b, lt, .6, .5); b2.visible = false;
    if (lt > 2.4) { rest(q); flyOut(q, lt, 2.4, 1.1, [3, 6, 2]); rest(t); flyOut(t, lt, 2.6, 1.1, [-3, 6, 2], [.4, -.8, .6]); }
    if (lt > 3.5) { b.visible = false; rest(b2); pulse(b2, lt, 3.5); }
    const [x1, y1] = scr(p, 0, BH / 2 + .25); place(bad, x1, y1 - 8, win(lt, 3.9, 9.9), .5, 1);
    const [x2, y2] = scr(b2, 0, BH / 2 + .25); place(ok, x2, y2 - 8, win(lt, 4.2, 9.9), .5, 1);
  };
});

// 6/7 — Pegadinhas
function trap(name, word, mkL, mkR, labelL, labelR) {
  addScene(name, 9, { y: 3.7, z: 19, ly: 0.55 }, (g) => {
    const S = .66;
    const c = coin(word); setBase(c, 0, 1.6, .4);
    const [l1, l2] = mkL(); const [r1, r2] = mkR();
    const [a1, a2] = duo(l1, l2, -4.55, S, .06 / S); const [c1, c2] = duo(r1, r2, 4.55, S, .05 / S);
    for (const [o, x] of [[l1, a1], [l2, a2], [r1, c1], [r2, c2]]) setBase(o, x, yb(o, S), 0, S);
    g.add(c, l1, l2, r1, r2);
    const LL = el('tag sub', labelL), LR = el('tag adv', labelR);
    return (lt) => {
      pop(c, lt, .3, .7);
      c.rotation.y = eOut(P(lt, .3, 2.2)) * Math.PI * 4;
      const m = eIO(P(lt, 2.2, 3.0));
      c.position.set(0, lerp(1.6, 3.55, m), .4); c.scale.setScalar(lerp(1, .5, m) * (lt < 1 ? Math.max(.001, eBack(P(lt, .3, 1))) : 1));
      pop(l1, lt, 2.5, .5); pop(l2, lt, 2.65, .5); pop(r1, lt, 2.9, .5); pop(r2, lt, 3.05, .5);
      const [x1, y1] = scr(l1, l1.userData.w / 2, -BH / 2 - .15); place(LL, x1, y1 + 16, win(lt, 4.0, 9.0));
      const [x2, y2] = scr(r1, r1.userData.w / 2, -BH / 2 - .15); place(LR, x2, y2 + 16, win(lt, 4.3, 9.0));
    };
  });
}
trap('Pegadinha: SE', 'SE',
  () => [block('Não sei', 'slate', { socket: true }), piece('[se] ele vem.', 'blue')],
  () => [tag('[Se] ele vier,', -1), block('sairemos.', 'slate')],
  'Substantiva objetiva direta<small>“Não sei isso.”</small>', 'Adverbial condicional<small>“Nesse caso, sairemos.”</small>');
trap('Pegadinha: QUE', 'QUE',
  () => [block('Ele disse', 'slate', { socket: true }), piece('[que] estava cansado.', 'blue')],
  () => [block('Estava [tão] cansado', 'slate'), tag('[que] dormiu.', 1)],
  'Substantiva objetiva direta<small>“Ele disse isso.”</small>', 'Adverbial consecutiva<small>tão … que = consequência</small>');

// 8 — Questão Fuvest
addScene('Questão Fuvest', 18, { y: 3.2, z: 16, ly: 1.75, lx: 4.0 }, (g) => {
  const txt = '“Era tal a serenidade|da tarde, que se percebia|o sino de uma freguesia|distante, dobrando a finados.”';
  const txtH = '“Era [tal] a serenidade|da tarde, [que] se percebia|o sino de uma freguesia|distante, dobrando a finados.”';
  const o = { size: .44, h: 3.5, w: 8.2, d: .45 };
  const bd = block(txt, 'slate', o), bd2 = block(txtH, 'slate', o);
  setBase(bd, .55, 1.9); setBase(bd2, .55, 1.9);
  g.add(bd, bd2);
  const head = el('', `<span class="chip test">Questão de vestibular · Fuvest</span><div class="enun">No período abaixo, a segunda oração é:</div>`); head.id = 'qhead';
  const alts = [
    ['a', 'subordinada adverbial causal'], ['b', 'subordinada adverbial consecutiva'], ['c', 'subordinada adverbial concessiva'],
    ['d', 'subordinada adverbial comparativa'], ['e', 'subordinada adverbial subjetiva']];
  const box = el('alts', alts.map(([k, s]) => `<div class="alt" data-k="${k}"><span><b>${k})</b>${s}</span><span class="note"></span></div>`).join(''));
  const rows = [...box.children];
  const hand = el('hand', 'tal … que = consequência');
  return (lt) => {
    pop(bd, lt, .8, .7); bd2.visible = false;
    if (lt > 6.0) { rest(bd2); bd.visible = false; pulse(bd2, lt, 6.0); }
    place(head, 96, 130, win(lt, .4, 17.9), 0, 0);
    place(box, 1110, 340, 1, 0, 0);
    rows.forEach((r, i) => {
      const op = fadeIn(lt, 2.0 + i * .35, .4) * (1 - P(lt, 17.5, 17.9));
      const dim = (lt > 9.0 && ['a', 'c', 'd'].includes(alts[i][0])) || (lt > 11.5 && alts[i][0] === 'e');
      r.style.opacity = op * (dim ? .35 : 1); r.style.transform = `translateX(${(1 - fadeIn(lt, 2.0 + i * .35, .4)) * 40}px)`;
      const k = alts[i][0];
      r.classList.toggle('dim', lt > 9.0 && ['a', 'c', 'd'].includes(k) || lt > 11.5 && k === 'e');
      r.classList.toggle('trap', lt > 9.0 && lt < 11.5 && k === 'e');
      r.classList.toggle('right', lt > 11.5 && k === 'b');
      r.lastChild.textContent = k === 'e' && lt > 9.0 && lt < 11.5 ? 'é de substantiva!' : (k === 'b' && lt > 11.5 ? '✔ resposta' : '');
      r.lastChild.style.color = k === 'b' ? HEX.orange : '';
    });
    
  };
});

// 9 — Resumo
addScene('Resumo', 9, { y: 3.0, z: 16.5, ly: 2.2 }, (g) => {
  const pz = piece('completa', 'blue'); const tg = tag('circunstância', -1);
  const ck = clock();
  setBase(pz, -3.9, yb(pz) + .3); setBase(tg, 3.9, yb(tg) + .3); setBase(ck, 4.6, 2.75, .1, .7);
  g.add(pz, tg, ck);
  const head = el('', `<div class="eb">Resumindo</div>`); head.id = 'title';
  head.querySelector('.eb').style.fontSize = '30px';
  const L = el('tag sub', 'SUBSTANTIVA<small>completa a principal · vira “isso”</small>');
  const R = el('tag adv', 'ADVERBIAL<small>acrescenta circunstância · vira advérbio</small>');
  const tests = el('tests', ['troque por “isso”', 'que pergunta responde?', 'retire e veja o que sobra'].map((s, i) => `<div class="test"><span class="n">${i + 1}</span>${s}</div>`).join(''));
  return (lt) => {
    pop(pz, lt, .5); pop(tg, lt, .7); pop(ck, lt, 1.0, .6);
    const f = Math.sin(lt * 1.6) * .07; pz.position.y += f; tg.position.y -= f;
    ck.userData.mn.rotation.z = -lt * 2.2; ck.userData.hr.rotation.z = -lt * .3;
    place(head, W / 2, 130, win(lt, .3, 8.9), .5, 0);
    const [x1, y1] = scr(pz, 0, -BH / 2 - .15); place(L, x1, y1 + 16, win(lt, 1.6, 8.9));
    const [x2, y2] = scr(tg, 0, -BH / 2 - .15); place(R, x2, y2 + 16, win(lt, 1.9, 8.9));
    place(tests, W / 2, 930, win(lt, 3.0, 8.9), .5, 0);
  };
});

// ---------- captions ----------
const CAPS = {
  'Substantiva': [[.6, 4.4, 'pri', 'Oração principal', '“<b>Espero…</b>” o quê? Sozinha, esta oração está <b>incompleta</b>.'],
  [4.6, 12.8, 'sub', 'Oração substantiva', 'A <b>substantiva</b> é a peça que faltava: ela <b>completa</b> a principal, como um substantivo faria.']],
  'Teste do ISSO': [[.4, 3.4, 'test', 'Teste 1 · troque por “isso”', 'Se a oração puder virar <b>isso</b>, ela é <b>substantiva</b>.'],
  [3.6, 7.8, 'ok', 'Funcionou', '“Espero <b>isso</b>.” → oração <b>substantiva objetiva direta</b>.']],
  'Adverbial': [[.6, 4.8, 'pri', 'Oração principal', '“O jogo foi adiado.” Esta frase <b>já está completa</b>.'],
  [5.0, 13.8, 'adv', 'Oração adverbial', 'A <b>adverbial</b> é uma etiqueta: acrescenta uma <b>circunstância</b> (tempo, causa, condição…). Aqui, a <b>causa</b>.']],
  'Teste do advérbio': [[.4, 5.6, 'test', 'Teste 2 · troque por um advérbio', 'A adverbial aceita um <b>advérbio</b> no lugar: “<b>Nesse caso</b>, você passará.”'],
  [5.8, 8.8, 'adv', 'Bônus · mobilidade', 'Ela costuma <b>mudar de lugar</b>: “Se estudar, você passará” = “Você passará se estudar.”']],
  'Teste da retirada': [[.4, 3.7, 'test', 'Teste 3 · retire a subordinada', 'Tire a oração subordinada e veja o que sobra.'],
  [3.9, 9.8, 'test', 'Teste 3 · retire a subordinada', 'Faltou algo? É <b>substantiva</b>. Sobrou uma frase completa? É <b>adverbial</b>.']],
  'Pegadinha: SE': [[.4, 3.7, 'test', 'Pegadinha', 'A mesma palavra pode abrir orações diferentes. Olhe o <b>se</b>:'],
  [3.9, 8.8, 'test', 'Pegadinha', '“Não sei <b>isso</b>” → <b>substantiva</b>. “<b>Nesse caso</b>, sairemos” → <b>adverbial condicional</b>.']],
  'Pegadinha: QUE': [[.4, 3.7, 'test', 'Pegadinha', 'E o <b>que</b>? Ele também pode abrir os dois tipos.'],
  [3.9, 8.8, 'test', 'Pegadinha', '“Ele disse <b>isso</b>” → <b>substantiva</b>. “<b>tão</b> cansado <b>que</b> dormiu” → <b>adverbial consecutiva</b>.']],
  'Questão Fuvest': [[.6, 5.8, 'test', 'Questão Fuvest', 'Que tipo de oração é “<b>que se percebia o sino…</b>”?'],
  [6.0, 11.3, 'test', 'Pista', 'O par <b>tal … que</b> indica <b>consequência</b>. E cuidado: “subjetiva” é tipo de <b>substantiva</b>!'],
  [11.5, 17.8, 'ok', 'Resposta: b', 'A tarde era tão serena que, <b>como consequência</b>, ouvia-se o sino → <b>adverbial consecutiva</b>.']],
};
const cap = el('', ''); cap.id = 'cap'; let capKey = '';
const chap = el('', ''); chap.id = 'chap'; let chapKey = '';

// ---------- build ----------
let TOTAL = 0;
function build() {
  let s = 0;
  scenes.forEach((sc, i) => {
    sc.start = s; sc.end = s + sc.dur; s = sc.end;
    sc.X = i * SPACING;
    sc.group = new THREE.Group(); sc.group.position.x = sc.X; scene.add(sc.group);
    sc.update = sc.build(sc.group);
  });
  TOTAL = s;
}
function view(i, end) {
  const sc = scenes[i], c = sc.cam;
  return { px: sc.X + (c.lx || 0) * 0 + (end ? .35 : 0) + (c.lx || 0), py: c.y, pz: c.z - (end ? .9 : 0), lx: sc.X + (c.lx || 0), ly: c.ly };
}
function camAt(t) {
  for (let i = 0; i < scenes.length - 1; i++) {
    const b = scenes[i].end;
    if (t >= b - .75 && t <= b + .45) {
      const p = eIO(P(t, b - .75, b + .45)), A = view(i, true), B = view(i + 1, false);
      return { px: lerp(A.px, B.px, p), py: lerp(A.py, B.py, p) + Math.sin(p * Math.PI) * 1.4, pz: lerp(A.pz, B.pz, p) + Math.sin(p * Math.PI) * 1.5, lx: lerp(A.lx, B.lx, p), ly: lerp(A.ly, B.ly, p) };
    }
  }
  const i = Math.max(0, scenes.findIndex(sc => t < sc.end)); const sc = scenes[i === -1 ? scenes.length - 1 : i];
  const k = i === -1 ? scenes.length - 1 : i;
  const p = P(t, sc.start, sc.end), A = view(k, false), B = view(k, true);
  return { px: lerp(A.px, B.px, p), py: lerp(A.py, B.py, p), pz: lerp(A.pz, B.pz, p), lx: lerp(A.lx, B.lx, p), ly: lerp(A.ly, B.ly, p) };
}

function renderAt(t) {
  for (const d of els) d.style.opacity = 0;
  const c = camAt(t);
  camera.position.set(c.px, c.py, c.pz); camera.lookAt(c.lx, c.ly, 0); camera.updateMatrixWorld();
  sun.position.set(c.lx - 7, 13, 11); sun.target.position.set(c.lx, 0, 0); sun.target.updateMatrixWorld();
  let cur = 0;
  scenes.forEach((sc, i) => {
    const vis = t > sc.start - 1.3 && t < sc.end + 1.3;
    sc.group.visible = vis;
    if (t >= sc.start && t < sc.end) cur = i;
    if (vis) {
      const lt = t - sc.start;
      // cenas fora do próprio tempo: congelar no estado de entrada/saída
      sc.update(clamp(lt, 0, sc.dur - .001) * sc.sp);
      if (!(t >= sc.start && t < sc.end)) {
        // esconder overlays das cenas vizinhas
      }
    }
  });
  if (t >= TOTAL) cur = scenes.length - 1;
  // overlays só da cena atual: reaplicar a atual por último
  for (const d of els) d.style.opacity = 0;
  const sc = scenes[cur]; sc.update(clamp(t - sc.start, 0, sc.dur - .001) * sc.sp);
  // caption
  const lt = (t - sc.start) * sc.sp, list = CAPS[sc.name] || [];
  const a = list.find(x => lt >= x[0] && lt <= x[1]);
  if (a) {
    const key = sc.name + a[0];
    if (key !== capKey) { cap.innerHTML = `<span class="chip ${a[2]}">${a[3]}</span><div class="txt">${a[4]}</div>`; capKey = key; }
    const op = win(lt, a[0], a[1], .35);
    cap.style.opacity = op; cap.style.transform = `translateY(${(1 - op) * 18}px)`;
    cap.style.left = '96px'; cap.style.top = 'auto';
  }
  // chapter
  if (cur > 0 && sc.name !== 'Questão Fuvest') {
    const key = 'c' + cur;
    if (key !== chapKey) {
      chap.innerHTML = `<span class="bar">${scenes.slice(1).map((_, i) => `<i class="${i + 1 <= cur ? 'on' : ''}"></i>`).join('')}</span><span>${sc.name}</span>`; chapKey = key;
    }
    chap.style.opacity = win(lt, .2, sc.odur, .3); chap.style.transform = 'none';
  }
  document.getElementById('fade').style.opacity = Math.max(1 - P(t, 0, .7), P(t, TOTAL - .9, TOTAL));
  renderer.render(scene, camera);
}

(async () => {
  await Promise.all(['800 40px Bricolage', '700 40px Bricolage', '400 40px Bricolage', '400 20px Atkinson', '700 20px Atkinson', '700 20px Caveat'].map(f => document.fonts.load(f)));
  build();
  window.TOTAL = TOTAL;
  window.renderAt = renderAt;
  renderAt(0);
  window.READY = true;
})();
