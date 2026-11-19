/* Rothbard cover animation: chairs ride the real cable curves (in from the left edge,
   past both towers, out the right edge) and the high clouds drift slowly.
   Mounts into any [data-cover-anim] element while the cover is on screen; stops when the
   cover unmounts, pauses when the tab is hidden. The still cover-alps.jpg underneath stays
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
    if (!scenePromise) scenePromise = fetch(BASE + 'scene.json').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (S) { SCENE = buildLines(S); return SCENE; });
    return scenePromise;
  }

  function buildLines(S) {
    var XJ = 1480, XR = 1926, XA = -140, XB = 2030;
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
      L.k = function (x) { return x <= XJ ? L.k0 + (x - L.kx) * L.kb : kJ + (x - XJ) * kslope; };
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
    var stage = el('div', 'position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;width:' + S.W + 'px;height:' + S.H + 'px;');
    var imgs = [];
    function img(src, css, w, h) { var i = el('img', ABS + (css || ''), { alt: '', src: BASE + src, decoding: 'async' }); if (w) { i.width = w; i.height = h; } imgs.push(i); return i; }
    stage.appendChild(img('cover-alps-plate.jpg', '', S.W, S.H));
    var sky = img('sky-drift.webp', 'left:' + (-S.PAD) + 'px;will-change:transform;');
    stage.appendChild(sky);
    stage.appendChild(img('sky-static.webp'));
    var chairsEl = el('div', 'position:absolute;left:0;top:0;');
    stage.appendChild(chairsEl);
    stage.appendChild(img('tower-occluder.png', 'left:' + S.occ[0] + 'px;top:' + S.occ[1] + 'px;'));
    var chairs = [];
    Object.keys(SCENE.lines).forEach(function (name) {
      var L = SCENE.lines[name];
      for (var i = 0; i < L.n; i++) {
        var d = el('div', 'position:absolute;left:0;top:0;width:0;height:0;will-change:transform;');
        var pos = 'left:' + (-SP.ax) + 'px;top:' + (-SP.ay) + 'px;';
        var a = img('chair-light.png', pos, SP.w, SP.h), b = img('chair-dark.png', pos, SP.w, SP.h);
        d.appendChild(a); d.appendChild(b); chairsEl.appendChild(d);
        chairs.push({ el: d, lt: a, dk: b, L: L, off: i * SCENE.spacing });
      }
    });
    var wrap = el('div', 'position:absolute;inset:0;overflow:hidden;opacity:0;transition:opacity .6s ease;');
    wrap.appendChild(stage); host.appendChild(wrap);
    var m = { host: host, wrap: wrap, stage: stage, sky: sky, chairs: chairs, ready: false };
    m.layout = function () {
      var W = host.clientWidth, H = host.clientHeight; if (!W || !H) return;
      var s = Math.max(W / S.W, H / S.H);
      stage.style.transform = 'translate(' + ((W - S.W * s) * 0.5) + 'px,' + ((H - S.H * s) * 0.12) + 'px) scale(' + s + ')';
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

  function frame(m, t) {
    var dx = 27 * Math.sin(2 * Math.PI * t / 233) + 10 * Math.sin(2 * Math.PI * t / 97 + 1.3);
    m.sky.style.transform = 'translate3d(' + dx.toFixed(3) + 'px,0,0)';
    for (var i = 0; i < m.chairs.length; i++) {
      var c = m.chairs[i], L = c.L;
      var s = (L.s0 + c.off + 6.0 * t) % L.loop; if (s < 0) s += L.loop;
      var x = s <= L.len ? L.xOfS(s) : L.park;
      c.el.style.transform = 'translate3d(' + x.toFixed(3) + 'px,' + L.y(x).toFixed(3) + 'px,0) scale(' + L.k(x).toFixed(5) + ')';
      var w = toneAt(L.tone, x);
      c.dk.style.opacity = Math.min(1, 2 * w).toFixed(3);
      c.lt.style.opacity = Math.min(1, 2 * (1 - w)).toFixed(3);
    }
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
  window.__rcCoverAnimState = function () { return { mounted: !!mount, ready: !!(mount && mount.ready), running: !!raf, t: T }; };
})();
