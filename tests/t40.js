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
  // v0.42: numero e serie restano dopo il riavvio, e ogni esercizio usa solo la sua foto
  await pg.evaluate(() => salva()); await pg.reload(); await pg.waitForTimeout(500);
  const tenuti = await pg.evaluate(() => { const e = DB.figli[DB.figli.length - 1].esercizi; return e.length === 3 && e.map(x => x.num).join(',') === '3,4,5' && !!e[0].serie && e[0].serie === e[2].serie; });
  ok(tenuti, 'numero e serie restano dopo il riavvio');
  // con la chiave vera: per ogni esercizio parte solo la foto della sua pagina
  const inviate = await pg.evaluate(async () => {
    S = DB.figli[DB.figli.length - 1]; FAM.ai.provider = 'anthropic'; V.materia = 'Matematica'; V.vista = 'nuovo-es'; V.foto = ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'];
    const viste = [];
    window.chiediJSON = async (sys, testo, img, schema) => { if (schema === SCHEMA_ELENCO) return { esercizi: [{ numero: '7', testo: 'Calcola 2+2', foto: 1 }, { numero: '12', testo: 'Calcola 3·3', foto: 2 }, { numero: '13', testo: 'Calcola 5−1', foto: 9 }] }; viste.push(img.map(x => x.slice(-3)).join('+')); return { richiesta: 'r', passi: [{ titolo: 't', domanda: 'd', obiettivo: 'o', indizi: ['a', 'b', 'c'], esempio_simile: 'e' }] }; };
    await preparaEsercizio(); V.sel = { 0: true, 1: true, 2: true }; await avviaEsercizi(); return viste.join(' | ');
  });
  ok(inviate === 'AAA | BBB | AAA+BBB', 'una foto per esercizio; se la pagina non è chiara le manda tutte (' + inviate + ')');
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await b.close();
})();
