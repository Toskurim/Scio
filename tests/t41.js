const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 420, height: 800 } });
  const err = []; pg.on('pageerror', e => err.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLITO ') + m);
  await pg.goto('http://localhost:8766/'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const f = statoVuoto(); f.profilo = { nome: 'T', livello: 'superiori', dsa: {}, sezioni: {}, metodo: {}, tema: 'calmo', fs: 1, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: .9, pin: '', colori: true }; DB.figli.push(f); S = f; FAM.ai.provider = 'demo'; V.materia = 'Matematica'; V.vista = 'nuovo-es'; V.foto = []; render(); });
  ok(await pg.evaluate(() => sysValuta('X', 'Matematica').includes('Risposta esatta!') && sysValuta('X', 'Geometria').includes('Risposta esatta!') && !sysValuta('X', 'Storia').includes('Risposta esatta!')), 'regole di matematica solo per le materie matematiche');
  // guidato: passo giusto e passo sbagliato mostrano un esito chiaro
  await pg.evaluate(() => preparaEsercizio()); await pg.waitForTimeout(900);
  await pg.locator('input[data-act=es-toggle]').first().click(); await pg.locator('[data-act=es-avvia]').click(); await pg.waitForTimeout(1500);
  await pg.fill('#idea', 'ok'); await pg.locator('[data-act=controlla]').click(); await pg.waitForTimeout(900);
  ok(/Ci sei quasi|Almost there/.test(await pg.locator('.fb.warn').innerText()), 'risposta incompleta: «Ci sei quasi»');
  await pg.fill('#idea', 'Devo trovare il valore di x che annulla la frazione'); await pg.locator('[data-act=controlla]').click(); await pg.waitForTimeout(900);
  ok(/✓.*(Risposta esatta|Correct answer)/.test(await pg.locator('.fb.ok').first().innerText()), 'risposta giusta: «✓ Risposta esatta!»');
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await b.close();
})();
