const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 400, height: 800 } });
  const err = []; pg.on('pageerror', e => err.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLITO ') + m);
  await pg.goto('http://localhost:8766/'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const f = statoVuoto(); const a = aspettoConsigliato('infanzia', {}); f.profilo = { nome: 'Leo', livello: 'infanzia', dsa: {}, sezioni: {}, metodo: {}, tema: a.tema, fs: a.fs, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: .9, pin: '', colori: true }; DB.figli.push(f); S = f; V.vista = 'home'; render(); });
  ok(await pg.evaluate(() => LIVELLI[0] === 'infanzia' && temiPer('infanzia')[0] === 'gioco'), 'livello infanzia con tema gioco');
  ok(await pg.locator('.gi-tile').count() === 9, 'home infanzia: 9 giochi, niente materie');
  ok(await pg.locator('[data-act=apri-materia],[data-act=aggiungi-materia]').count() === 0, 'niente capitoli né materie');
  // ogni gioco, a ogni difficoltà, ha sempre una e una sola risposta giusta e opzioni tutte diverse
  const bad = await pg.evaluate(() => { const out = []; GI.forEach(g => { for (let l = 1; l <= 3; l++) for (let k = 0; k < 300; k++) { const q = giDomanda(g, l); const n = q.opz.filter(o => o.ok).length, d = new Set(q.opz.map(o => o.h)).size; if (n !== 1 || d !== q.opz.length || q.opz.length < 2 || !q.dire || /\{|undefined/.test(q.dire)) { out.push(g + l + ':' + n + '/' + q.opz.length + ' ' + q.dire); break; } } }); return out; });
  ok(bad.length === 0, 'domande valide in tutti i giochi e livelli ' + bad.join(' | '));
  // una partita intera: prima una sbagliata, poi tutte giuste
  await pg.locator('[data-act=gi-apri][data-g=conta]').click(); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => V.vista) === 'gioco' && await pg.locator('.gi-opt').count() === 3, 'gioco aperto con 3 scelte grandi');
  const lato = await pg.locator('.gi-opt').first().boundingBox(); ok(lato.width >= 100 && lato.height >= 100, 'pulsanti grandi (' + Math.round(lato.width) + '×' + Math.round(lato.height) + ')');
  const sbagliata = await pg.evaluate(() => V.gi.q.opz.findIndex(o => !o.ok));
  await pg.locator('.gi-opt').nth(sbagliata).click(); await pg.waitForTimeout(100);
  ok(await pg.locator('.gi-opt.no').count() === 1 && await pg.evaluate(() => V.gi.i) === 0, 'risposta sbagliata: si riprova, senza punizioni');
  for (let i = 0; i < 6; i++) { const g = await pg.evaluate(() => V.gi.q.opz.findIndex(o => o.ok)); await pg.locator('.gi-opt').nth(g).click(); await pg.waitForTimeout(1700); }
  ok(await pg.evaluate(() => V.gi.fine && V.gi.stelle) === 5, 'fine partita: 5 stelle su 6 (la prima era sbagliata)');
  ok(await pg.evaluate(() => S.giochi.conta.fatte === 1 && S.giochi.conta.dom === 6 && S.giochi.conta.giuste === 5 && S.giochi.conta.liv === 2), 'risultato salvato e difficoltà salita a 2');
  await pg.evaluate(() => salva()); await pg.reload(); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => { const f = DB.figli[DB.figli.length - 1]; return f.profilo.livello === 'infanzia' && f.giochi.conta && f.giochi.conta.giuste === 5; }), 'dopo il riavvio i dati dei giochi restano');
  await pg.evaluate(() => { S = DB.figli[DB.figli.length - 1]; V.genitoriOk = true; V.statF = S.id; V.vista = 'stat'; render(); });
  ok(/83%/.test(await pg.locator('#app').innerText()), 'statistiche genitori: 83% giuste al primo colpo');
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await pg.evaluate(() => { V.vista = 'home'; render(); }); await pg.screenshot({ path: '/tmp/claude-0/gi1.png' });
  await pg.evaluate(() => { giApri('dipiu'); render(); }); await pg.screenshot({ path: '/tmp/claude-0/gi2.png' });
  await pg.evaluate(() => { giApri('forme'); V.gi.liv = 3; giNuova(); render(); }); await pg.screenshot({ path: '/tmp/claude-0/gi3.png' });
  await b.close();
})();
