const { chromium } = require('playwright');
const URL = 'http://localhost:8766/index.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1200, height: 900 } }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push('pageerror ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await pg.goto(URL); await pg.waitForTimeout(400);
  // famiglia + figli
  await pg.evaluate(() => {
    FAM.pin = 'p1.x.y'; FAM.ai.provider = 'demo';
    const mk = (nome, livello, dsa, tema) => { const f = statoVuoto(); f.profilo = { nome, livello, dsa, tema, fs: 1, colori: false, lingua: 'it', font: 'tema', lh: 1.6, ls: 0, ws: 0, vel: 0.9, voce: '', pin: '', sezioni: {} }; DB.figli.push(f); return f; };
    window.__e = mk('Elena', 'elementari', {}, 'calmo'); window.__v = mk('Viola', 'superiori', { discalculia: true }, 'gioco');
    attiva(__v.id); salva(); render();
  });
  ok(await pg.evaluate(() => document.body.dataset.tema) === 'calmo', 'superiori con tema gioco -> calmo');
  await pg.evaluate(() => { attiva(__e.id); render(); });
  ok(await pg.evaluate(() => document.body.dataset.tema) === 'gioco', 'elementari con tema calmo -> gioco');
  const r = await pg.evaluate(() => ({ a: aspettoConsigliato('superiori', {}), b: aspettoConsigliato('media', { dislessia: true }), c: aspettoConsigliato('elementari', { discalculia: true }), t1: temiPer('elementari'), t2: temiPer('media') }));
  ok(r.a.font === 'tema' && r.a.ls === 0 && r.a.ws === 0 && r.a.fs === 1, 'senza DSA: carattere e spaziatura standard');
  ok(r.b.font === 'lexend' && r.b.ls > 0 && r.b.ws > 0 && r.b.tema === 'calmo', 'dislessia: lexend + spaziature, tema calmo');
  ok(r.c.tema === 'gioco' && r.c.font === 'atkinson', 'elementari + discalculia: gioco, atkinson');
  ok(JSON.stringify(r.t1) === '["gioco"]' && JSON.stringify(r.t2) === '["calmo","notte"]', 'temi per livello');
  // setup UI
  await pg.evaluate(() => { V.genitoriOk = true; V.edit = null; V.vista = 'setup'; render(); });
  ok(await pg.locator('#cons input[name=tema]').count() === 2, 'setup superiori: 2 temi (calmo, notte)');
  await pg.selectOption('#livello', 'elementari');
  ok(await pg.locator('#cons input[name=tema]').count() === 1 && await pg.locator('#cons input[value=gioco]').count() === 1, 'setup elementari: solo gioco');
  await pg.selectOption('#livello', 'media');
  ok(await pg.locator('#cons input[value=gioco]').count() === 0, 'setup media: niente gioco');
  await pg.check('[data-dsa=dislessia]');
  ok(await pg.inputValue('[data-pref=font]') === 'lexend' && +await pg.inputValue('[data-pref=ls]') === 0.06, 'dislessia spuntata -> font e spaziatura automatici');
  await pg.uncheck('[data-dsa=dislessia]');
  ok(await pg.inputValue('[data-pref=font]') === 'tema' && +await pg.inputValue('[data-pref=ws]') === 0, 'DSA tolto -> default');
  await pg.fill('[data-pref=ls]', '0.1'); await pg.dispatchEvent('[data-pref=ls]', 'input');
  await pg.check('[data-dsa=disortografia]');
  ok(+await pg.inputValue('[data-pref=ls]') === 0.1, 'modifica manuale non viene sovrascritta');
  await pg.click('#btn-cons');
  ok(await pg.inputValue('[data-pref=font]') === 'andika', 'Ripristina consigliato');
  // capitolo demo
  await pg.evaluate(async () => { attiva(__v.id); V.materia = 'Storia'; V.vista = 'nuovo-cap'; render(); await preparaCapitolo(); });
  ok(await pg.evaluate(() => V.vista) === 'capitolo', 'capitolo demo creato');
  ok(await pg.locator('.tab', { hasText: 'Allenamento' }).count() === 1, 'tab Allenamento presente');
  await pg.click('.tab:has-text("Allenamento")');
  ok(await pg.locator('textarea[id^=pr]').count() === 2, 'esercizi di pratica mostrati');
  await pg.fill('#pr0', 'Perché i fiumi portano acqua e terra fertile'); await pg.click('[data-act=pratica-controlla][data-i="0"]'); await pg.waitForTimeout(700);
  ok(await pg.locator('.fb.ok').count() >= 1 && await pg.evaluate(() => premi().xp) === 3, 'controllo risposta + punti');
  await pg.click('[data-act=pratica-indizio][data-i="1"]');
  ok(await pg.locator('.fb:has-text("1.")').count() >= 1, 'indizio mostrato');

  // costruisci il riassunto
  await pg.evaluate(() => { S.profilo.sezioni = { riassunto: false }; V.genVede = false; V.tab = 'schema'; render(); });
  ok(await pg.locator('.tab', { hasText: /^Riassunto$/ }).count() === 0 && await pg.locator('.tab', { hasText: 'Il mio riassunto' }).count() === 1, 'riassunto nascosto ma "Il mio riassunto" disponibile');
  await pg.click('.tab:has-text("Il mio riassunto")');
  const nsez = await pg.locator('textarea[id^=cot]').count(); ok(nsez >= 2, 'paragrafi da riassumere: ' + nsez);
  ok(!(await pg.locator('#app').innerText()).includes('Le prime grandi civiltà si sviluppano lungo'), 'il riassunto automatico NON viene mostrato');
  await pg.fill('#cok0', 'fiumi, acqua'); await pg.fill('#cot0', 'Ciao'); await pg.click('[data-act=co-controlla][data-i="0"]');
  ok(await pg.locator('.fb.ok, .fb.warn').count() === 0, 'testo troppo corto: nessun controllo (toast)');
  await pg.fill('#cot0', 'Le prime civiltà nascono vicino ai fiumi: il Tigri, l\'Eufrate, il Nilo, l\'Indo e il Fiume Giallo, perché danno acqua e terra fertile.');
  await pg.click('[data-act=co-controlla][data-i="0"]'); await pg.waitForTimeout(300);
  ok(await pg.locator('.fb:has-text("Ottimo")').count() === 1, 'controllo: idee principali colte');
  const xpA = await pg.evaluate(() => premi().xp); ok(xpA >= 5, 'punti per il paragrafo completato');
  await pg.click('.tab:has-text("Schema")'); await pg.click('.tab:has-text("Il mio riassunto")');
  ok((await pg.inputValue('#cot0')).startsWith('Le prime civiltà'), 'bozza conservata cambiando scheda');
  await pg.click('[data-act=co-aiuto][data-i="1"]'); ok(await pg.locator('.fb:has-text("Di cosa parla")').count() === 1, 'aiuto per iniziare');
  await pg.evaluate(async () => { const c = capCorrente(); const m = mioDi(c); m.sez.forEach((s, i) => { if (i) { s.testo = 'Testo mio ' + i; s.ok = true; } }); salva(); render(); });
  ok(await pg.locator('[data-act=co-stampa]').count() === 1, 'riassunto finale stampabile');
  await pg.evaluate(() => { S.profilo.sezioni = {}; V.tab = 'riassunto'; render(); });
  // test + premi
  await pg.click('.tab:has-text("Test")');
  ok(await pg.locator('text=Livello 1').count() >= 1 && await pg.locator('[data-act=test-nuovi]').count() === 1 && await pg.locator('[data-act=test-livello]').count() === 1, 'test: livello e pulsanti nuove domande/difficile');
  await pg.click('[data-act=inizia-test]'); ok(await pg.locator('[data-act=come-ok]').count() === 1 && await pg.locator('[data-come]').count() >= 3, 'chiede come hai studiato'); await pg.click('[data-act=come-salta]');
  for (let i = 0; i < 5; i++) {
    await pg.evaluate(() => { const c = capCorrente(), ts = V.test, q = c.test[ts.dom[ts.i]]; const corr = q.tipo === 'vf' ? (q.corretta ? 0 : 1) : q.corretta; document.querySelector('[data-act=rispondi][data-i="' + corr + '"]').click(); });
    await pg.click('[data-act=avanti]');
  }
  ok(await pg.locator('text=Tutto giusto').count() + await pg.locator('.fb.ok:has-text("punti")').count() >= 1, 'fine test: punti guadagnati');
  const pm = await pg.evaluate(() => premi()); ok(pm.test === 1 && pm.badge.includes('primo') && pm.xp > 3, 'premi: primo test, xp ' + pm.xp);
  ok(await pg.locator('[data-act=test-livello][data-d="1"]').count() === 1, 'fine test: sali di livello (>=80%)');
  // nuove domande con AI simulata (con domande-meta da scartare)
  await pg.evaluate(() => {
    FAM.ai.provider = 'compat';
    window.chiamaAI = async () => JSON.stringify({ test: [
      { tipo: 'vf', argomento: 'a', domanda: 'È vero che questo esercizio ti chiede di descrivere il Nilo?', corretta: true, spiegazione: 'x' },
      ...Array.from({ length: 12 }, (_, i) => ({ tipo: 'scelta', argomento: 'a', domanda: 'Domanda nuova ' + i + ' sul Nilo?', opzioni: ['a', 'b', 'c', 'd'], corretta: i % 4, spiegazione: 'perché sì' })),
      { tipo: 'scelta', argomento: 'a', domanda: 'Nell\'esercizio 3 devi calcolare cosa?', opzioni: ['a', 'b', 'c', 'd'], corretta: 1, spiegazione: 'x' }] });
  });
  await pg.click('[data-act=test-livello][data-d="1"]'); await pg.waitForTimeout(500);
  const t2 = await pg.evaluate(() => { const c = capCorrente(); return { lvl: c.lvl, n2: c.test.filter(q => q.d === 2).length, meta: c.test.some(q => /esercizio/i.test(q.domanda)), ts: V.test && V.test.liv, nd: V.test && V.test.dom.length }; });
  ok(t2.lvl === 2 && t2.n2 === 12 && !t2.meta && t2.ts === 2 && t2.nd === 12, 'livello 2: 12 domande valide, 2 meta scartate (' + JSON.stringify(t2) + ')');
  // filtro retroattivo su test vecchio
  const f = await pg.evaluate(() => { const c = { test: [{ domanda: 'È vero che nel tal esercizio devi rispondere a questo?', d: 1 }, { domanda: 'Il Nilo è un fiume?', d: 1 }, { domanda: 'L\'esercizio fisico fa bene?', d: 1 }] }; return idxLivello(c, 1); });
  ok(JSON.stringify(f) === '[1,2]', 'filtro meta su test già salvati ' + JSON.stringify(f));
  // altre pratica con AI simulata
  await pg.evaluate(() => { window.chiamaAI = async () => JSON.stringify({ pratica: [1, 2, 3, 4].map(i => ({ testo: 'Esercizio nuovo ' + i, soluzione: 's', indizi: ['a', 'b', 'c'] })) }); V.test = null; V.tab = 'pratica'; render(); });
  await pg.click('[data-act=crea-pratica]'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => capCorrente().pratica.length) === 6, 'altri esercizi aggiunti');
  await pg.evaluate(() => { FAM.ai.provider = 'demo'; });
  // mappa
  await pg.click('.tab:has-text("Mappa")'); await pg.click('[data-act=crea-mappa]'); await pg.waitForTimeout(300);
  const fit = await pg.evaluate(() => { const w = document.querySelector('.mappa-wrap'), s = w.querySelector('svg'); return { w: w.clientWidth, sw: +s.getAttribute('width'), sh: +s.getAttribute('height'), dh: +s.dataset.h, mz: V.mz }; });
  ok(fit.sw <= fit.w, 'mappa adattata alla larghezza (' + JSON.stringify(fit) + ')');
  await pg.click('[data-act=mappa-modifica]');
  const nodo = pg.locator('.mappa-wrap g[data-drag=nodo]').nth(1); const bb = await nodo.boundingBox();
  const before = await pg.evaluate(() => JSON.stringify(mappaCorr().mappa.nodi[1]));
  await pg.mouse.move(bb.x + 20, bb.y + 10); await pg.mouse.down(); await pg.mouse.move(bb.x + 70, bb.y + 60, { steps: 6 }); await pg.mouse.move(bb.x + 120, bb.y + 100, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(150);
  const after = await pg.evaluate(() => mappaCorr().mappa.nodi[1]);
  ok(Number.isFinite(after.px) && Number.isFinite(after.py), 'nodo trascinato: posizione salvata ' + JSON.stringify(after));
  const lab = pg.locator('.mappa-wrap g[data-drag=lab]').first(); const lb = await lab.boundingBox();
  await pg.mouse.move(lb.x + 5, lb.y + 5); await pg.mouse.down(); await pg.mouse.move(lb.x + 40, lb.y + 30, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => mappaCorr().mappa.relazioni.some(r => r.ldx || r.ldy)), 'etichetta del collegamento trascinata');
  await pg.click('[data-act=mappa-muovi][data-dx="30"]'); 
  ok(await pg.evaluate(() => V.mundo.length) >= 3, 'annulla: passi registrati');
  await pg.click('[data-act=mappa-annulla]'); await pg.click('[data-act=mappa-riordina]');
  ok(await pg.evaluate(() => !mappaCorr().mappa.nodi.some(n => 'px' in n) && !mappaCorr().mappa.relazioni.some(r => 'ldx' in r)), 'riordina da solo azzera le posizioni');
  await pg.click('[data-act=mappa-modifica]');
  // round trip import/export con posizioni
  const rt = await pg.evaluate(() => { const c = mappaCorr(); c.mappa.nodi[1].px = 300; c.mappa.nodi[1].py = 200; c.mappa.relazioni[0].ldx = 25; c.lvl = 3; premi().xp = 77; const o = pulisciDati(JSON.parse(JSON.stringify(datiEsportabili()))); const f = o.figli.find(x => x.id === S.id); const c2 = f.capitoli[0]; return { px: c2.mappa.nodi[1].px, ldx: c2.mappa.relazioni[0].ldx, lvl: c2.lvl, pr: c2.pratica.length, xp: f.premi.xp, d: c2.test[0].d, badge: f.premi.badge }; });
  ok(rt.px === 300 && rt.ldx === 25 && rt.lvl === 3 && rt.pr >= 2 && rt.xp === 77 && rt.d >= 1, 'esporta/importa conserva i nuovi dati ' + JSON.stringify(rt));
  const hostile = await pg.evaluate(() => { const o = JSON.parse(JSON.stringify(datiEsportabili())); const f = o.figli.find(x => x.capitoli.length); f.profilo.tema = 'gioco'; f.profilo.livello = 'superiori'; f.premi = { xp: '<img>', badge: ['__proto__', 'primo'], maxLiv: 99 }; f.capitoli.forEach(c => { c.pratica = [{ testo: '<script>x</script>', indizi: ['a', 'b', 'c', 'd', 'e'], ind: 99 }]; c.mappa.nodi.forEach(n => { n.px = 'zz'; }); }); const r = pulisciDati(o); const g = r.figli.find(x => x.capitoli.length); return { tema: g.profilo.tema, xp: g.premi.xp, badge: g.premi.badge, max: g.premi.maxLiv, ind: g.capitoli[0] && g.capitoli[0].pratica[0].ind, ni: g.capitoli[0] && g.capitoli[0].pratica[0].indizi.length, px: g.capitoli[0] && g.capitoli[0].mappa.nodi[1].px }; });
  ok(hostile.tema === 'calmo' && hostile.xp === 0 && JSON.stringify(hostile.badge) === '["primo"]' && hostile.max === 5 && hostile.ind === 3 && hostile.ni === 3 && hostile.px === undefined, 'import ostile neutralizzato ' + JSON.stringify(hostile));
  // brand
  ok((await pg.locator('.brand').first().innerText()).includes('AI.st.ain') && (await pg.locator('.brand').first().innerText()).includes('v0.'), 'brand AI.st.ain con versione');
  ok((await pg.title()) === 'AI.st.ain', 'titolo pagina');
  // home: traguardi + acronimo
  await pg.evaluate(() => { V.vista = 'home'; render(); });
  ok(await pg.locator('text=I tuoi traguardi').count() === 1 && await pg.locator('text=Aiuto Intelligente per lo STudio').count() === 1, 'home: traguardi e acronimo');
  // stampa: PDF
  await pg.evaluate(() => { V.vista = 'capitolo'; V.cap = S.capitoli[0].id; V.tab = 'riassunto'; document.getElementById('stampa').innerHTML = dispensaHTML(S.capitoli[0]); });
  await pg.emulateMedia({ media: 'print' });
  await pg.pdf({ path: '/tmp/s14_print.pdf', preferCSSPageSize: true, printBackground: true });
  await pg.emulateMedia({ media: 'screen' });
  // i18n arabo
  await pg.evaluate(() => { S.profilo.lingua = 'ar'; V.vista = 'home'; render(); });
  ok(await pg.evaluate(() => document.documentElement.dir) === 'rtl', 'arabo RTL ancora ok');
  console.log('ERRORI PAGINA:', errs.length ? errs : 'nessuno'); if (errs.length) fails++;
  await br.close(); console.log(fails ? 'FALLITI: ' + fails : 'TUTTO OK'); process.exit(fails ? 1 : 0);
})();
