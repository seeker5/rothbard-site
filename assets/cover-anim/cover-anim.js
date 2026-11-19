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
    if (!scenePromise) scenePromise = fetch(BASE + 'scene.json?v=7').then(function (r) { if (!r.ok) throw 0; return r.json(); })
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
    function img(src, css, w, h) { var i = el('img', ABS + (css || ''), { alt: '', src: BASE + src + '?v=7', decoding: 'async' }); if (w) { i.width = w; i.height = h; } imgs.push(i); return i; }
    // plate + drifting sky are in extended-canvas coords (photo starts at y=TOPX)
    stage.appendChild(img('cover-alps-plate.jpg', '', WE, HE));
    var sky = img('sky-drift.webp', 'left:' + (-S.PAD) + 'px;will-change:transform;');
    stage.appendChild(sky);
    var inner = el('div', 'position:absolute;left:' + EX + 'px;top:' + TOPX + 'px;width:' + S.W + 'px;height:' + S.H + 'px;');
    stage.appendChild(inner);
    inner.appendChild(img('sky-static.webp'));
    // chairs + tower occluder are drawn as vectors on a device-pixel canvas above the stage (crisp at any scale)
    var occImg = img('tower-occluder.png');
    var spLt = img('chair-light.png'), spSk = img('chair-sky.png');
    var chairs = [];
    Object.keys(SCENE.lines).forEach(function (name) {
      var L = SCENE.lines[name];
      for (var i = 0; i < L.n; i++) chairs.push({ L: L, off: i * SCENE.spacing, ph: (chairs.length * 2.399) % 6.283 });
    });
    var cv = el('canvas', 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;');
    var wrap = el('div', 'position:absolute;inset:0;overflow:hidden;opacity:0;transition:opacity .6s ease;');
    wrap.appendChild(stage); wrap.appendChild(cv); host.appendChild(wrap);
    var m = { host: host, wrap: wrap, stage: stage, sky: sky, chairs: chairs, cv: cv, ctx: cv.getContext('2d'), occ: occImg, spLt: spLt, spSk: spSk, ready: false };
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
      m.sprites = null;   // re-resample for the new size
      if (m.ready || m.t0 !== undefined) frame(m, T);
    };
    m.ro = window.ResizeObserver ? new ResizeObserver(m.layout) : null;
    if (m.ro) m.ro.observe(host); else window.addEventListener('resize', m.layout);
    m.layout(); frame(m, T);
    Promise.all(imgs.map(function (i) { return i.decode ? i.decode() : Promise.resolve(); })).then(function () {
      if (mount !== m) return;
      m.ready = true; m.sprites = null; frame(m, T); wrap.style.opacity = '1'; start();
    }, function () { teardown(); });   // any asset failure: leave the still photo
    return m;
  }

  function toneAt(Tn, x) {
    if (x > 1380) return 1;
    var f = (x - Tn.x0) / Tn.dx, i = Math.floor(f), w = Tn.w;
    if (i < 0) return w[0]; if (i >= w.length - 1) return w[w.length - 1];
    var t = f - i; return w[i] * (1 - t) + w[i + 1] * t;
  }

  // ---- chairs: the original photo-cut sprites, one fixed size (the small far-left chairs, 0.77x),
  //      never upscaled: pre-resampled once per layout to the exact device-pixel size, then drawn 1:1 ----
  var KC = 0.77;
  function sprites(m) {
    var v = m.view, SP = SCENE.S.sprite;
    var d = Math.min(KC * v.s * v.dpr, 1);          // device px per sprite px (<= 1: downscale only)
    function make(im) {
      var c = document.createElement('canvas');
      c.width = Math.ceil(SP.w * d) + 2; c.height = Math.ceil(SP.h * d) + 2;
      var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      var src = im, sw = SP.w, sh = SP.h;
      while (sw * 0.5 >= SP.w * d) {                // halve in steps for clean large reductions
        var t = document.createElement('canvas'); t.width = Math.ceil(sw / 2); t.height = Math.ceil(sh / 2);
        var tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, sw, sh, 0, 0, t.width, t.height);
        src = t; sw = t.width; sh = t.height;
      }
      g.drawImage(src, 0, 0, sw, sh, 1, 1, SP.w * d, SP.h * d);
      return c;
    }
    // shade levels: forest look (photo cutout) -> backlit sky look (smooth near-black silhouette), mixed per pixel
    // in premultiplied space so the antialiased edges stay intact; picked by position, never two sprites at once
    var lt = make(m.spLt), sk = make(m.spSk), N = 32, lv = [];
    var W_ = lt.width, H_ = lt.height;
    try {
      var A = lt.getContext('2d').getImageData(0, 0, W_, H_).data, B = sk.getContext('2d').getImageData(0, 0, W_, H_).data;
      for (var j = 0; j <= N; j++) {
        var f = j / N, c = document.createElement('canvas'); c.width = W_; c.height = H_;
        var cg = c.getContext('2d'), id = cg.createImageData(W_, H_), o = id.data;
        for (var i = 0; i < o.length; i += 4) {
          var a1 = A[i + 3] / 255 * (1 - f), a2 = B[i + 3] / 255 * f, al = a1 + a2;
          if (al <= 0) continue;
          o[i] = (A[i] * a1 + B[i] * a2) / al; o[i + 1] = (A[i + 1] * a1 + B[i + 1] * a2) / al; o[i + 2] = (A[i + 2] * a1 + B[i + 2] * a2) / al;
          o[i + 3] = Math.min(255, al * 255);
        }
        cg.putImageData(id, 0, 0); lv.push(c);
      }
    } catch (e) { lv = [lt]; N = 0; }
    return { d: d, lv: lv, N: N, ax: SP.ax * d + 1, ay: SP.ay * d + 1 };
  }

  function frame(m, t) {
    m.t0 = t;
    var dx = 27 * Math.sin(2 * Math.PI * t / 233) + 10 * Math.sin(2 * Math.PI * t / 97 + 1.3);
    m.sky.style.transform = 'translate3d(' + dx.toFixed(3) + 'px,0,0)';
    var v = m.view, g = m.ctx; if (!v || !m.ready) return;   // sprites need decoded images
    var S = SCENE.S, a = v.dpr * v.s;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, m.cv.width, m.cv.height);
    var sp = m.sprites || (m.sprites = sprites(m)); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    var x0 = -v.ox / v.s - 120, x1 = (v.W - v.ox) / v.s + 120;     // visible range in photo coords
    for (var i = 0; i < m.chairs.length; i++) {
      var c = m.chairs[i], L = c.L;
      var s = (L.s0 + c.off + 3.0 * t) % L.loop; if (s < 0) s += L.loop;
      c.sx = null; if (s > L.len) continue;                     // parked off-image
      var x = L.xOfS(s); if (x < x0 || x > x1) continue;
      var y = L.y(x);
      var px = v.dpr * (v.ox + x * v.s) - sp.ax, py = v.dpr * (v.oy + y * v.s) - sp.ay;
      g.drawImage(sp.lv[Math.round(toneAt(L.tone, x) * sp.N)], px, py);
      c.sx = v.ox + x * v.s; c.sy = v.oy + y * v.s; c.sk = sp.d / v.dpr;
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
