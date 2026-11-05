const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const err = []; pg.on('pageerror', e => err.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLITO ') + m);
  await pg.goto('http://localhost:8766/'); await pg.evaluate(() => localStorage.setItem('scio.tour', JSON.stringify({ home: 1 })));
  await pg.reload(); await pg.waitForTimeout(500);
  // sanitiser & analisi con dati finti
  const r = await pg.evaluate(() => {
    const A = analisiMetodo(); window.__x = 1; const base = { data: 'x', totale: 10, errati: [] };
    S.capitoli = [{ id: 'a', risultati: [
      { ...base, punti: 9, come: ['riassunto'] }, { ...base, punti: 8, come: ['riassunto'] },
      { ...base, punti: 5, come: [] }, { ...base, punti: 4, come: ['libro'] }, { ...base, punti: 5, come: [] }] }];
    const B = analisiMetodo(); const m = proponiEsperimento(B);
    S.profilo = { metodo: { chiedi: false } }; const off = metodoOn('chiedi'), on = metodoOn('confronto'); S.profilo = null;
    return { n0: A.n, dd: JSON.stringify(analisiMetodo().per), n0b: 0, top: B.per[0] && B.per[0].k, d: B.per[0] && B.per[0].d, m, off, on };
  });
  ok( r.top === 'riassunto' && r.d >= 30, 'analisi: il riassunto emerge'); ok(r.m === 'riassunto', 'esperimento proposto: ' + r.m);
  ok(r.off === false && r.on === true, 'interruttori facoltativi');
  // blocco scroll: tour
  await pg.evaluate(() => { document.body.style.minHeight = '3000px'; tourAvvia('home'); });
  await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden'), 'scroll bloccato durante il tour');
  await pg.mouse.move(500, 300); await pg.mouse.wheel(0, 800); await pg.keyboard.press('PageDown'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => window.scrollY) === 0, 'rotella e tasti non scorrono');
  await pg.evaluate(() => tourChiudi());
  ok(await pg.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'), 'scroll sbloccato alla chiusura');
  // università: grafica sobria
  await pg.evaluate(() => { S.profilo = { livello: 'universita' }; applicaTema(); });
  ok(await pg.evaluate(() => document.body.dataset.liv) === 'universita', 'grafica sobria per università');
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await b.close();
})();
