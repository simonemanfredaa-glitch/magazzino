/* MAGAZZINO COURAGE — livello dati su Firebase.
   Imita le funzioni del vecchio server Apps Script (stessi nomi e stesso formato di getData),
   così la grafica resta identica ma tutto è istantaneo e aggiornato in tempo reale. */
(function () {
  var F = window.FB, db = F.db;
  var SECTIONS = [
    { code: '1', name: 'Ufficio', color: '#1565C0', fg: '#FFFFFF' },
    { code: '2A', name: 'Tecnico', color: '#FFD600', fg: '#1A1A1A' },
    { code: '2B', name: 'Outdoor', color: '#FFD600', fg: '#1A1A1A' },
    { code: '3A', name: 'Beauty & Farmacia', color: '#D32F2F', fg: '#FFFFFF' },
    { code: '3B', name: 'Allestimenti', color: '#D32F2F', fg: '#FFFFFF' },
    { code: '4', name: 'Catering & Craft', color: '#F57C00', fg: '#1A1A1A' },
    { code: '5', name: 'Wardrobe & Talent', color: '#6A1B9A', fg: '#FFFFFF' },
    { code: '6', name: 'Style', color: '#F8BBD0', fg: '#1A1A1A' },
    { code: '7A', name: 'Pulizia', color: '#555555', fg: '#FFFFFF' },
    { code: '7B', name: 'Misto', color: '#555555', fg: '#FFFFFF' },
    { code: '↑', name: 'Sopra gli scaffali', color: '#1A1A1A', fg: '#FFFFFF' }
  ];
  var BOSS = 'simonemanfredaa@gmail.com';
  var ART = {}, LISTE = {}, NOTE = {}, STO = {}, ADMINS = [BOSS], PRODS = [], USER = null;
  var ready = { art: false, liste: false, note: false, sto: false, cfg: false, auth: false }, waiters = [];
  var lc = function (s) { return String(s == null ? '' : s).trim().toLowerCase(); };
  var hasQ = function (q) { return typeof q === 'number' && q > 0; };

  function isReady() { for (var k in ready) if (!ready[k]) return false; return true; }
  function mark(k) { ready[k] = true; if (isReady()) { var w = waiters; waiters = []; w.forEach(function (f) { f(); }); } notify(); }
  function whenReady() { return new Promise(function (res) { if (isReady()) res(); else waiters.push(res); }); }
  var tmr = null;
  function notify() { if (!isReady()) return; clearTimeout(tmr); tmr = setTimeout(function () { if (window.onDataChange) window.onDataChange(); }, 60); }
  function fail(e) { console.error(e); if (window.onDataError) window.onDataError(e); }

  F.onSnapshot(F.collection(db, 'articoli'), function (s) { ART = {}; s.forEach(function (d) { ART[d.id] = d.data(); }); mark('art'); }, fail);
  F.onSnapshot(F.collection(db, 'liste'), function (s) { LISTE = {}; s.forEach(function (d) { LISTE[d.id] = d.data(); }); mark('liste'); }, fail);
  F.onSnapshot(F.collection(db, 'note'), function (s) { NOTE = {}; s.forEach(function (d) { NOTE[d.id] = d.data(); }); mark('note'); }, fail);
  F.onSnapshot(F.collection(db, 'storico'), function (s) { STO = {}; s.forEach(function (d) { STO[d.id] = d.data(); }); mark('sto'); }, fail);
  F.onSnapshot(F.doc(db, 'config', 'ruoli'), function (d) {
    var r = (d.exists() && d.data()) || {};
    ADMINS = (r.admin || []).map(lc); if (ADMINS.indexOf(BOSS) < 0) ADMINS.unshift(BOSS);
    PRODS = (r.producer || []).map(lc); mark('cfg');
  }, function (e) { ADMINS = [BOSS]; mark('cfg'); fail(e); });
  F.onAuthStateChanged(F.auth, function (u) { USER = u; mark('auth'); });
  F.getRedirectResult(F.auth).catch(function () {});

  /* ---------- utenti ---------- */
  function me() { return USER ? lc(USER.email) : ''; }
  function isAdmin() { return !!(USER && ADMINS.indexOf(me()) >= 0); }
  function isProd() { return isAdmin() || !!(USER && PRODS.indexOf(me()) >= 0); }
  function listByName(p) { for (var id in LISTE) if (LISTE[id].nome === p) return { id: id, l: LISTE[id] }; return null; }
  function isCollab(l) { return !!(USER && (l.collab || []).map(lc).indexOf(me()) >= 0); }
  function canEditL(l) { return !!USER && (isAdmin() || l.owner === USER.uid || isCollab(l)); }
  function owns(p) { var x = listByName(p); return !!(x && canEditL(x.l)); }
  function canManage(p) { var x = listByName(p); return !!(x && USER && (isAdmin() || x.l.owner === USER.uid)); }
  function canSee(p) { var x = listByName(p); return !!x && (isProd() || canEditL(x.l)); }
  function role() { if (!USER) return 'guest'; if (isAdmin()) return 'admin'; if (isProd()) return 'producer'; for (var id in LISTE) if (isCollab(LISTE[id])) return 'collab'; return 'none'; }
  var LINKKEY = 'mag_email';
  function sendLink(em) {
    em = lc(em); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return Promise.reject(new Error('Scrivi un indirizzo email valido'));
    var torna = location.origin + location.pathname + location.search.replace(/[?&](apiKey|oobCode|mode|lang)=[^&]*/g, '');
    return F.sendSignInLinkToEmail(F.auth, em, { url: torna, handleCodeInApp: true }).then(function () { try { localStorage.setItem(LINKKEY, em); } catch (e) {} });
  }
  function linkIn(askEmail) {
    if (!F.isSignInWithEmailLink(F.auth, location.href)) return Promise.resolve(false);
    var em = ''; try { em = localStorage.getItem(LINKKEY) || ''; } catch (e) {}
    var p = em ? Promise.resolve(em) : askEmail();
    return p.then(function (e2) {
      if (!e2) return false;
      return F.signInWithEmailLink(F.auth, lc(e2), location.href).then(function () {
        try { localStorage.removeItem(LINKKEY); } catch (e) {}
        return true;
      });
    }).finally(function () {
      var u = new URL(location.href); ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl'].forEach(function (k) { u.searchParams.delete(k); });
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    });
  }
  function login() {
    var prov = new F.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' });
    return F.signInWithPopup(F.auth, prov).catch(function (e) {
      if (e && /popup-blocked|operation-not-supported|web-storage/.test(e.code || '')) return F.signInWithRedirect(F.auth, prov);
      throw e;
    }).then(function () { return whenReady(); });
  }
  function needList(p) {
    if (!USER) throw new Error('Accedi con Google per modificare la lista');
    var x = listByName(p); if (!x) throw new Error('Lista non trovata');
    if (!canEditL(x.l)) throw new Error('Questa lista è di ' + (x.l.ownerName || x.l.ownerEmail || 'un altro producer') + ': puoi solo vederla');
    return x;
  }
  function needAdmin() { if (!isAdmin()) throw new Error('Serve un account admin'); }

  /* ---------- lettura: stesso formato del vecchio getData ---------- */
  function tipo(a) { return a.cons ? 'cons' : (/^kit\b/i.test(a.nome) ? 'kit' : 'att'); }
  function getData() {
    var producers = [], periods = {}, extras = {}, owners = {};
    Object.keys(LISTE).forEach(function (id) {
      var l = LISTE[id]; producers.push(l.nome); periods[l.nome] = l.per || null;
      owners[l.nome] = { email: l.ownerEmail || '', name: l.ownerName || '', id: id, mine: !!(USER && l.owner === USER.uid), collab: (l.collab || []).slice() };
      var st = l.stato || {};
      extras[l.nome] = (l.extra || []).map(function (x) { var s = st['x:' + x.name] || {}; return { name: x.name, qty: x.qty, note: s.note || x.note || '', preso: !!s.preso, rientrato: !!s.rientrato }; });
    });
    producers.sort(function (a, b) { return a.localeCompare(b); });
    var notesBy = {};
    Object.keys(NOTE).forEach(function (id) { var n = NOTE[id]; if (n.fatto) return; (notesBy[n.art] = notesBy[n.art] || []).push({ row: id, text: n.testo, date: n.data || '', t: n.t || 0 }); });
    var sections = SECTIONS.map(function (s) {
      var arts = Object.keys(ART).filter(function (id) { return ART[id].sez === s.code; }).map(function (id) { return { id: id, a: ART[id] }; })
        .sort(function (x, y) { return (x.a.ordine || 0) - (y.a.ordine || 0) || x.a.nome.localeCompare(y.a.nome); });
      var items = arts.map(function (o) {
        var a = o.a, t = tipo(a), lists = {}, out = 0;
        Object.keys(LISTE).forEach(function (lid) {
          var l = LISTE[lid], q = ((l.righe || {})[o.id] || {}).q, s2 = (l.stato || {})[o.id] || {};
          if (q == null && !s2.note) return;
          lists[l.nome] = { dove: '', qty: hasQ(q) ? q : '', preso: !!s2.preso, rientrato: !!s2.rientrato, note: s2.note || '' };
          if (hasQ(q) && !s2.rientrato) out += q;
        });
        var tot = t === 'cons' ? '' : (typeof a.tot === 'number' ? a.tot : '');
        return { slot: Number(o.id), name: a.nome, type: t, finendo: !!a.finendo, tot: tot, dispo: tot === '' ? '' : tot - out,
          kit: t === 'kit' ? (a.kit || '') : '', notes: (notesBy[o.id] || []).sort(function (x, y) { return x.t - y.t; }), lists: lists };
      });
      return { code: s.code, name: s.name, color: s.color, fg: s.fg, items: items };
    });
    var storicoList = !isProd() ? [] : Object.keys(STO).map(function (id) { var o = STO[id]; return { id: id, name: o.nome, per: o.per || null, closed: o.chiusa || '', pdf: '', n: (o.items || []).length }; })
      .sort(function (a, b) { return String(b.closed).localeCompare(String(a.closed)); });
    return { sections: sections, extras: extras, periods: periods, owners: owners, closed: {}, storicoList: storicoList, storico: '',
      producers: producers, dove: [], appUrl: location.origin + location.pathname, updated: new Date().toISOString(),
      user: USER ? { email: USER.email, name: USER.displayName || '' } : null, admin: isAdmin(), role: role(), visible: producers.filter(canSee),
      adminEmails: isAdmin() ? ADMINS.slice() : [], producerEmails: isAdmin() ? PRODS.slice() : [] };
  }

  /* ---------- scrittura ---------- */
  function W(p) { return p.catch(fail); }                     // scrittura in background: l'app si aggiorna subito
  function listRef(id) { return F.doc(db, 'liste', id); }
  function nextArtId() { var m = 0; Object.keys(ART).forEach(function (k) { m = Math.max(m, Number(k) || 0); }); return String(m + 1); }
  function artBy(c, slot) { var a = ART[String(slot)]; if (!a) throw new Error('Articolo non trovato'); return a; }
  var nowTxt = function () { var d = new Date(), z = function (n) { return ('0' + n).slice(-2); }; return z(d.getDate()) + '/' + z(d.getMonth() + 1) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };

  var API = {
    getData: function () { return getData(); },
    checkPin: function (p) {
      if (isAdmin()) return 'admin';
      if (p && owns(p)) return 'list';
      if (!USER) throw new Error('Accedi con Google');
      if (!p) throw new Error('Serve un account admin');
      var x = listByName(p);
      throw new Error('Questa lista è di ' + (x ? (x.l.ownerName || x.l.ownerEmail) : 'un altro producer') + ': solo chi l\'ha creata può aprirla');
    },
    getStorico: function (id) {
      var o = STO[id]; if (!o) throw new Error('Lista non trovata nello storico');
      return { id: id, name: o.nome, per: o.per || null, closed: o.chiusa || '', pdf: '', n: (o.items || []).length, items: o.items || [] };
    },
    createList: function (n, pw, f, fp, t, tp, base) {
      if (!USER) throw new Error('Accedi per creare una lista');
      if (!isProd()) throw new Error('Solo i producer possono creare liste: chiedi a un admin di aggiungerti');
      n = String(n || '').trim(); if (!n) throw new Error('Scrivi il nome della lista');
      if (listByName(n)) throw new Error('Esiste già una lista con questo nome');
      var righe = {}, extra = [];
      if (base && STO[base]) {
        var byName = {}; Object.keys(ART).forEach(function (id) { byName[lc(ART[id].nome)] = id; });
        (STO[base].items || []).forEach(function (it) {
          if (it.c === '*') { extra.push({ name: it.n, qty: it.q, note: it.no || '' }); return; }
          var id = byName[lc(it.n)]; if (id && hasQ(it.q)) righe[id] = { q: it.q };
        });
      }
      var ref = F.doc(F.collection(db, 'liste'));
      LISTE[ref.id] = { nome: n, owner: USER.uid, ownerEmail: me(), ownerName: USER.displayName || '', collab: [], per: { from: f, fromP: fp, to: t, toP: tp }, righe: righe, extra: extra, stato: {}, creata: Date.now() };
      return F.setDoc(ref, LISTE[ref.id]).then(function () { return getData(); });
    },
    setPeriod: function (p, pin, f, fp, t, tp) { var x = needList(p); W(F.updateDoc(listRef(x.id), { per: { from: f, fromP: fp, to: t, toP: tp } })); },
    setQty: function (p, pin, c, i, q) {
      var x = needList(p), n = Math.round(Number(q)), upd = {};
      if (c === '*') {
        var ex = (x.l.extra || []).map(function (z) { return Object.assign({}, z); }).filter(function (z) { if (z.name !== i) return true; if (n > 0) { z.qty = n; return true; } return false; });
        upd.extra = ex;
      } else if (n > 0) upd['righe.' + i] = { q: n };
      else { upd['righe.' + i] = F.deleteField(); upd['stato.' + i] = F.deleteField(); }
      W(F.updateDoc(listRef(x.id), upd));
    },
    setFlag: function (p, c, i, f, v) {
      var x = listByName(p); if (!x) throw new Error('Lista non trovata');
      var k = c === '*' ? 'x:' + i : String(i), upd = {};
      upd['stato.' + k + '.' + f] = !!v;
      if (f === 'preso' && !v) upd['stato.' + k + '.rientrato'] = false;
      W(F.updateDoc(listRef(x.id), upd));
    },
    setNote: function (p, c, i, t) {
      var x = listByName(p); if (!x) throw new Error('Lista non trovata');
      var k = c === '*' ? 'x:' + i : String(i), upd = {}; upd['stato.' + k + '.note'] = String(t || '').slice(0, 300);
      W(F.updateDoc(listRef(x.id), upd));
    },
    setDove: function () {},
    addToList: function (p, pin, n, q, nt) {
      var x = needList(p); n = String(n || '').trim(); if (!n) throw new Error('Scrivi il nome del prodotto');
      Object.keys(ART).forEach(function (id) { if (lc(ART[id].nome) === lc(n)) throw new Error('C\'è già in inventario: cercalo nella lista'); });
      var ex = (x.l.extra || []).slice(); if (ex.some(function (z) { return lc(z.name) === lc(n); })) throw new Error('È già nella tua lista');
      ex.push({ name: n, qty: Math.max(1, Math.round(Number(q) || 0)), note: String(nt || '').slice(0, 300) });
      W(F.updateDoc(listRef(x.id), { extra: ex }));
    },
    editExtra: function (p, pin, o, n, q, nt) {
      var x = needList(p); n = String(n || '').trim(); if (!n) throw new Error('Scrivi il nome del prodotto');
      var ex = (x.l.extra || []).map(function (z) { return z.name === o ? { name: n, qty: Math.max(1, Math.round(Number(q) || 0)), note: String(nt || '') } : z; });
      var upd = { extra: ex };
      if (o !== n && (x.l.stato || {})['x:' + o]) { upd['stato.x:' + n] = Object.assign({}, x.l.stato['x:' + o], { note: String(nt || '') }); upd['stato.x:' + o] = F.deleteField(); }
      else upd['stato.x:' + n + '.note'] = String(nt || '');
      W(F.updateDoc(listRef(x.id), upd));
    },
    removeExtra: function (p, pin, n) { var x = needList(p), upd = { extra: (x.l.extra || []).filter(function (z) { return z.name !== n; }) }; upd['stato.x:' + n] = F.deleteField(); W(F.updateDoc(listRef(x.id), upd)); },
    chiudiProduzione: function (p) {
      var x = needList(p), d = getData(), items = [];
      d.sections.forEach(function (s) { s.items.forEach(function (it) { var e = it.lists[p]; if (e && hasQ(e.qty)) items.push({ c: s.code, n: it.name, t: it.type, q: e.qty, p: !!e.preso, r: !!e.rientrato, no: e.note || '' }); }); });
      (d.extras[p] || []).forEach(function (e) { items.push({ c: '*', n: e.name, t: 'extra', q: e.qty, p: !!e.preso, r: !!e.rientrato, no: e.note || '' }); });
      var iso = new Date().toISOString().slice(0, 10);
      var b = F.writeBatch(db);
      b.set(F.doc(F.collection(db, 'storico')), { nome: p, per: x.l.per || null, chiusa: iso, items: items, ownerEmail: x.l.ownerEmail || '', chiusaDa: USER.email || '' });
      b.delete(listRef(x.id));
      delete LISTE[x.id];
      return b.commit().then(function () { return getData(); });
    },
    // inventario
    setFinendo: function (c, i, v) { artBy(c, i); W(F.updateDoc(F.doc(db, 'articoli', String(i)), { finendo: !!v })); },
    addInvNote: function (c, i, t) {
      var a = artBy(c, i); t = String(t || '').trim(); if (!t) throw new Error('Scrivi la nota');
      W(F.addDoc(F.collection(db, 'note'), { art: String(i), nome: a.nome, testo: t.slice(0, 500), data: nowTxt(), t: Date.now(), fatto: false }));
    },
    closeInvNote: function (pin, row) { needAdmin(); W(F.updateDoc(F.doc(db, 'note', String(row)), { fatto: true })); },
    setTot: function (p, pin, c, i, t) { needAdmin(); var a = artBy(c, i); if (a.cons) throw new Error('I consumabili non hanno un numero'); W(F.updateDoc(F.doc(db, 'articoli', String(i)), { tot: Math.max(0, Math.round(Number(t) || 0)) })); },
    setKit: function (pin, c, i, t) { needAdmin(); artBy(c, i); W(F.updateDoc(F.doc(db, 'articoli', String(i)), { kit: String(t || '') })); },
    addItem: function (p, pin, c, n, t, kind) {
      needAdmin(); n = String(n || '').trim(); if (!n) throw new Error('Scrivi il nome dell\'articolo');
      if (kind === 'kit' && !/^kit\b/i.test(n)) n = 'Kit ' + n;
      Object.keys(ART).forEach(function (id) { if (lc(ART[id].nome) === lc(n)) throw new Error('Esiste già un articolo con questo nome'); });
      var ord = 0; Object.keys(ART).forEach(function (id) { if (ART[id].sez === c) ord = Math.max(ord, ART[id].ordine || 0); });
      var id = nextArtId(), doc = { sez: c, nome: n, ordine: ord + 1, cons: kind === 'cons', tot: kind === 'cons' ? null : Math.max(0, Math.round(Number(t) || 0)), finendo: false, kit: '' };
      ART[id] = doc; W(F.setDoc(F.doc(db, 'articoli', id), doc));
    },
    removeItem: function (p, pin, c, i) {
      needAdmin(); var id = String(i);
      Object.keys(LISTE).forEach(function (lid) { var q = ((LISTE[lid].righe || {})[id] || {}).q; if (hasQ(q)) throw new Error('Non posso eliminarlo: è nella lista ' + LISTE[lid].nome); });
      delete ART[id]; W(F.deleteDoc(F.doc(db, 'articoli', id)));
    },
    // gestione liste (admin)
    adminList: function () {
      needAdmin();
      return Object.keys(LISTE).map(function (id) { var l = LISTE[id]; return { name: l.nome, hasPin: true, owner: l.ownerName || l.ownerEmail || '', inUse: Object.keys(l.righe || {}).length > 0 || (l.extra || []).length > 0 }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
    },
    adminRename: function (pin, o, n) {
      needAdmin(); n = String(n || '').trim(); if (!n) throw new Error('Scrivi il nuovo nome'); if (listByName(n)) throw new Error('Nome già usato');
      var x = listByName(o); if (!x) throw new Error('Lista non trovata'); LISTE[x.id].nome = n;
      return F.updateDoc(listRef(x.id), { nome: n }).then(function () { return API.adminList(); });
    },
    adminDelete: function (pin, n) {
      needAdmin(); var x = listByName(n); if (!x) throw new Error('Lista non trovata'); delete LISTE[x.id];
      return F.deleteDoc(listRef(x.id)).then(function () { return API.adminList(); });
    },
    setRuolo: function (kind, em, on) {
      needAdmin(); em = lc(em); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(em)) throw new Error('Email non valida');
      if (kind === 'admin' && em === BOSS && !on) throw new Error('Questo admin non si può togliere');
      if (kind === 'admin' && em === me() && !on) throw new Error('Non puoi togliere te stesso');
      var arr = kind === 'admin' ? ADMINS : PRODS, i = arr.indexOf(em);
      if (on && i < 0) arr.push(em); if (!on && i >= 0) arr.splice(i, 1);
      return F.setDoc(F.doc(db, 'config', 'ruoli'), { admin: ADMINS.filter(function (x) { return x !== BOSS; }), producer: PRODS.slice() }).then(function () { return getData(); });
    },
    setCollab: function (p, em, on) {
      var x = listByName(p); if (!x) throw new Error('Lista non trovata');
      if (!canManage(p)) throw new Error('Solo chi ha creato la lista può aggiungere collaboratori');
      em = lc(em); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(em)) throw new Error('Email non valida');
      var c = (x.l.collab || []).map(lc).filter(function (z) { return z !== em; }); if (on) c.push(em);
      LISTE[x.id].collab = c;
      return F.updateDoc(listRef(x.id), { collab: c }).then(function () { return getData(); });
    },
    adminSetPin: function () { throw new Error('Con l\'accesso Google le password non servono più'); }
  };

  /* ---------- come google.script.run, ma locale e immediato ---------- */
  function runner() {
    var r = { _s: function () {}, _f: function () {} };
    r.withSuccessHandler = function (f) { r._s = f; return r; };
    r.withFailureHandler = function (f) { r._f = f; return r; };
    r.api = function (fn, args) {
      whenReady().then(function () {
        if (!API[fn]) throw new Error('Funzione non disponibile: ' + fn);
        return API[fn].apply(null, args || []);
      }).then(function (v) {
        r._s(v === undefined ? getData() : v);
      }).catch(function (e) { r._f(e && e.message ? e : new Error(String(e))); });
    };
    return r;
  }
  window.google = { script: { get run() { return runner(); } } };

  /* ---------- funzioni usate dalla grafica ---------- */
  window.FBX = {
    login: login, sendLink: sendLink, linkIn: linkIn, role: role, isProd: isProd, canManage: canManage, canSee: canSee,
    logout: function () { return F.signOut(F.auth); },
    user: function () { return USER; },
    isAdmin: isAdmin,
    owns: owns,
    listId: function (p) { var x = listByName(p); return x ? x.id : ''; },
    listName: function (id) { return LISTE[id] ? LISTE[id].nome : ''; },
    ready: whenReady,
    raw: function () { return { ART: ART, LISTE: LISTE, NOTE: NOTE, STO: STO }; }
  };
})();
