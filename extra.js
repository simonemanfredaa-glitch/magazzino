/* MAGAZZINO — esportazioni, importazione, PDF dello storico */
function scarica(nome, testo, tipo) {
  var b = new Blob([testo], { type: tipo || 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csv(rows) {
  return '﻿' + rows.map(function (r) { return r.map(function (v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n');
}
function oggi() { return new Date().toISOString().slice(0, 10); }
function exportInv() {
  var rows = [['Sezione', 'Codice', 'Articolo', 'Tipo', 'Totale', 'Disponibili oggi', 'Fuori', 'Da ricomprare', 'Contenuto kit', 'Note aperte']];
  S.data.sections.forEach(function (s) { s.items.forEach(function (it) {
    rows.push([s.name, s.code, it.name, it.type === 'cons' ? 'Consumabile' : it.type === 'kit' ? 'Kit' : 'Attrezzatura', it.tot, it.tot === '' ? '' : dispoOggi(it),
      fuori(it).join(', '), it.finendo ? 'Sì' : '', (it.kit || '').replace(/\n/g, ' · '), (it.notes || []).map(function (n) { return n.text; }).join(' | ')]);
  }); });
  scarica('Magazzino_inventario_' + oggi() + '.csv', csv(rows));
}
function exportListe() {
  var rows = [['Lista', 'Producer', 'Ritiro', 'Rientro', 'Sezione', 'Articolo', 'Quantità', 'Preso', 'Rientrato', 'Note']];
  S.data.producers.forEach(function (p) {
    var pr = (S.data.periods || {})[p], o = ownerOf(p), r = pr ? gTxt(pr.from, pr.fromP, true) : '', e = pr ? gTxt(pr.to, pr.toP, true) : '';
    S.data.sections.forEach(function (s) { s.items.forEach(function (it) { var x = it.lists[p]; if (!x || !hasQty(x)) return;
      rows.push([p, o, r, e, s.code, it.name, x.qty, x.preso ? 'Sì' : '', x.rientrato ? 'Sì' : '', x.note]); }); });
    ((S.data.extras || {})[p] || []).forEach(function (x) { rows.push([p, o, r, e, 'Da procurare', x.name, x.qty, x.preso ? 'Sì' : '', x.rientrato ? 'Sì' : '', x.note]); });
  });
  scarica('Magazzino_liste_' + oggi() + '.csv', csv(rows));
}

/* ---------- PDF dello storico (generato al momento) ---------- */
function loadPdfLib() {
  if (window.PDFLIB) return Promise.resolve(window.PDFLIB);
  return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = 'pdf.js'; sc.onload = function () { res(window.PDFLIB); }; sc.onerror = rej; document.head.appendChild(sc); });
}
function pdfStorico(o) {
  if (!o) return;
  toast('Preparo il PDF…');
  loadPdfLib().then(function (L) {
    var doc = new L.jsPDF({ unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth();
    doc.setFillColor(26, 26, 26); doc.rect(0, 0, W, 26, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('COURAGE · MAGAZZINO · STORICO', 14, 10);
    doc.setFontSize(17); doc.text(String(o.name), 14, 19);
    doc.setTextColor(40); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    var c = (o.closed || '').split('-'), y = 34;
    var info = [];
    if (o.per) info.push('Ritiro: ' + gTxt(o.per.from, o.per.fromP, true) + '   →   Rientro: ' + gTxt(o.per.to, o.per.toP, true));
    info.push((o.closed ? 'Chiusa il ' + Number(c[2]) + ' ' + MESI[Number(c[1]) - 1] + ' ' + c[0] + ' · ' : '') + o.items.length + ' articoli');
    info.forEach(function (t) { doc.text(t, 14, y); y += 6; });
    var nomeSez = {}; S.data.sections.forEach(function (s) { nomeSez[s.code] = s.code + ' · ' + s.name; }); nomeSez['*'] = 'Da procurare';
    var ord = S.data.sections.map(function (s) { return s.code; }).concat(['*']);
    var body = [];
    ord.forEach(function (code) {
      var rows = o.items.filter(function (it) { return it.c === code; }); if (!rows.length) return;
      body.push([{ content: nomeSez[code] || code, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [238, 237, 233] } }]);
      rows.forEach(function (it) {
        var st = it.r ? 'Rientrato' : it.p ? (it.t === 'cons' ? 'Preso' : 'NON rientrato') : 'Non preso';
        body.push([it.n, '×' + it.q, st, it.no || '']);
      });
    });
    L.autoTable(doc, { startY: y + 2, head: [['Articolo', 'Q.tà', 'Stato', 'Note']], body: body, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, lineColor: [220, 220, 220] },
      headStyles: { fillColor: [26, 26, 26], textColor: 255 }, columnStyles: { 1: { cellWidth: 16, halign: 'center' }, 2: { cellWidth: 30 } },
      didParseCell: function (d) { if (d.section === 'body' && d.column.index === 2 && d.cell.raw === 'NON rientrato') { d.cell.styles.textColor = [179, 38, 30]; d.cell.styles.fontStyle = 'bold'; } } });
    doc.save('Storico_' + String(o.name).replace(/[^\w\-]+/g, '_') + (o.closed ? '_' + o.closed : '') + '.pdf');
  }).catch(function (e) { toast('PDF non riuscito: ' + msg(e), true); });
}

/* ---------- importazione una tantum (admin) ---------- */
function importDati() {
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function () {
    var f = inp.files[0]; if (!f) return;
    f.text().then(function (t) {
      var d = JSON.parse(t), nA = Object.keys(d.articoli || {}).length, nL = (d.liste || []).length, nS = (d.storico || []).length, nN = (d.note || []).length;
      var m = modal('<h3>Importa dati</h3><p>Nel file: <b>' + nA + '</b> articoli, <b>' + nL + '</b> liste aperte, <b>' + nS + '</b> liste nello storico, <b>' + nN + '</b> note.</p><p><b>Attenzione:</b> l\'inventario attuale dell\'app viene sostituito da quello del file.</p>' +
        '<div class="row2"><button class="btn-g" id="ic">Annulla</button><button class="btn-d" id="ik">Importa</button></div>');
      m.querySelector('#ic').onclick = closeModal;
      m.querySelector('#ik').onclick = function () { closeModal(); toast('Importo…'); doImport(d).then(function (n) { toast('Importati ' + n + ' elementi'); }).catch(function (e) { toast(msg(e), true); }); };
    }).catch(function () { toast('File non valido', true); });
  };
  inp.click();
}
function doImport(d) {
  if (!FBX.isAdmin()) return Promise.reject(new Error('Serve un account admin'));
  var F = window.FB, db = F.db, u = FBX.user(), ops = [], raw = FBX.raw();
  Object.keys(raw.ART).forEach(function (id) { if (!(d.articoli || {})[id]) ops.push(function (b) { b.delete(F.doc(db, 'articoli', id)); }); });
  Object.keys(d.articoli || {}).forEach(function (id) { ops.push(function (b) { b.set(F.doc(db, 'articoli', id), d.articoli[id]); }); });
  var esist = {}; Object.keys(raw.LISTE).forEach(function (id) { esist[raw.LISTE[id].nome] = id; });
  (d.liste || []).forEach(function (l) {
    var ref = esist[l.nome] ? F.doc(db, 'liste', esist[l.nome]) : F.doc(F.collection(db, 'liste'));
    var v = { nome: l.nome, owner: u.uid, ownerEmail: u.email, ownerName: l.ownerName || '', per: l.per || null, righe: l.righe || {}, extra: l.extra || [], stato: l.stato || {}, creata: Date.now() };
    ops.push(function (b) { b.set(ref, v); });
  });
  var stoEs = {}; Object.keys(raw.STO).forEach(function (id) { stoEs[raw.STO[id].nome + '|' + raw.STO[id].chiusa] = 1; });
  (d.storico || []).forEach(function (o) { if (stoEs[o.nome + '|' + o.chiusa]) return; ops.push(function (b) { b.set(F.doc(F.collection(db, 'storico')), o); }); });
  (d.note || []).forEach(function (n) { ops.push(function (b) { b.set(F.doc(F.collection(db, 'note')), n); }); });
  var p = Promise.resolve();
  for (var i = 0; i < ops.length; i += 400) (function (chunk) {
    p = p.then(function () { var b = F.writeBatch(db); chunk.forEach(function (f) { f(b); }); return b.commit(); });
  })(ops.slice(i, i + 400));
  return p.then(function () { return ops.length; });
}
