const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 420, height: 800 } });
  const err = []; pg.on('pageerror', e => err.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLITO ') + m);
  await pg.goto('http://localhost:8766/'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const f = statoVuoto(); f.profilo = { nome: 'T', livello: 'superiori', dsa: {}, sezioni: {}, metodo: {}, tema: 'calmo', fs: 1, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: .9, pin: '', colori: true }; DB.figli.push(f); S = f; FAM.ai.provider = 'demo'; V.materia = 'Matematica'; V.vista = 'nuovo-es'; V.foto = []; render(); });
  await pg.evaluate(() => preparaEsercizio()); await pg.waitForTimeout(1200);
  ok(await pg.evaluate(() => V.vista) === 'scegli-es', 'dopo le foto si apre la scelta degli esercizi');
  ok(await pg.locator('input[data-act=es-toggle]').count() === 3, 'elenco con 3 esercizi');
  ok(/(Esercizio|Exercise) 3/.test(await pg.locator(".card").nth(1).innerText()), 'numero esercizio come sul libro');
  ok(await pg.locator('[data-act=es-avvia]').isDisabled(), 'senza selezione il pulsante è disattivato');
  await pg.locator('input[data-act=es-toggle]').nth(1).click();
  ok(await pg.evaluate(() => Object.keys(V.sel).length) === 1 && /\(1\)/.test(await pg.locator('[data-act=es-avvia]').innerText()), 'spunta singola: 1 selezionato');
  await pg.locator('[data-act=es-tutti]').click();
  ok(/\(3\)/.test(await pg.locator('[data-act=es-avvia]').innerText()), 'seleziona tutti: 3');
  await pg.locator('[data-act=es-avvia]').click(); await pg.waitForTimeout(2500);
  ok(await pg.evaluate(() => V.vista) === 'esercizio' && await pg.evaluate(() => S.esercizi.length) === 3, 'creati 3 esercizi guidati');
  ok(await pg.evaluate(() => S.esercizi.map(e => e.num).join(',')) === '3,4,5', 'ordine del libro 3,4,5');
  ok(/(Esercizio|Exercise) 3/.test(await pg.locator(".card").first().innerText()), 'si parte dal primo scelto');
  await pg.evaluate(() => { const e = S.esercizi.find(x => x.id === V.es); e.finito = true; render(); });
  ok(/(Esercizio|Exercise|esercizio) 4|4/.test(await pg.locator('[data-act=es-prossimo]').innerText()), 'a fine esercizio propone il prossimo (4)');
  // caso singolo: parte diretto
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await b.close();
})();
