const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 800 } }); const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLITO ') + m);
  await pg.goto('http://localhost:8766/'); await pg.waitForTimeout(600);
  // errori chiari
  const m = await pg.evaluate(() => [erroreAnthropic(401, '{"error":{"type":"authentication_error","message":"invalid x-api-key"}}'), erroreAnthropic(400, '{"error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}'), erroreAnthropic(429, ''), erroreAnthropic(529, '{"error":{"type":"overloaded_error"}}'), erroreAnthropic(404, ''), erroreAnthropic(418, 'tè')]);
  ok(/chiave API non è valida|API key is not valid/.test(m[0]), '401 → chiave non valida');
  ok(/credito|credit/i.test(m[1]), 'credito finito riconosciuto anche con codice 400');
  ok(/Troppe|Too many/.test(m[2]) && /occupato|busy/.test(m[3]) && /modello|model/i.test(m[4]), '429 / 529 / 404 chiari');
  ok(/^Errore 418/.test(m[5]), 'altri errori: codice e testo');
  // rete assente
  await ctx.route('https://api.anthropic.com/**', r => r.abort());
  const rete = await pg.evaluate(() => chiamaAI('s', 'x', [], { provider: 'anthropic', key: 'sk-ant-x' }).then(() => 'ok', e => e.message));
  ok(/connessione|connection|internet/i.test(rete), 'rete assente: messaggio chiaro (' + rete.slice(0, 40) + ')');
  // formato chiave
  await pg.evaluate(() => { FAM.pin = ''; V.vista = 'fam'; render(); });
  await pg.selectOption('#prov', 'anthropic'); await pg.fill('#chiave', 'abc123'); await pg.click('[data-act=prova-ai]'); await pg.waitForTimeout(300);
  ok(/sk-ant-/.test(await pg.locator('#esitoprova').innerText()), 'chiave senza «sk-ant-»: avviso di formato');
  ok(await pg.locator('a[href="guida-chiave.html"]').count() >= 1, 'link alla guida nelle impostazioni');
  // banner demo con link
  await pg.evaluate(() => { const f = statoVuoto(); f.profilo = { nome: 'T', livello: 'superiori', dsa: {}, sezioni: {}, metodo: {}, tema: 'calmo', fs: 1, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: .9, pin: '', colori: true }; DB.figli.push(f); S = f; FAM.ai = aiVuoto(); V.vista = 'home'; render(); });
  ok(await pg.locator('.fb.warn a[href="guida-chiave.html"]').count() === 1, 'banner demo con link alla guida');
  // promemoria copia
  ok(await pg.locator('#bk-card').count() === 0, 'nessun promemoria se non ci sono capitoli');
  await pg.evaluate(() => { S.capitoli.push({ id: 'c1', data: new Date().toISOString(), materia: 'Storia', titolo: 'Prova', risultati: [], test: [] }); FAM.ultimoBackup = ''; render(); });
  ok(await pg.locator('#bk-card').count() === 1, 'promemoria copia se ci sono capitoli e nessuna copia');
  await pg.click('[data-act=bk-dopo]'); ok(await pg.locator('#bk-card').count() === 0, '«Più tardi» lo nasconde');
  await pg.evaluate(() => { localStorage.removeItem('scio.bk-snooze'); FAM.ultimoBackup = new Date().toISOString(); render(); });
  ok(await pg.locator('#bk-card').count() === 0, 'copia recente: nessun promemoria');
  // avviso versione nuova
  await pg.evaluate(() => mostraAggiorna());
  ok(await pg.locator('#upd button').count() === 2, 'avviso di versione nuova con due pulsanti');
  await pg.click('[data-upd=dopo]'); ok(await pg.locator('#upd').count() === 0, '«Più tardi» chiude l\'avviso');
  // la guida si apre senza errori e senza scroll orizzontale
  const pg2 = await ctx.newPage(); pg2.on('pageerror', e => err.push(e.message)); await pg2.route('https://api.anthropic.com/**', r => r.abort());
  await pg2.goto('http://localhost:8766/guida-chiave.html'); await pg2.waitForTimeout(500);
  ok(await pg2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'guida: nessuno scroll orizzontale a 420 px');
  ok(await pg2.locator('.step').count() === 5, 'guida: 5 passaggi');
  ok(await pg2.locator('figure:not([hidden])').count() === 0, 'guida: senza immagini le figure restano nascoste');
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await b.close();
})();
