const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 420, height: 800 } });
  const err = []; pg.on('pageerror', e => err.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLITO ') + m);
  await pg.goto('http://localhost:8766/');
  await pg.evaluate(() => localStorage.setItem('scio.usi', JSON.stringify({ g: ['2026-10-01'] })));
  await pg.reload(); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => FASE_TOUR) === 2, 'secondo giorno di uso: fase 2');
  const f1 = await pg.evaluate(() => { const f = statoVuoto(); f.profilo = { nome: 'T', livello: 'superiori', dsa: {}, sezioni: {}, metodo: {}, tema: 'calmo', fs: 1, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: .9, pin: '', colori: true }; DB.figli.push(f); S = f; V.vista = 'home'; render(); return f.id; });
  // ordine delle schede
  const tab = async (sez) => pg.evaluate(s => { S.profilo.sezioni = s; return tabsAttive().join(','); }, sez);
  ok((await tab({})).startsWith('riassunto,schema'), 'riassunto visibile: parte dal riassunto');
  ok((await tab({ riassunto: false })).startsWith('costruisci,schema'), 'riassunto nascosto: «Il mio riassunto» è la prima');
  ok((await tab({ riassunto: false, costruisci: false })).startsWith('schema,'), 'nascosti entrambi: parte dallo schema');
  await pg.evaluate(() => { S.profilo.sezioni = {}; render(); });
  const conta = async (k, da, fino) => { await pg.evaluate(([k, da, fino]) => { tourChiudi(); tourAvvia(k, { da, fino }); }, [k, da, fino]); await pg.waitForTimeout(150); const n = await pg.evaluate(() => { const e = document.querySelector('.tour-n'); return e ? e.textContent : ''; }); const t0 = await pg.evaluate(() => { const e = document.querySelector('.tour-t'); return e ? e.textContent : ''; }); await pg.evaluate(() => tourChiudi()); return { n, t0 }; };
  let r = await conta('home', 1, 1); ok(/(di|of) 5$/.test(r.n) && /Benvenuto/.test(r.t0), 'home fase 1: 5 passi, parte dal benvenuto (' + r.n + ')');
  const centrato = await pg.evaluate(() => { tourChiudi(); tourAvvia('home', { da: 1, fino: 1 }); const bx = document.querySelector('.tour-box').getBoundingClientRect(), sp = getComputedStyle(document.querySelector('.tour-spot')).display; tourChiudi(); return { sp, cx: Math.round(bx.left + bx.width / 2), vw: innerWidth }; });
  ok(centrato.sp === 'none' && Math.abs(centrato.cx - centrato.vw / 2) < 3, 'messaggio di benvenuto al centro, senza riquadro evidenziato');
  r = await conta('home', 2, 2); ok(/(di|of) 3$/.test(r.n), 'home fase 2: consigli su testo, aspetto + promemoria (' + r.n + ')');
  r = await conta('home', 3, 3); ok(/(di|of) 2$/.test(r.n), 'home fase 3: traguardi + promemoria (' + r.n + ')');
  // pagina di modifica profilo
  await pg.evaluate(id => { V.genitoriOk = true; V.edit = id; V.vista = 'setup'; render(); }, f1);
  r = await conta('setup', 1, 1); ok(/(di|of) 4$/.test(r.n) && /(Nome|Name)/.test(r.t0), 'modifica profilo fase 1: nome, DSA, sezioni da nascondere (' + r.n + ')');
  r = await conta('setup', 2, 2); ok(/(di|of) 4$/.test(r.n), 'modifica profilo fase 2: metodo, colori, PIN (' + r.n + ')');
  const sez = await pg.evaluate(() => { tourChiudi(); tourAvvia('setup', { da: 1, fino: 1 }); const out = []; for (let i = 0; i < 3; i++) { out.push(document.querySelector('.tour-t').textContent.slice(0, 30)); document.querySelector('[data-tour=avanti]').click(); } tourChiudi(); return out; });
  ok(/(Qui scegli cosa vede|Here you choose)/.test(sez[2]), 'terzo passo: funzioni che si possono nascondere');
  // statistiche
  await pg.evaluate(id => { V.statF = id; V.vista = 'stat'; render(); }, f1);
  r = await conta('stat', 1, 1); ok(/(di|of) 3$/.test(r.n), 'statistiche: 3 passi (' + r.n + ')');
  // genitori
  await pg.evaluate(() => { FAM.pin = '1234'; V.vista = 'genitori'; render(); });
  r = await conta('genitori', 1, 1); ok(/(di|of) 5$/.test(r.n), 'area genitori fase 1: figlio, modifica, statistiche, famiglia + promemoria (' + r.n + ')');
  r = await conta('genitori', 2, 2); ok(/(di|of) 4$/.test(r.n), 'area genitori fase 2: spesa, privacy, copia + promemoria (' + r.n + ')');
  // memoria delle fasi
  await pg.evaluate(() => { localStorage.removeItem('scio.tour'); tourSegna('home', 1); tourSegna('home', 2); tourSegna('home', 1); });
  ok(await pg.evaluate(() => tourLetti()[tourChiave('home')]) === 2, 'la fase vista non torna indietro');
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await b.close();
})();
