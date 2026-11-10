const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 400, height: 800 } });
  const err = []; pg.on('pageerror', e => err.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLITO ') + m);
  await pg.goto('http://localhost:8766/'); await pg.waitForTimeout(400);
  // nessun testo nuovo resta in inglese nelle altre lingue (a parte parole uguali nelle due lingue)
  const buchi = await pg.evaluate(() => { const out = {}; ['de', 'fr', 'es', 'ro', 'sq', 'ar', 'zh'].forEach(l => { out[l] = Object.keys(I18N.en).filter(k => I18N[l][k] === I18N.en[k] && I18N.en[k] !== I18N.it[k] && I18N.en[k].length > 12).length; }); return out; });
  ok(Object.values(buchi).every(n => n === 0), 'nessuna frase rimasta in inglese: ' + JSON.stringify(buchi));
  const segn = await pg.evaluate(() => { const p = s => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(); const out = []; LINGUE_ORD.forEach(l => Object.keys(I18N.it).forEach(k => { if (p(I18N[l][k]) !== p(I18N.it[k])) out.push(l + ':' + k); })); return out; });
  ok(segn.length === 0, 'segnaposto {…} uguali in tutte le lingue ' + segn.slice(0, 8).join(' '));
  // giro delle schermate in ogni lingua: nessun errore, nessuna chiave nuda
  await pg.evaluate(() => { const f = statoVuoto(); f.profilo = { nome: 'T', livello: 'superiori', dsa: {}, sezioni: {}, metodo: {}, tema: 'calmo', fs: 1, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: .9, pin: '', colori: true }; f.materie = ['Storia']; DB.figli.push(f); S = f; FAM.ai.provider = 'demo'; V.materia = 'Storia'; V.vista = 'nuovo-cap'; V.foto = []; render(); return preparaCapitolo(); });
  await pg.waitForTimeout(1500);
  const nude = [];
  for (const l of ['de', 'fr', 'es', 'ro', 'sq', 'ar', 'zh']) {
    await pg.evaluate(l => { S.profilo.lingua = l; FAM.lingua = l; if (typeof impostaLingua === 'function') impostaLingua(l); else LINGUA_CORRENTE = l; }, l);
    for (const v of ['home', 'capitolo', 'aspetto', 'genitori', 'stat', 'setup']) {
      await pg.evaluate(v => { V.genitoriOk = true; V.statF = S.id; V.edit = v === 'setup' ? S.id : null; V.cap = S.capitoli[0].id; V.vista = v; render(); }, v);
      for (const tb of v === 'capitolo' ? await pg.evaluate(() => tabsAttive()) : [null]) {
        if (tb) await pg.evaluate(t => { V.tab = t; render(); }, tb);
        const tx = await pg.locator('#app').innerText();
        const m = tx.match(/\b(?:tour|gi|ts|err|co|or|pr|met|esp|vn|costi|dsaq|dq|es|fb|bk|upd)_[a-z0-9_]+\b/g);
        if (m) nude.push(l + '/' + v + ':' + m[0]);
      }
    }
  }
  ok(nude.length === 0, 'nessuna chiave senza testo ' + nude.slice(0, 6).join(' '));
  // infanzia: «Come comincia?» solo in italiano e inglese (le parole sono in quelle lingue)
  const n = await pg.evaluate(() => { S.profilo.livello = 'infanzia'; S.profilo.lingua = 'de'; LINGUA_CORRENTE = 'de'; V.vista = 'home'; render(); const a = document.querySelectorAll('.gi-tile').length; S.profilo.lingua = 'it'; LINGUA_CORRENTE = 'it'; render(); return a + '/' + document.querySelectorAll('.gi-tile').length; });
  ok(n === '8/9', 'giochi: 8 in tedesco, 9 in italiano (' + n + ')');
  ok(err.length === 0, 'errori pagina: ' + err.join('|'));
  await b.close();
})();
