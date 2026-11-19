/* Rothbard cover animation: chairs ride the real cable curves (in from the left edge,
   past both towers, out the right edge) and the high clouds drift slowly.
   Mounts into any [data-cover-anim] element while the cover is on screen; stops when the
   cover unmounts, pauses when the tab is hidden. The still cover-alps-wide.jpg underneath stays
   as the fallback (before load, on error, and with prefers-reduced-motion). */
(function () {
  if (window.__rcCoverAnim) return; window.__rcCoverAnim = true;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var BASE = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^\/]*$/, '') : './assets/cover-anim/';
  var SCENE = null, scenePromise = null;
  var mount = null;            // { host, stage, sky, chairs, ro }
  var raf = 0, last = 0, T = 0; // T: running animation time (s), only advances while visible

  function poly(c, x) { return ((c[0] * x + c[1]) * x + c[2]) * x + c[3]; }
  function dpoly(c, x) { return (3 * c[0] * x + 2 * c[1]) * x + c[2]; }

  function loadScene() {
    if (!scenePromise) scenePromise = fetch(BASE + 'scene.json?v=4').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (S) { SCENE = buildLines(S); return SCENE; });
    return scenePromise;
  }

  function buildLines(S) {
    var EX = S.EX || 0, XJ = 1480, XR = 1926, XA = -EX - 78, XB = 1926 + EX + 92;
    var lines = {
      C: { k0: 76 / 93, kb: 0.02623 / 93, kx: 55, kR: 1.60, yR: 410.7, sR: -0.02, dir: -1, start: 970 },
      B: { k0: 1, kb: 0.02623 / 93, kx: 370, kR: 1.72, yR: 356.1, sR: -0.06, dir: 1, start: 370 }
    };
    Object.keys(lines).forEach(function (name) {
      var L = lines[name], c = S.cab[name];
      var y0 = poly(c, XJ) + 0.7, s0 = dpoly(c, XJ), h = XR - XJ;
      var kJ = L.k0 + (XJ - L.kx) * L.kb, kslope = (L.kR - kJ) / h;
      L.y = function (x) {
        if (x <= XJ) return poly(c, x) + 0.7;
        if (x >= XR) return L.yR + L.sR * (x - XR);
        var t = (x - XJ) / h, t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * s0 + (-2 * t3 + 3 * t2) * L.yR + (t3 - t2) * h * L.sR;
      };
      L.k = function (x) { return x <= XJ ? L.k0 + (x - L.kx) * L.kb : x >= XR ? L.kR : kJ + (x - XJ) * kslope; };
      var step = 0.5, n = Math.ceil((XB - XA) / step) + 1, U = new Float64Array(n);
      for (var i = 1; i < n; i++) U[i] = U[i - 1] + step / L.k(XA + (i - 0.5) * step);
      L.len = U[n - 1];
      L.uOfX = function (x) { var f = (x - XA) / step, i = Math.min(n - 2, Math.max(0, Math.floor(f))); return U[i] + (U[i + 1] - U[i]) * (f - i); };
      L.xOfU = function (u) {
        var lo = 0, hi = n - 1;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (U[mid] <= u) lo = mid; else hi = mid; }
        return XA + (lo + (u - U[lo]) / (U[hi] - U[lo])) * step;
      };
      L.sOfX = function (x) { return L.dir > 0 ? L.uOfX(x) : L.len - L.uOfX(x); };
      L.xOfS = function (s) { return L.dir > 0 ? L.xOfU(s) : L.xOfU(L.len - s); };
      L.s0 = L.sOfX(L.start); L.tone = S.tone[name]; L.park = L.dir > 0 ? XB : XA;
    });
    var spacing = lines.C.uOfX(970) - lines.C.uOfX(55);
    Object.keys(lines).forEach(function (name) { var L = lines[name]; L.n = Math.ceil(L.len / spacing); L.loop = L.n * spacing; });
    return { S: S, lines: lines, spacing: spacing };
  }

  function el(tag, css, attrs) {
    var e = document.createElement(tag); if (css) e.style.cssText = css;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  var ABS = 'position:absolute;left:0;top:0;display:block;max-width:none;pointer-events:none;user-select:none;';

  function build(host) {
    var S = SCENE.S, SP = S.sprite;
    var TOPX = S.TOPX || 0, HE = S.HE || S.H, EX = S.EX || 0, WE = S.WE || S.W;
    var stage = el('div', 'position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;width:' + WE + 'px;height:' + HE + 'px;');
    var imgs = [];
    function img(src, css, w, h) { var i = el('img', ABS + (css || ''), { alt: '', src: BASE + src + '?v=4', decoding: 'async' }); if (w) { i.width = w; i.height = h; } imgs.push(i); return i; }
    // plate + drifting sky are in extended-canvas coords (photo starts at y=TOPX)
    stage.appendChild(img('cover-alps-plate.jpg', '', WE, HE));
    var sky = img('sky-drift.webp', 'left:' + (-S.PAD) + 'px;will-change:transform;');
    stage.appendChild(sky);
    var inner = el('div', 'position:absolute;left:' + EX + 'px;top:' + TOPX + 'px;width:' + S.W + 'px;height:' + S.H + 'px;');
    stage.appendChild(inner);
    inner.appendChild(img('sky-static.webp'));
    // chairs + tower occluder are drawn as vectors on a device-pixel canvas above the stage (crisp at any scale)
    var occImg = img('tower-occluder.png');
    var chairs = [];
    Object.keys(SCENE.lines).forEach(function (name) {
      var L = SCENE.lines[name];
      for (var i = 0; i < L.n; i++) chairs.push({ L: L, off: i * SCENE.spacing, ph: (chairs.length * 2.399) % 6.283 });
    });
    var cv = el('canvas', 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;');
    var wrap = el('div', 'position:absolute;inset:0;overflow:hidden;opacity:0;transition:opacity .6s ease;');
    wrap.appendChild(stage); wrap.appendChild(cv); host.appendChild(wrap);
    var m = { host: host, wrap: wrap, stage: stage, sky: sky, chairs: chairs, cv: cv, ctx: cv.getContext('2d'), occ: occImg, ready: false };
    m.layout = function () {
      var W = host.clientWidth, H = host.clientHeight; if (!W || !H) return;
      // Up to 16:10 this is cover-fit of the photo width; wider screens keep the 16:10 vertical framing
      // (1204 rows) and reveal the side extensions, up to the full canvas width (~2.4:1). Same formula as the
      // CSS on cover-alps-wide.jpg.
      var s = Math.max(Math.min(W / S.W, H / 1204), H / HE, W / WE);
      var left = (W - WE * s) * 0.5, top = (H - HE * s) * 0.12;
      stage.style.transform = 'translate(' + left + 'px,' + top + 'px) scale(' + s + ')';
      var dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      m.view = { W: W, H: H, s: s, dpr: dpr, ox: left + (EX * s), oy: top + (TOPX * s) };
      if (m.ready || m.t0 !== undefined) frame(m, T);
    };
    m.ro = window.ResizeObserver ? new ResizeObserver(m.layout) : null;
    if (m.ro) m.ro.observe(host); else window.addEventListener('resize', m.layout);
    m.layout(); frame(m, T);
    Promise.all(imgs.map(function (i) { return i.decode ? i.decode() : Promise.resolve(); })).then(function () {
      if (mount !== m) return;
      m.ready = true; wrap.style.opacity = '1'; start();
    }, function () { teardown(); });   // any asset failure: leave the still photo
    return m;
  }

  function toneAt(Tn, x) {
    if (x > 1380) return 1;
    var f = (x - Tn.x0) / Tn.dx, i = Math.floor(f), w = Tn.w;
    if (i < 0) return w[0]; if (i >= w.length - 1) return w[w.length - 1];
    var t = f - i; return w[i] * (1 - t) + w[i + 1] * t;
  }

  // ---- vector chair (classic quad chairlift), sprite units = image px at scale 1, origin at the cable grip ----
  var GX = 43, GY = 17.2;
  function P(d) { return new Path2D(d); }
  var CH = {
    rails:  P('M22.5 77.5 L80.5 71.2 M23 82 L81.5 76'),                                   // backrest slats
    frame:  P('M22 86 L21.2 63.5 Q21 58.2 26.8 57.6 L73.2 53.6 Q79.2 53.2 79.8 58.6 L81.6 81.6'),  // backrest/arm frame
    plate:  P('M31 57.2 L68.5 54'),                                                       // top cross-beam
    hanger: P('M43 19 L43.4 41 Q43.8 50.6 49.6 53.9'),
    seatTop: P('M23.2 86.2 L82.2 81.4 L84.6 84 L25.4 89.2 Z'),
    seatFront: P('M25.4 89.2 L84.6 84 L84.6 86.9 L25.6 92.3 Z'),
    slats:  P('M38.2 85 L40.3 88 M53 83.8 L55.1 86.7 M67.8 82.6 L69.9 85.4'),
    bar:    P('M27.2 86.6 L27.6 74.8 Q28 71 31.6 70.6 L80.6 66.2 Q84.2 66 84.6 69.6 L85.8 93.2'), // safety bar, down to the footrest
    foot:   P('M36.4 95.2 L36.8 97.8 L85.8 93.2'),                                        // footrest, hung off the bar
    grip:   P('M-6.2 -1.6 Q-6.2 -3.4 -4.4 -3.4 L4.4 -3.4 Q6.2 -3.4 6.2 -1.6 L6.2 2 Q6.2 3.8 4.4 3.8 L-4.4 3.8 Q-6.2 3.8 -6.2 2 Z'),
    wheels: P('M-3.3 -3.5 m-1.9 0 a1.9 1.9 0 1 0 3.8 0 a1.9 1.9 0 1 0 -3.8 0 M3.3 -3.5 m-1.9 0 a1.9 1.9 0 1 0 3.8 0 a1.9 1.9 0 1 0 -3.8 0')
  };
  // colours: light (over forest) -> dark (backlit against the sky), mixed by the background tone w
  var LT = { metal: [196, 200, 203], line: [92, 97, 102], seat: [150, 155, 160], front: [96, 101, 106], grip: [44, 46, 49] };
  var DK = { metal: [52, 55, 59], line: [30, 32, 35], seat: [66, 69, 73], front: [36, 38, 41], grip: [28, 29, 31] };
  var HAZE = [150, 172, 200], HZ = 0;                 // far (small) chairs pick up a little atmospheric haze
  function mix(a, b, w) {
    var r = a[0] + (b[0] - a[0]) * w, gg = a[1] + (b[1] - a[1]) * w, bb = a[2] + (b[2] - a[2]) * w;
    r += (HAZE[0] - r) * HZ; gg += (HAZE[1] - gg) * HZ; bb += (HAZE[2] - bb) * HZ;
    return 'rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(bb) + ')';
  }

  function drawChair(g, w) {
    var metal = mix(LT.metal, DK.metal, w), line = mix(LT.line, DK.line, w);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // soft edge so it sits in the photo instead of looking pasted on
    g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 3.4;
    g.stroke(CH.frame); g.stroke(CH.hanger); g.stroke(CH.bar); g.stroke(CH.seatFront); g.stroke(CH.foot);
    function tube(path, wd) {
      g.strokeStyle = line; g.lineWidth = wd + 0.9; g.stroke(path); g.strokeStyle = metal; g.lineWidth = wd; g.stroke(path);
      g.save(); g.translate(-0.25 * wd, -0.3 * wd); g.strokeStyle = hi; g.lineWidth = wd * 0.32; g.stroke(path); g.restore();   // tube sheen
    }
    var hi = 'rgba(255,255,255,' + (0.38 - 0.26 * w).toFixed(3) + ')';
    tube(CH.rails, 1.1);
    tube(CH.frame, 1.7);
    g.strokeStyle = line; g.lineWidth = 3.6; g.stroke(CH.plate); g.strokeStyle = metal; g.lineWidth = 2.6; g.stroke(CH.plate);
    tube(CH.hanger, 2.0);
    g.fillStyle = mix(LT.seat, DK.seat, w); g.fill(CH.seatTop);
    g.fillStyle = mix(LT.front, DK.front, w); g.fill(CH.seatFront);
    g.strokeStyle = line; g.lineWidth = 0.7; g.stroke(CH.seatTop); g.stroke(CH.seatFront); g.stroke(CH.slats);
    tube(CH.bar, 1.4);
    tube(CH.foot, 1.3);
  }
  function drawGrip(g, w) {
    g.fillStyle = mix(LT.grip, DK.grip, w); g.fill(CH.wheels); g.fill(CH.grip);
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.5; g.stroke(CH.grip);
  }

  function frame(m, t) {
    m.t0 = t;
    var dx = 27 * Math.sin(2 * Math.PI * t / 233) + 10 * Math.sin(2 * Math.PI * t / 97 + 1.3);
    m.sky.style.transform = 'translate3d(' + dx.toFixed(3) + 'px,0,0)';
    var v = m.view, g = m.ctx; if (!v) return;
    var S = SCENE.S, a = v.dpr * v.s;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, m.cv.width, m.cv.height);
    var x0 = -v.ox / v.s - 120, x1 = (v.W - v.ox) / v.s + 120;     // visible range in photo coords
    for (var i = 0; i < m.chairs.length; i++) {
      var c = m.chairs[i], L = c.L;
      var s = (L.s0 + c.off + 6.0 * t) % L.loop; if (s < 0) s += L.loop;
      c.sx = null; if (s > L.len) continue;                     // parked off-image
      var x = L.xOfS(s); if (x < x0 || x > x1) continue;
      var k = L.k(x), sway = 0.006 * Math.sin(2 * Math.PI * t / 5.3 + c.ph);  // ~0.35 deg pendulum
      g.setTransform(a, 0, 0, a, v.dpr * v.ox, v.dpr * v.oy);
      var y = L.y(x), w = toneAt(L.tone, x), ang = Math.atan((L.y(x + 1) - L.y(x - 1)) / 2);
      HZ = Math.max(0, Math.min(0.22, (1.15 - k) * 0.4)) * w;   // haze only reads against the sky
      g.translate(x, y);
      g.save(); g.rotate(sway); g.scale(k, k); g.translate(-GX, -GY); drawChair(g, w); g.restore();
      g.rotate(ang); g.scale(k, k); drawGrip(g, w);                  // the grip follows the rope's slope
      c.sx = v.ox + x * v.s; c.sy = v.oy + L.y(x) * v.s; c.sk = k * v.s;
    }
    g.setTransform(a, 0, 0, a, v.dpr * v.ox, v.dpr * v.oy);
    if (m.occ.complete && m.occ.naturalWidth) g.drawImage(m.occ, S.occ[0], S.occ[1]);
  }

  function tick(now) {
    raf = 0;
    if (!mount || !mount.host.isConnected) { teardown(); return; }
    T += Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    frame(mount, T);
    raf = requestAnimationFrame(tick);
  }
  function start() { if (raf || !mount || !mount.ready || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(tick); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function teardown() {
    stop();
    if (!mount) return;
    if (mount.ro) mount.ro.disconnect(); else window.removeEventListener('resize', mount.layout);
    if (mount.wrap.parentNode) mount.wrap.parentNode.removeChild(mount.wrap);
    mount = null;
  }

  function scan() {
    if (mount && !mount.host.isConnected) teardown();
    var host = document.querySelector('[data-cover-anim]');
    if (!host || (mount && mount.host === host)) return;
    if (mount) teardown();
    loadScene().then(function () {
      if (mount || !host.isConnected) return;
      mount = build(host);
    }, function () {});
  }

  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  var pending = false;
  new MutationObserver(function () {
    if (pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  window.__rcCoverSetT = function (t) { T = t; if (mount) frame(mount, T); };
  window.__rcCoverChairs = function () { return mount ? mount.chairs.filter(function (c) { return c.sx != null; }).map(function (c) { return [c.sx, c.sy, c.sk]; }) : []; };
  window.__rcCoverAnimState = function () { return { mounted: !!mount, ready: !!(mount && mount.ready), running: !!raf, t: T }; };
})();
