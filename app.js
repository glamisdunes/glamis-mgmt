/* Glamis management site: unlock site.dat (AES-GCM, PBKDF2-SHA256) and show its pages in a sandboxed frame. */
(function () {
  'use strict';
  var K = 'gmgmt.key';
  var $ = function (id) { return document.getElementById(id); };
  var blob = null, pages = [], byId = {}, assets = {};

  function b64d(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function b64e(u) { var s = ''; u = new Uint8Array(u); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function sget() { try { return localStorage.getItem(K) || sessionStorage.getItem(K); } catch (e) { return null; } }
  function sset(v, keep) { try { (keep ? localStorage : sessionStorage).setItem(K, v); } catch (e) {} }
  function sdel() { try { localStorage.removeItem(K); sessionStorage.removeItem(K); } catch (e) {} }

  function derive(pw) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(blob.salt), iterations: blob.iter, hash: 'SHA-256' }, base, 256);
    });
  }
  function open(raw) {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.ct));
    }).then(function (gz) {
      return new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }).then(function (txt) { return JSON.parse(txt); });
  }

  function start(data) {
    pages = data.pages; byId = {}; assets = data.assets || {};
    var nav = $('nav'), groups = {}, order = [];
    pages.forEach(function (p) { byId[p.id] = p; if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); } groups[p.group].push(p); });
    nav.textContent = '';
    order.forEach(function (g) {
      var h = document.createElement('h2'); h.textContent = g; nav.appendChild(h);
      groups[g].forEach(function (p) {
        var a = document.createElement('a'); a.href = '#' + p.id; a.textContent = p.title; a.setAttribute('data-id', p.id); nav.appendChild(a);
      });
    });
    var b = document.createElement('p'); b.className = 'built'; b.textContent = 'Updated ' + data.built; nav.appendChild(b);
    $('lock').hidden = true; $('app').hidden = false;
    show();
  }

  function show() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    var p = byId[id] || pages[0];
    var html = p.html.replace(/@@asset:([a-z0-9]+)@@/g, function (m, k) { return assets[k] || ''; });
    if (p.group !== 'Reports') html = html.replace('<head>', '<head><base target="_blank">');
    $('frame').srcdoc = html;
    $('crumb').textContent = p.title;
    document.title = p.title + ' · Glamis Management';
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      if (a.getAttribute('data-id') === p.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('nav').classList.remove('open'); $('menu').setAttribute('aria-expanded', 'false');
  }

  function fail(msg) { $('lockmsg').textContent = msg; $('go').disabled = false; }

  window.addEventListener('hashchange', function () { if (pages.length) show(); });
  $('menu').addEventListener('click', function () { var o = $('nav').classList.toggle('open'); this.setAttribute('aria-expanded', o ? 'true' : 'false'); });
  $('lockbtn').addEventListener('click', function () { sdel(); location.hash = ''; location.reload(); });
  $('lockform').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!blob) return fail('Still loading. Try again in a moment.');
    $('go').disabled = true; $('lockmsg').textContent = 'Opening…';
    var keep = $('keep').checked;
    derive($('pw').value).then(function (raw) {
      return open(raw).then(function (data) { sset(blob.salt + ':' + b64e(raw), keep); start(data); });
    }).catch(function () { fail('That password did not work. Check it and try again.'); });
  });

  fetch('site.dat', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    blob = j;
    var saved = sget();
    if (saved && saved.split(':')[0] === blob.salt) {
      open(b64d(saved.split(':')[1])).then(start).catch(function () { sdel(); $('pw').focus(); });
    } else { if (saved) sdel(); $('pw').focus(); }
  }).catch(function () { fail('The site could not load. Check your connection and reload.'); });
})();
