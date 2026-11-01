'use strict';
/* ===== Scio v0.7 — app web installabile (PWA) ===== */
/* Anti-clickjacking: Scio non si lascia incorniciare in altre pagine. */
if (window.top !== window.self) { document.documentElement.textContent = ''; throw new Error('Scio non può essere aperto dentro un\'altra pagina.'); }
const VERSIONE = '0.7';
const LS = 'scio.v0.3';
const LS_V2 = 'scio.v0.2';
const LS_VECCHIO = 'scio.v0.1';
/* Servizi "compatibili OpenAI": stesso formato, cambia solo l'indirizzo. */
const PRESET = {
  ollama:   { nome: 'Ollama sul mio PC (gratis, privato)', url: 'http://localhost:11434/v1', modello: 'gemma4:26b', chiave: false },
  lmstudio: { nome: 'LM Studio sul mio PC (gratis, privato)', url: 'http://localhost:1234/v1', modello: '', chiave: false },
  gemini:   { nome: 'Google Gemini (chiave gratuita di AI Studio)', url: 'https://generativelanguage.googleapis.com/v1beta/openai', modello: 'gemini-2.5-flash', chiave: true },
  groq:     { nome: 'Groq', url: 'https://api.groq.com/openai/v1', modello: '', chiave: true }
};
const DSA = {
  discalculia: 'Discalculia: spiegazioni di numeri e calcoli passo passo, un passaggio per volta, con esempi concreti e visivi prima delle formule; numeri piccoli negli esempi; nei test valuta il ragionamento e non la velocità o il calcolo mentale.',
  dislessia: 'Dislessia: frasi brevi (al massimo 15 parole), una sola idea per frase, parole semplici, elenchi puntati, parole chiave evidenziate con **doppio asterisco**; evita incisi e periodi lunghi.',
  disortografia: 'Disortografia: nei test non penalizzare gli errori di scrittura; se serve, spiega la regola ortografica con un esempio; evita domande che chiedono di scrivere parole difficili.',
  disgrafia: 'Disgrafia: preferisci risposte a scelta o molto brevi; poche domande a risposta scritta.'
};
const TEMI = { calmo: 'Calmo', gioco: 'Gioco', notte: 'Notte' };
const MATERIE = ['Italiano','Storia','Geografia','Scienze','Matematica','Fisica','Chimica','Biologia','Inglese','Latino','Greco','Filosofia','Scienze umane','Arte','Tecnologia','Musica','Educazione civica','Religione','Altro'];

/* ===== Sicurezza ===== */
function buf2b64(buf) { let b = ''; new Uint8Array(buf).forEach(x => b += String.fromCharCode(x)); return btoa(b); }
function b642buf(t) { const b = atob(t), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
function uguali(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
/* La chiave API è cifrata (AES-GCM) con una chiave del dispositivo che il browser non permette di esportare. */
function apriCassaforte() { return new Promise((ok, ko) => { const r = indexedDB.open('scio-sec', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function chiaveDispositivo() {
  const db = await apriCassaforte();
  try {
    let k = await new Promise((ok, ko) => { const q = db.transaction('k').objectStore('k').get('aes'); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
    if (!k) {
      k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await new Promise((ok, ko) => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(k, 'aes'); t.oncomplete = ok; t.onerror = () => ko(t.error); });
    }
    return k;
  } finally { db.close(); }
}
async function cifra(testo) { const k = await chiaveDispositivo(); const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(testo)); return 'v1.' + buf2b64(iv) + '.' + buf2b64(ct); }
async function decifra(c) { const [v, iv, ct] = String(c).split('.'); if (v !== 'v1') throw new Error('formato'); const k = await chiaveDispositivo(); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(b642buf(iv)) }, k, b642buf(ct))); }
async function chiavePiena(a) {
  if (a.key) return a.key;
  if (!a.kc) return '';
  try { return await decifra(a.kc); } catch (e) { throw new Error('Non riesco a leggere la chiave salvata (succede se i dati del browser sono stati cancellati o se la copia viene da un altro dispositivo). Reinseriscila in Genitori › Impostazioni.'); }
}
function haChiave(a) { return !!(a && (a.key || a.kc)); }
/* PIN: salvato solo come impronta (PBKDF2 con sale), mai in chiaro. */
async function hashPin(pin, sale) {
  sale = sale || crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: 150000 }, km, 256);
  return 'p1.' + buf2b64(sale) + '.' + buf2b64(bits);
}
async function verificaPin(pin, memo) {
  if (String(memo).startsWith('p1.')) return uguali(await hashPin(pin, new Uint8Array(b642buf(memo.split('.')[1]))), memo);
  return uguali(String(pin), String(memo));
}
const PIN_BANALI = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212', '2580', '0123', '12345', '123456', '000000', '111111'];
function pinBanale(p) { return PIN_BANALI.includes(p); }
function lucchetto(id) { try { return JSON.parse(localStorage.getItem('scio.lock' + (id ? '.' + id : ''))) || { n: 0, fino: 0 }; } catch (e) { return { n: 0, fino: 0 }; } }
function lucchettoSalva(l, id) { try { localStorage.setItem('scio.lock' + (id ? '.' + id : ''), JSON.stringify(l)); } catch (e) { /* non importa */ } }
/* Indirizzi AI consentiti: gli stessi ammessi dalla politica di sicurezza della pagina. */
function urlConsentito(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'http:') return x.hostname === 'localhost' || x.hostname === '127.0.0.1';
    return x.protocol === 'https:' && ['generativelanguage.googleapis.com', 'api.groq.com'].includes(x.hostname);
  } catch (e) { return false; }
}
/* ===== Dati: una famiglia, più figli ===== */
function aiVuoto() { return { provider: 'demo', key: '', kc: '', model: '', preset: 'ollama', url: '' }; }
function statoVuoto() { return { id: uid(), profilo: null, capitoli: [], esercizi: [], materie: [], rip: {}, verifiche: [], controlli: 0 }; }
function famVuota() { const l = String(navigator.language || 'it').slice(0, 2).toLowerCase(); return { pin: '', ai: aiVuoto(), lingua: LINGUE[l] ? l : 'it', ultimoBackup: '' }; }
function caricaDB() {
  try {
    const r = JSON.parse(localStorage.getItem(LS));
    if (r && r.v === 3 && r.fam && Array.isArray(r.figli)) { r.fam.ai = Object.assign(aiVuoto(), r.fam.ai || {}); r.figli = r.figli.map(f => Object.assign(statoVuoto(), f)); return r; }
  } catch (e) { /* si prova la versione precedente */ }
  try {
    const r = JSON.parse(localStorage.getItem(LS_V2) || localStorage.getItem(LS_VECCHIO));
    if (r && typeof r === 'object' && r.profilo) {
      const fam = famVuota(); fam.pin = r.profilo.pin || ''; fam.ai = Object.assign(aiVuoto(), r.profilo.ai || {}); fam.ultimoBackup = r.ultimoBackup || '';
      const f = Object.assign(statoVuoto(), r); delete f.ultimoBackup; f.profilo = Object.assign({}, r.profilo); delete f.profilo.pin; delete f.profilo.ai;
      return { v: 3, fam, figli: [f] };
    }
  } catch (e) { /* dati non leggibili: si riparte da zero */ }
  return { v: 3, fam: famVuota(), figli: [] };
}
let DB = caricaDB();
let FAM = DB.fam;
let S = statoVuoto();
function vistaIniziale() {
  if (!FAM.pin) return 'fam';
  if (!DB.figli.length) return 'setup';
  if (DB.figli.length === 1 && !DB.figli[0].profilo.pin) { S = DB.figli[0]; return 'home'; }
  return 'scelta';
}
let V = { vista: vistaIniziale(), tab: 'riassunto', foto: [], busy: false, errore: '', test: null, es: null, bozza: '', cap: null, genitoriOk: false, edit: null, voce: false, lettura: null };
function attiva(id) {
  const f = DB.figli.find(x => x.id === id); if (!f) return false;
  fermaVoce(); S = f; V.vista = 'home'; V.materia = ''; V.cap = null; V.es = null; V.test = null; V.voce = false; V.pinFiglio = null; V.genitoriOk = false; V.controllo = null; V.genRiass = null; return true;
}
function salva() {
  try { localStorage.setItem(LS, JSON.stringify(DB)); return true; }
  catch (e) { toast(t('spazio_pieno')); return false; }
}

/* Copia dei dati: mai chiave API né PIN dentro il file. */
function datiEsportabili() {
  const c = JSON.parse(JSON.stringify(DB));
  c.fam.pin = ''; if (c.fam.ai) { delete c.fam.ai.key; delete c.fam.ai.kc; }
  c.figli.forEach(f => { if (f.profilo) f.profilo.pin = ''; });
  return c;
}
/* Ripristino: si ricostruisce tutto da zero, solo campi noti e tipi corretti (un file manomesso non può inserire altro). */
function pulisciDati(o) {
  const MAXS = 60000;
  const rip = (x, d) => {
    if (d > 8) return null;
    if (typeof x === 'string') return x.slice(0, MAXS);
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    if (typeof x === 'boolean' || x === null) return x;
    if (Array.isArray(x)) return x.slice(0, 3000).map(v => rip(v, d + 1));
    if (typeof x === 'object') { const r = {}; Object.keys(x).slice(0, 400).forEach(k => { if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') r[k] = rip(x[k], d + 1); }); return r; }
    return null;
  };
  const p = rip(o, 0);
  if (!p || typeof p !== 'object') throw new Error('non valido');
  const A = x => Array.isArray(x) ? x : [];
  const Tx = (x, m) => (typeof x === 'string' ? x : x == null || typeof x === 'object' ? '' : String(x)).slice(0, m || MAXS);
  const N = x => (typeof x === 'number' && isFinite(x) ? x : 0);
  const R = (x, a, b, def) => (typeof x === 'number' && x >= a && x <= b ? x : def);
  const ID = x => Tx(x, 40).replace(/[^A-Za-z0-9_-]/g, '') || uid();
  const L = (x, m) => A(x).map(v => Tx(v, m));
  const DATA = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x)) ? String(x) : '';
  const grezzi = Array.isArray(p.figli) ? p.figli : (p.profilo && typeof p.profilo === 'object' ? [p] : null);
  if (!grezzi) throw new Error('non valido');
  const figli = grezzi.filter(f => f && typeof f === 'object' && f.profilo && typeof f.profilo === 'object').slice(0, 12).map(c => {
    const pr = c.profilo;
    const profilo = { nome: Tx(pr.nome, 60), livello: pr.livello === 'media' ? 'media' : 'superiori', dsa: {}, tema: TEMI[pr.tema] ? pr.tema : 'calmo', fs: R(pr.fs, 0.8, 2, 1), colori: !!pr.colori, lingua: LINGUE[pr.lingua] ? pr.lingua : 'it', font: ['tema', 'lexend', 'andika', 'atkinson', 'sistema'].includes(pr.font) ? pr.font : 'tema', lh: R(pr.lh, 1.3, 2.4, 0), ls: R(pr.ls, 0, 0.2, 0), ws: R(pr.ws, 0, 0.4, 0), vel: R(pr.vel, 0.5, 1.5, 0.9), pin: '' };
    Object.keys(DSA).forEach(k => { if (pr.dsa && pr.dsa[k] === true) profilo.dsa[k] = true; });
    const capitoli = A(c.capitoli).filter(x => x && typeof x === 'object').slice(0, 500).map(x => ({
      id: ID(x.id), data: Tx(x.data, 40), materia: Tx(x.materia, 60), focus: Tx(x.focus, 300), titolo: Tx(x.titolo, 300), inventario: L(x.inventario, 500), avvisi: L(x.avvisi, 800),
      riassunto_breve: L(x.riassunto_breve, 1500), riassunto_completo: Tx(x.riassunto_completo),
      schema: { radice: Tx(x.schema && x.schema.radice, 300), rami: A(x.schema && x.schema.rami).filter(r => r && typeof r === 'object').map(r => ({ titolo: Tx(r.titolo, 300), punti: L(r.punti, 800) })) },
      spiegazioni: A(x.spiegazioni).filter(s => s && typeof s === 'object').map(s => ({ concetto: Tx(s.concetto, 300), spiegazione: Tx(s.spiegazione), esempio: Tx(s.esempio) })),
      glossario: A(x.glossario).filter(g => g && typeof g === 'object').map(g => ({ termine: Tx(g.termine, 300), definizione: Tx(g.definizione, 3000) })),
      test: A(x.test).filter(q => q && typeof q === 'object').map(q => ({ tipo: q.tipo === 'vf' ? 'vf' : 'scelta', argomento: Tx(q.argomento, 300), domanda: Tx(q.domanda, 2000), opzioni: L(q.opzioni, 800), corretta: typeof q.corretta === 'boolean' ? q.corretta : N(q.corretta), spiegazione: Tx(q.spiegazione, 3000) })),
      risultati: A(x.risultati).filter(r => r && typeof r === 'object').map(r => ({ data: Tx(r.data, 40), punti: N(r.punti), totale: N(r.totale) || 1, errati: L(r.errati, 300) }))
    }));
    const esercizi = A(c.esercizi).filter(e => e && typeof e === 'object').slice(0, 500).map(e => ({
      id: ID(e.id), data: Tx(e.data, 40), materia: Tx(e.materia, 60), richiesta: Tx(e.richiesta, 5000),
      passi: A(e.passi).filter(x => x && typeof x === 'object').map(x => ({ titolo: Tx(x.titolo, 300), domanda: Tx(x.domanda, 3000), obiettivo: Tx(x.obiettivo, 3000), indizi: L(x.indizi, 3000), esempio_simile: Tx(x.esempio_simile, 3000) })),
      i: N(e.i), indizi: N(e.indizi), indiziTotali: N(e.indiziTotali), fatti: A(e.fatti).filter(x => x && typeof x === 'object').map(x => ({ i: N(x.i), risposta: Tx(x.risposta, 3000) })), finito: !!e.finito
    }));
    const ripetizioni = {};
    if (c.rip && typeof c.rip === 'object') Object.keys(c.rip).slice(0, 3000).forEach(k => { const r = c.rip[k]; if (/^[A-Za-z0-9_-]{1,40}\|\d{1,4}$/.test(k) && r && typeof r === 'object' && DATA(r.next)) ripetizioni[k] = { b: Math.max(0, Math.min(6, Math.floor(N(r.b)))), next: DATA(r.next) }; });
    const verifiche = A(c.verifiche).filter(v => v && typeof v === 'object' && DATA(v.data)).slice(0, 200).map(v => ({ id: ID(v.id), materia: Tx(v.materia, 60), data: DATA(v.data), argomento: Tx(v.argomento, 120) }));
    return { id: ID(c.id), profilo, capitoli, esercizi, materie: L(c.materie, 60).filter(m => m.trim()), rip: ripetizioni, verifiche, controlli: Math.max(0, Math.floor(N(c.controlli))) };
  });
  const fam = famVuota();
  if (p.fam && typeof p.fam === 'object' && LINGUE[p.fam.lingua]) fam.lingua = p.fam.lingua;
  return { v: 3, fam, figli };
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function coloriOn() { return !!(S.profilo && S.profilo.colori); }
function md(s) {
  const col = coloriOn();
  return esc(s)
    .replace(/\[\[([dcp]):(.+?)\]\]/g, (m, k, x) => '<mark class="' + (col ? 'm-' + k : '') + '">' + x + '</mark>')
    .replace(/\*\*(.+?)\*\*/g, (m, x) => '<mark class="' + (col ? 'm-c' : '') + '">' + x + '</mark>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\n/g, '<br>').replace(/(<\/h3>)<br>/g, '$1');
}
function legendaColori() {
  return coloriOn() ? '<div class="legenda" role="note"><b>Legenda dei colori:</b> <mark class="m-c">concetti e definizioni</mark> <mark class="m-d">date e numeri da ricordare</mark> <mark class="m-p">nomi, luoghi e termini tecnici</mark></div>' : '';
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }
function lg() { return (['genitori', 'fam', 'setup', 'scelta'].includes(V.vista) || !S.profilo) ? (FAM.lingua || 'it') : (S.profilo.lingua || 'it'); }
function applicaTema() {
  const p = S.profilo, b = document.body, r = document.documentElement;
  b.setAttribute('data-tema', p && TEMI[p.tema] ? p.tema : 'calmo');
  r.style.setProperty('--fs', p && p.fs ? p.fs : 1);
  const set = (k, v) => { if (v) b.style.setProperty(k, v); else b.style.removeProperty(k); };
  set('--font', p && FONT_STACK[p.font]); set('--lh', p && p.lh); set('--ls', p && p.ls ? p.ls + 'em' : ''); set('--ws', p && p.ws ? p.ws + 'em' : '');
  const l = lg(); LINGUA_CORRENTE = l; r.lang = l; r.dir = l === 'ar' ? 'rtl' : 'ltr';
}
function consigliato(livello, dsa) {
  if (dsa && (dsa.dislessia || dsa.discalculia || dsa.disortografia || dsa.disgrafia)) return 'calmo';
  return livello === 'media' ? 'gioco' : 'calmo';
}

/* ===== Collegamento all'AI ===== */
function profiloTesto() {
  const p = S.profilo;
  const dsa = Object.keys(DSA).filter(k => p.dsa && p.dsa[k]).map(k => DSA[k]);
  return 'Studente: ' + p.nome + ', ' + (p.livello === 'media' ? 'scuola media (11-13 anni)' : 'scuola superiore (14-18 anni)') + '.\n' +
    (dsa.length ? 'Adattamenti obbligatori per DSA:\n- ' + dsa.join('\n- ') : 'Nessun adattamento DSA particolare.') +
    (p.colori
      ? '\nEvidenziazione a colori, SOLO in riassunto_breve e riassunto_completo: racchiudi tra [[c:...]] i concetti e le definizioni chiave, tra [[d:...]] le date, i numeri, le quantità e le formule da ricordare, tra [[p:...]] i nomi di persone, i luoghi e i termini tecnici. Non usare il doppio asterisco. Non evidenziare più di un sesto del testo.'
      : '\nEvidenzia le parole chiave con **doppio asterisco** (un solo tipo di evidenziazione, senza colori diversi).') +
    (p.lingua && p.lingua !== 'it' ? '\nLINGUA: il libro è in italiano ma lo studente studia meglio in ' + LINGUE_NOME_IT[p.lingua] + '. Scrivi TUTTO il materiale (riassunti, schema, spiegazioni, glossario, test e feedback) in ' + LINGUE_NOME_IT[p.lingua] + '; i termini tecnici, i nomi propri e le parole chiave del libro compaiono SEMPRE anche in italiano tra parentesi, perché la verifica a scuola sarà in italiano. Nel glossario il campo "termine" è in italiano con la traduzione tra parentesi.' : '') +
    '\nUsa un linguaggio adatto all\'età, sempre incoraggiante, mai giudicante.';
}
async function chiamaAI(system, testo, immagini, cfg, json) {
  const a = cfg || FAM.ai || {};
  const compat = a.provider === 'compat';
  if (a.provider === 'demo' || (!haChiave(a) && !compat)) throw new Error('NODEMO');
  if (compat && !a.url) throw new Error('Manca l\'indirizzo del servizio (Area genitori › Impostazioni).');
  if (compat && !urlConsentito(a.url)) throw new Error('Indirizzo non consentito: per sicurezza Scio parla solo con il PC di casa (localhost), Gemini e Groq. Scegli uno dei servizi dell\'elenco.');
  const chiave = await chiavePiena(a);
  if (a.provider === 'anthropic') {
    const content = (immagini || []).map(u => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: u.split(',')[1] } }));
    content.push({ type: 'text', text: testo });
    const corpo = Object.assign({ model: a.model || 'claude-haiku-5-5', max_tokens: json ? 16000 : 8000, system: json ? system.replace(/Rispondi SOLO con (un )?JSON( valido)?(, senza testo prima o dopo, con questa struttura)?:?/g, 'Struttura dei dati da consegnare:') + '\n\nConsegna il risultato chiamando lo strumento "consegna" e compila OGNI campo separatamente: testo nei campi di testo, elenchi negli elenchi. Non scrivere MAI JSON o nomi di campo dentro un campo di testo.' : system, messages: [{ role: 'user', content: content }] },
      json ? { tools: [{ name: 'consegna', description: 'Consegna il risultato strutturato', input_schema: (typeof json === 'object' ? json : { type: 'object', additionalProperties: true }) }], tool_choice: { type: 'tool', name: 'consegna' } } : {});
    const chiama = c => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(c)
    });
    /* temperatura 0: a parità di foto, risultati il più possibile uguali tra una generazione e l'altra */
    let r = await chiama(Object.assign({ temperature: 0 }, corpo));
    if (!r.ok && r.status === 400) { const t0 = await r.clone().text(); if (/temperature/i.test(t0)) r = await chiama(corpo); }
    if (!r.ok) throw new Error('Errore ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    if (json) {
      if (j.stop_reason === 'max_tokens') throw new Error('La risposta è diventata troppo lunga e si è interrotta. Usa meno foto alla volta oppure scrivi un "Focus" per limitare gli argomenti.');
      const tu = (j.content || []).find(c => c.type === 'tool_use');
      if (tu && tu.input) return JSON.stringify(tu.input);
    }
    return (j.content || []).map(c => c.text || '').join('');
  }
  const content = [{ type: 'text', text: testo }].concat((immagini || []).map(u => ({ type: 'image_url', image_url: { url: u } })));
  const url = compat ? a.url.replace(/\/+$/, '') + '/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const head = { 'content-type': 'application/json' };
  if (chiave) head.authorization = 'Bearer ' + chiave;
  if (!compat) head['x-title'] = 'Scio';
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: head,
      body: JSON.stringify({ model: a.model || (compat ? undefined : 'google/gemini-2.5-flash'), temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: content }] }) });
  } catch (e) {
    throw new Error(compat ? 'Non riesco a raggiungere ' + a.url + '. Controlla che il programma sia acceso e che accetti collegamenti dal browser (vedi guida).' : 'Rete non raggiungibile: ' + e.message);
  }
  if (!r.ok) throw new Error('Errore ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  if (!j.choices || !j.choices[0]) throw new Error('Risposta vuota dal servizio AI.');
  return j.choices[0].message.content || '';
}
function leggiJSON(t) {
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('La risposta dell\'AI non è nel formato atteso. Riprova.');
  const g = t.slice(a, b + 1);
  try { return JSON.parse(g); } catch (e) { return JSON.parse(g.replace(/,\s*([}\]])/g, '$1')); }
}

/* Schemi dei risultati: con Claude l'API obbliga a compilare tutti i campi. */
const T = { type: 'string' }, LS_ = { type: 'array', items: { type: 'string' } };
const OBJ = (properties, required) => ({ type: 'object', properties, required: required || Object.keys(properties) });
const SCHEMA_CAPITOLO = OBJ({
  inventario: Object.assign({ description: 'COMPILA PER PRIMO: elenco completo di argomenti, definizioni, date, nomi, tecniche e termini evidenziati nelle pagine (anche riquadri, box e didascalie)' }, LS_),
  titolo: T, avvisi: LS_, riassunto_breve: LS_, riassunto_completo: Object.assign({ description: 'Riassunto in sezioni, una per ogni paragrafo del libro, ciascuna con riga "### Titolo"; nessun argomento saltato' }, T),
  schema: OBJ({ radice: T, rami: { type: 'array', items: OBJ({ titolo: T, punti: LS_ }) } }),
  spiegazioni: { type: 'array', description: 'Almeno 5 concetti spiegati in modo semplice, ciascuno con un esempio pratico', items: OBJ({ concetto: T, spiegazione: T, esempio: T }) },
  glossario: { type: 'array', description: 'Almeno 8 termini chiave', items: OBJ({ termine: T, definizione: T }) },
  test: { type: 'array', description: 'Da 20 a 30 domande (più il capitolo è lungo, più domande): circa 7 su 10 con tipo "scelta" (4 opzioni) e le altre con tipo "vf"', items: OBJ({ tipo: { type: 'string', enum: ['scelta', 'vf'] }, argomento: T, domanda: T, opzioni: Object.assign({ description: 'Solo per tipo scelta: 4 opzioni' }, LS_), corretta: { description: 'Per scelta: indice 0-3 dell\'opzione giusta. Per vf: true o false' }, spiegazione: T }, ['tipo', 'argomento', 'domanda', 'corretta', 'spiegazione']) }
});
const SCHEMA_ESERCIZIO = OBJ({
  materia: T, richiesta: T,
  passi: { type: 'array', description: '3-6 passi di ragionamento', items: OBJ({ titolo: T, domanda: T, obiettivo: T, indizi: Object.assign({ description: 'Esattamente 3 indizi dal più leggero al più chiaro, senza la soluzione' }, LS_), esempio_simile: T }) }
});
const SCHEMA_VALUTA = OBJ({ esito: { type: 'string', enum: ['giusto', 'quasi', 'da_rivedere'] }, feedback: T });

/* ===== Stampa e download ===== */
function dispensaHTML(c) {
  const li = a => '<ul>' + arr(a).map(x => '<li>' + md(x) + '</li>').join('') + '</ul>';
  const intest = '<p class="meta">' + esc(c.titolo) + ' · ' + esc(c.materia) + ' · ' + new Date(c.data).toLocaleDateString('it-IT') + ' · preparato con Scio</p>';
  const sezioni = [];
  sezioni.push('<h1>' + esc(c.titolo) + '</h1>' + intest + legendaColori() + '<h2>In breve</h2>' + li(c.riassunto_breve) + '<h2>Riassunto</h2><p>' + md(c.riassunto_completo) + '</p>');
  if (arr(c.schema && c.schema.rami).length) sezioni.push(intest + '<h2>Schema</h2><div class="radice">' + esc(c.schema.radice || c.titolo) + '</div>' + arr(c.schema.rami).map(r => '<div class="ramo"><h3>' + md(r.titolo) + '</h3>' + li(r.punti) + '</div>').join(''));
  if (arr(c.spiegazioni).length) sezioni.push(intest + '<h2>Spiegazioni</h2>' + c.spiegazioni.map(x => '<h3>' + md(x.concetto) + '</h3><p>' + md(x.spiegazione) + '</p><p><b>Esempio:</b> ' + md(x.esempio) + '</p>').join(''));
  if (arr(c.glossario).length) sezioni.push(intest + '<h2>Glossario</h2>' + c.glossario.map(g => '<p><b>' + esc(g.termine) + '</b>: ' + md(g.definizione) + '</p>').join(''));
  return sezioni.map((x, n) => '<section' + (n ? ' class="nuova"' : '') + '>' + x + '</section>').join('');
}
function dispensaTesto(c) {
  const pulisci = t => String(t == null ? '' : t).replace(/\[\[[dcp]:(.+?)\]\]/g, '$1').replace(/\*\*/g, '').replace(/^### /gm, '');
  const r = [c.titolo, c.materia + ' · ' + new Date(c.data).toLocaleDateString('it-IT') + ' · preparato con Scio', '', 'IN BREVE'].concat(arr(c.riassunto_breve).map(x => '- ' + pulisci(x)));
  r.push('', 'RIASSUNTO', pulisci(c.riassunto_completo));
  if (arr(c.schema && c.schema.rami).length) { r.push('', 'SCHEMA', pulisci(c.schema.radice || c.titolo)); c.schema.rami.forEach(x => { r.push('  ' + pulisci(x.titolo)); arr(x.punti).forEach(p => r.push('    - ' + pulisci(p))); }); }
  if (arr(c.spiegazioni).length) { r.push('', 'SPIEGAZIONI'); c.spiegazioni.forEach(x => r.push(pulisci(x.concetto), '  ' + pulisci(x.spiegazione), '  Esempio: ' + pulisci(x.esempio), '')); }
  if (arr(c.glossario).length) { r.push('GLOSSARIO'); c.glossario.forEach(g => r.push(pulisci(g.termine) + ': ' + pulisci(g.definizione))); }
  return r.join('\n');
}
const SYS_COMPLETA = `Sei Scio, un tutor di studio per ragazzi italiani. Ti viene dato il riassunto di un capitolo. Prepara le parti mancanti SOLO a partire da quel testo, senza inventare nulla che non sia nel riassunto: schema, spiegazioni, glossario e test, con le stesse regole del materiale di studio (italiano semplice, parole chiave con **doppio asterisco**, test di 20 domande: 14 a scelta e 6 vero/falso). Nei campi titolo, riassunto_breve e riassunto_completo ripeti il testo ricevuto.`;
/* Ripara i capitoli in cui l'AI ha scritto il resto dei dati dentro il testo del riassunto. */
function riparaCapitolo(c) {
  const rc = String(c.riassunto_completo || '');
  const m = /["”]\s*,\s*"(spiegazioni|schema|glossario|test)"\s*:/.exec(rc);
  if (!m) return false;
  const head = rc.slice(0, m.index);
  const tail = rc.slice(m.index).replace(/^["”]\s*,\s*/, '').replace(/\r?\n/g, ' ');
  let o = null;
  for (const cand of ['{' + tail, '{' + tail + '}', '{' + tail.replace(/\}\s*$/, ''), '{' + tail.replace(/\}\s*$/, '') + '}']) { try { o = JSON.parse(cand); break; } catch (e) { /* si prova la forma successiva */ } }
  c.riassunto_completo = head;
  if (o) {
    if (o.schema && arr(o.schema.rami).length && !arr(c.schema && c.schema.rami).length) c.schema = o.schema;
    ['spiegazioni', 'glossario', 'test'].forEach(k => { if (arr(o[k]).length && !arr(c[k]).length) c[k] = o[k]; });
  }
  return true;
}
/* Chiede un risultato in JSON; se la risposta è malformata, riprova una volta da sola. */
async function chiediJSON(system, testo, immagini, schema) {
  let ultimo;
  for (let n = 0; n < 2; n++) {
    try { const r = leggiJSON(await chiamaAI(system, testo, immagini, undefined, schema || true)); if (r && typeof r.riassunto_completo === 'string') riparaCapitolo(r); return r; }
    catch (e) { ultimo = e; if (e instanceof SyntaxError || /formato atteso/.test(e.message)) continue; throw e; }
  }
  throw new Error('L\'AI ha risposto in un formato non valido anche al secondo tentativo (' + ultimo.message + '). Riprova, magari con meno foto.');
}
(function () { let m = false; DB.figli.forEach(f => (f.capitoli || []).forEach(c => { if (riparaCapitolo(c)) m = true; })); if (m) salva(); })();
/* ===== Materie ===== */
function pl(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
function sameM(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }
function migraMaterie() {
  S.materie = arr(S.materie).filter(x => typeof x === 'string' && x.trim());
  arr(S.capitoli).concat(arr(S.esercizi)).forEach(x => { if (x.materia && !S.materie.some(m => sameM(m, x.materia))) S.materie.push(x.materia); });
}
function elementiMateria(m) { return { cap: S.capitoli.filter(c => sameM(c.materia, m)), es: S.esercizi.filter(e => sameM(e.materia, m)) }; }
migraTutti();
(function () { DB.figli.forEach(f => { const p = f.profilo; if (p && p.colori === undefined) p.colori = !(p.dsa && p.dsa.dislessia); }); })();
function arr(x) { return Array.isArray(x) ? x : []; }

const SYS_CAPITOLO = `Sei Scio, un tutor di studio per ragazzi italiani. Ricevi le foto delle pagine di un capitolo di un libro di scuola.
Regole:
- Scrivi sempre in italiano.
- Usa SOLO i contenuti presenti nelle pagine. Non inventare. Se una parte è illeggibile o tagliata, scrivilo in "avvisi".
- Le foto sono scattate con il telefono e spesso compresse (es. WhatsApp): ignora lo sfondo e gli oggetti attorno al libro, leggi con attenzione anche il testo piccolo e le didascalie, e segnala in "avvisi" solo le parti davvero illeggibili.
- Se è indicato un focus, lavora SOLO su quei paragrafi o argomenti.
- COPERTURA TOTALE: il riassunto completo segue l'ordine del libro e deve toccare TUTTI gli argomenti trattati, dall'inizio all'ultima pagina, anche se le pagine sono tante (17 o più). Per OGNI paragrafo o titolo del libro scrivi una sezione che inizia con una riga "### Titolo del paragrafo" seguita dal testo. Meglio sezioni brevi di un argomento mancante.
- COMPLETEZZA: prima compila "inventario" elencando TUTTO ciò che le pagine contengono di importante: ogni argomento, definizione, data, nome, luogo, tecnica e parola evidenziata (grassetto, colori, riquadri di approfondimento, box laterali, didascalie, note). Poi assicurati che OGNI voce dell'inventario compaia nel riassunto completo e abbia una spiegazione o una voce di glossario. I riquadri di approfondimento (per esempio un metodo o una tecnica) hanno una spiegazione dedicata. Non omettere mai ciò che il libro mette in evidenza: è quello che l'insegnante chiede.
- Spiega in modo semplice e pratico, con esempi concreti e analogie.
- Evidenzia le parole chiave nel modo indicato nel profilo dello studente (sotto).
- Rispondi SOLO con un JSON valido, senza testo prima o dopo, con questa struttura:
{"inventario":["..."],"titolo":"...","avvisi":["..."],"riassunto_breve":["5 frasi brevi al massimo"],"riassunto_completo":"testo con paragrafi separati da \\n\\n","schema":{"radice":"concetto centrale","rami":[{"titolo":"...","punti":["...","..."]}]},"spiegazioni":[{"concetto":"...","spiegazione":"...","esempio":"..."}],"glossario":[{"termine":"...","definizione":"..."}],"test":[{"tipo":"scelta","argomento":"...","domanda":"...","opzioni":["a","b","c","d"],"corretta":0,"spiegazione":"..."},{"tipo":"vf","argomento":"...","domanda":"...","corretta":true,"spiegazione":"..."}]}
- Spiegazioni: almeno 5; glossario: almeno 8 termini; il test copre argomenti diversi dell'inventario.
- Il test ha da 20 a 30 domande (20 per un capitolo breve, fino a 30 per uno lungo), distribuite su TUTTI gli argomenti dell'inventario: circa 7 su 10 a scelta multipla (4 opzioni, "corretta" è l'indice 0-3, varia la posizione) e le altre vero/falso. Non ripetere due volte la stessa domanda. Le domande verificano la comprensione, non la memoria di dettagli. Le spiegazioni sono gentili e spiegano il perché.`;

const SYS_ESERCIZIO = `Sei Scio, un tutor che GUIDA IL RAGIONAMENTO. Ricevi la foto di un esercizio (matematica, fisica, latino, greco o altro).
REGOLA ASSOLUTA: non dare MAI la soluzione, né il risultato finale, né la traduzione completa. Lo studente deve arrivarci da solo.
Dividi l'esercizio in 3-6 passi di ragionamento (cosa chiede, cosa so, quale regola o metodo serve, come si combinano, controllo finale).
Per matematica e fisica controlla con cura i calcoli per te stesso. Per latino e greco guida l'analisi (verbo, soggetto, casi, complementi) senza tradurre.
Rispondi SOLO con un JSON valido:
{"materia":"...","richiesta":"l'esercizio riscritto in modo chiaro","passi":[{"titolo":"...","domanda":"domanda guida per lo studente","obiettivo":"cosa deve aver capito o ottenuto (SOLO per te, può contenere la risposta attesa)","indizi":["indizio leggero","indizio medio","indizio più chiaro ma senza soluzione"],"esempio_simile":"un esempio breve con dati diversi che mostra il metodo, senza risolvere questo esercizio"}]}
Scrivi in italiano, con tono incoraggiante.`;

const SYS_VALUTA = `Sei Scio, tutor che guida il ragionamento. Ricevi un passo di un esercizio con il suo obiettivo (riservato) e la risposta dello studente.
Valuta se la risposta raggiunge l'obiettivo. Non rivelare MAI la soluzione o il risultato. Se la risposta è sbagliata o incompleta, individua il punto in cui il ragionamento si inceppa e fai UNA domanda che lo aiuti a rendersene conto.
Rispondi SOLO con JSON: {"esito":"giusto"|"quasi"|"da_rivedere","feedback":"massimo 3 frasi, tono incoraggiante, in italiano"}`;

/* ===== Esempi per la modalità demo ===== */
const DEMO_CAP = {
  titolo: 'Le civiltà fluviali', avvisi: [],
  riassunto_breve: ['Le prime grandi civiltà nascono vicino ai **fiumi**.', 'Il fiume porta acqua e **terra fertile**: si coltiva di più.', 'Con l\'**irrigazione** i raccolti crescono e nascono i villaggi, poi le città.', 'Servono regole e una **scrittura** per contare i raccolti.', 'Esempi: Mesopotamia, Egitto, valle dell\'Indo, Cina.'],
  riassunto_completo: 'Le prime grandi civiltà si sviluppano lungo i grandi **fiumi**: il Tigri e l\'Eufrate in Mesopotamia, il Nilo in Egitto, l\'Indo in India e il Fiume Giallo in Cina.\n\nIl fiume porta acqua e **terra fertile**. Con l\'**irrigazione**, cioè canali che portano l\'acqua ai campi, i raccolti aumentano. Così molte persone possono vivere nello stesso luogo e nascono villaggi e città.\n\nPer organizzare il lavoro e contare i raccolti servono regole, funzionari e una **scrittura**.',
  schema: { radice: 'Civiltà fluviali', rami: [{ titolo: 'Dove nascono', punti: ['Tigri ed Eufrate (Mesopotamia)', 'Nilo (Egitto)', 'Indo', 'Fiume Giallo (Cina)'] }, { titolo: 'Perché lì', punti: ['Acqua', 'Terra fertile', 'Irrigazione e più raccolti'] }, { titolo: 'Cosa porta', punti: ['Villaggi e città', 'Regole e funzionari', 'Scrittura'] }] },
  spiegazioni: [{ concetto: 'Irrigazione', spiegazione: 'Sono canali che portano l\'acqua del fiume fino ai campi lontani.', esempio: 'Come un annaffiatoio gigante: invece di portare l\'acqua a mano, la fai arrivare da sola.' }, { concetto: 'Perché serve la scrittura', spiegazione: 'Con tanti raccolti e tante persone, bisogna ricordare chi ha dato e chi ha ricevuto cosa.', esempio: 'È come un quaderno dei conti del negozio, ma per un\'intera città.' }],
  glossario: [{ termine: 'Civiltà fluviale', definizione: 'Società nata lungo un grande fiume.' }, { termine: 'Irrigazione', definizione: 'Portare l\'acqua ai campi con canali.' }, { termine: 'Scriba', definizione: 'Chi sapeva scrivere e teneva i conti.' }],
  test: [
    { tipo: 'scelta', argomento: 'Dove nascono', domanda: 'Perché le prime civiltà nascono vicino ai fiumi?', opzioni: ['Perché i fiumi portano acqua e terra fertile', 'Perché lì fa sempre freddo', 'Perché non servono case', 'Perché ci sono più montagne'], corretta: 0, spiegazione: 'L\'acqua e la terra fertile permettono di coltivare molto cibo.' },
    { tipo: 'scelta', argomento: 'Dove nascono', domanda: 'Quale fiume appartiene all\'Egitto?', opzioni: ['Indo', 'Nilo', 'Eufrate', 'Fiume Giallo'], corretta: 1, spiegazione: 'Il Nilo è il fiume dell\'Egitto.' },
    { tipo: 'vf', argomento: 'Perché lì', domanda: 'L\'irrigazione serve a portare l\'acqua ai campi.', corretta: true, spiegazione: 'Sì: sono canali che portano l\'acqua dove serve.' },
    { tipo: 'scelta', argomento: 'Cosa porta', domanda: 'A cosa serviva la scrittura?', opzioni: ['A decorare i templi', 'A contare e ricordare i raccolti', 'A giocare', 'A costruire canali'], corretta: 1, spiegazione: 'Serviva soprattutto a tenere i conti.' },
    { tipo: 'vf', argomento: 'Cosa porta', domanda: 'Le prime città nascono prima dei villaggi.', corretta: false, spiegazione: 'Prima nascono i villaggi, poi crescono e diventano città.' }
  ]
};
const DEMO_ES = {
  materia: 'Matematica', richiesta: 'Risolvi l\'equazione (x² − 4) / (x − 2) = 0.',
  passi: [
    { titolo: 'Cosa ti chiede?', domanda: 'Con parole tue: che cosa devi trovare?', obiettivo: 'Trovare i valori di x che rendono vera l\'uguaglianza.', indizi: ['Rileggi la richiesta: c\'è una lettera sconosciuta.', 'Cerca il simbolo =: quale valore deve avere la frazione?', 'Devi trovare x.'], esempio_simile: 'In 2x = 10 devi trovare il numero x che moltiplicato per 2 dà 10.' },
    { titolo: 'Cosa non può succedere?', domanda: 'In una frazione c\'è un numero che non può mai valere zero. Quale, e perché?', obiettivo: 'Il denominatore non può essere zero, quindi x ≠ 2.', indizi: ['Pensa a cosa significa dividere per zero.', 'Guarda la parte sotto la linea della frazione.', 'Quel numero non può essere 0: che valore di x lo renderebbe 0?'], esempio_simile: 'In 5/(x+1) il denominatore non può essere 0, quindi x non può essere −1.' },
    { titolo: 'Quando una frazione vale zero?', domanda: 'Che cosa deve succedere al numeratore perché tutta la frazione faccia zero?', obiettivo: 'Il numeratore deve essere zero: x² − 4 = 0.', indizi: ['Pensa a 0 diviso 5: quanto fa?', 'Una frazione è zero quando la parte sopra è zero.', 'Scrivi la condizione sul numeratore.'], esempio_simile: 'La frazione (x − 3)/4 vale zero quando x − 3 = 0, cioè x = 3.' },
    { titolo: 'Metti insieme tutto', domanda: 'Quali valori di x vanno bene, tenendo conto della condizione del passo 2?', obiettivo: 'x² − 4 = 0 dà x = 2 oppure x = −2; x = 2 è escluso, quindi la soluzione è x = −2.', indizi: ['Risolvi la condizione sul numeratore.', 'Controlla ogni valore con la condizione trovata prima.', 'Un valore trovato potrebbe essere escluso.'], esempio_simile: 'Se trovi x = 1 e x = 4 ma x ≠ 4, la soluzione è solo x = 1.' }
  ]
};

/* ===== Foto ===== */
function leggiComeUrl(file) {
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(new Error('lettura del file non riuscita')); r.readAsDataURL(file); });
}
function caricaImg(src) {
  return new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ko(new Error('il browser non riesce a decodificare l\'immagine')); im.src = src; });
}
async function riduci(file) {
  const tipo = file.type || '';
  if (/heic|heif/i.test(tipo) || /\.(heic|heif)$/i.test(file.name || '')) throw new Error('formato HEIC non supportato: scatta o salva la foto in JPG');
  let sorgente, w, h;
  try { sorgente = await createImageBitmap(file, { imageOrientation: 'from-image' }); w = sorgente.width; h = sorgente.height; }
  catch (e1) {
    try { sorgente = await caricaImg(await leggiComeUrl(file)); w = sorgente.width; h = sorgente.height; }
    catch (e2) { sorgente = null; }
  }
  if (sorgente && w && h) {
    /* foto già piccola (es. WhatsApp): si invia l'originale, senza ricomprimerla e perdere altra nitidezza */
    if (tipo === 'image/jpeg' && Math.max(w, h) <= 1600 && file.size < 6 * 1024 * 1024) {
      try { const o = await leggiComeUrl(file); if (o) return o; } catch (e0) { /* si prosegue */ }
    }
    try {
      const k = Math.min(1, 1600 / Math.max(w, h));
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(sorgente, 0, 0, c.width, c.height);
      const u = c.toDataURL('image/jpeg', 0.9);
      if (u && u.length > 2000) return u;
    } catch (e3) { /* si passa all'originale */ }
  }
  /* ultima strada: l'immagine originale, senza ridurla (se è un JPEG o PNG normale) */
  if (/^image\/(jpeg|png|webp|gif)$/.test(tipo) && file.size < 6 * 1024 * 1024) {
    const u = await leggiComeUrl(file); if (u) return u;
  }
  throw new Error('formato o file non leggibile dal browser');
}
async function aggiungiFoto(files) {
  files = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || ''));
  if (files.length > 1) files.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { numeric: true }));
  for (const f of files) { try { V.foto.push(await riduci(f)); } catch (e) { toast('Una foto non si apre: ' + e.message); } }
  render();
}

/* ===== Elaborazione ===== */
async function preparaCapitolo() {
  const materia = V.materia;
  const focus = document.getElementById('focus').value.trim();
  V.bozza = { materia, focus };
  if (!V.foto.length && FAM.ai.provider !== 'demo') { toast('Aggiungi almeno una foto.'); return; }
  V.busy = true; V.errore = ''; render();
  try {
    let c;
    if (FAM.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 900)); c = JSON.parse(JSON.stringify(DEMO_CAP)); }
    else {
      c = await chiediJSON(SYS_CAPITOLO + '\n\n' + profiloTesto(), 'Materia: ' + materia + '. ' + (focus ? 'Concentrati SOLO su: ' + focus + '.' : 'Usa tutto il capitolo.') + ' Genera il materiale di studio.', V.foto, SCHEMA_CAPITOLO);
    }
    const cap = { id: uid(), data: new Date().toISOString(), materia, focus, titolo: c.titolo || 'Capitolo', inventario: arr(c.inventario), avvisi: arr(c.avvisi), riassunto_breve: arr(c.riassunto_breve), riassunto_completo: c.riassunto_completo || '', schema: c.schema || { radice: '', rami: [] }, spiegazioni: arr(c.spiegazioni), glossario: arr(c.glossario), test: arr(c.test), risultati: [] };
    S.capitoli.unshift(cap); salva();
    V.foto = []; V.cap = cap.id; V.tab = 'riassunto'; V.vista = 'capitolo'; V.busy = false; render();
  } catch (e) { V.busy = false; V.errore = e.message === 'NODEMO' ? 'Per usare l\'AI serve una chiave: la inserisci in Area genitori › Impostazioni. Intanto puoi provare la modalità demo.' : e.message; render(); }
}
async function preparaEsercizio() {
  const materia = V.materia;
  if (!V.foto.length && FAM.ai.provider !== 'demo') { toast('Aggiungi la foto dell\'esercizio.'); return; }
  V.busy = true; V.errore = ''; render();
  try {
    let c;
    if (FAM.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 700)); c = JSON.parse(JSON.stringify(DEMO_ES)); }
    else { c = await chiediJSON(SYS_ESERCIZIO + '\n\n' + profiloTesto(), 'Materia: ' + materia + '. Guida lo studente passo per passo.', V.foto, SCHEMA_ESERCIZIO); }
    const es = { id: uid(), data: new Date().toISOString(), materia: materia, richiesta: c.richiesta || '', passi: arr(c.passi), i: 0, indizi: 0, indiziTotali: 0, fatti: [], finito: false };
    if (!es.passi.length) throw new Error('Non sono riuscito a dividere l\'esercizio in passi. Prova con una foto più chiara.');
    S.esercizi.unshift(es); salva();
    V.foto = []; V.es = es.id; V.vista = 'esercizio'; V.busy = false; V.fb = null; V.mostra = {}; V.bozza = ''; render();
  } catch (e) { V.busy = false; V.errore = e.message === 'NODEMO' ? 'Per usare l\'AI serve una chiave (Area genitori › Impostazioni).' : e.message; render(); }
}
async function controllaIdea() {
  const es = S.esercizi.find(x => x.id === V.es); const p = es.passi[es.i];
  const ris = document.getElementById('idea').value.trim();
  if (ris.length < 2) { toast('Scrivi prima la tua idea, anche solo a metà.'); return; }
  V.bozza = ris; V.busy = true; V.errore = ''; render();
  try {
    let r;
    if (FAM.ai.provider === 'demo') { await new Promise(x => setTimeout(x, 500)); r = ris.length > 14 ? { esito: 'giusto', feedback: 'Ben ragionato! Passiamo al passo successivo.' } : { esito: 'quasi', feedback: 'Ci sei vicino. Prova a spiegarlo con una frase intera: cosa succede e perché?' }; }
    else { r = await chiediJSON(SYS_VALUTA + '\n\n' + profiloTesto(), 'Esercizio: ' + es.richiesta + '\nPasso: ' + p.titolo + '\nDomanda: ' + p.domanda + '\nObiettivo (riservato): ' + p.obiettivo + '\nRisposta dello studente: ' + ris, [], SCHEMA_VALUTA); }
    V.busy = false;
    if (r.esito === 'giusto') { es.fatti.push({ i: es.i, risposta: ris }); V.fb = { tipo: 'ok', testo: r.feedback || 'Giusto!' }; V.passoOk = true; }
    else { V.fb = { tipo: 'warn', testo: r.feedback || 'Quasi: riprova.' }; V.passoOk = false; }
    salva(); render();
  } catch (e) { V.busy = false; V.errore = e.message; render(); }
}

/* ===== Date, ripasso e verifiche ===== */
function zero(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function parseData(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN); }
function fmtData(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function oggiStr() { return fmtData(new Date()); }
function piuGiorni(n) { const d = zero(new Date()); d.setDate(d.getDate() + n); return fmtData(d); }
function giorniA(s) { return Math.round((parseData(s) - zero(new Date())) / 864e5); }
function dataLoc(s, opz) { try { return parseData(s).toLocaleDateString(LINGUE_VOCE[LINGUA_CORRENTE], opz); } catch (e) { return String(s); } }
function quando(n) { return n === 0 ? t('oggi') : n === 1 ? t('domani') : t('tra_giorni', { n: n }); }

const RIP_INT = [1, 3, 7, 16, 35];
function ripDovute() {
  const o = oggiStr(), out = [];
  Object.keys(S.rip || {}).forEach(k => {
    const r = S.rip[k]; if (!r || r.next > o) return;
    const p = k.split('|'); const cap = S.capitoli.find(c => c.id === p[0]);
    if (cap && arr(cap.test)[+p[1]]) out.push({ cap: cap, i: +p[1] });
  });
  return out;
}
function ripAggiorna(cid, ix, giusta) {
  S.rip = S.rip || {}; const k = cid + '|' + ix, r = S.rip[k], o = oggiStr();
  if (!giusta) { S.rip[k] = { b: 0, next: piuGiorni(RIP_INT[0]) }; return; }
  if (r && r.next <= o) { const b = r.b + 1; if (b >= RIP_INT.length) delete S.rip[k]; else S.rip[k] = { b: b, next: piuGiorni(RIP_INT[b]) }; }
}
function pulisciRip() { Object.keys(S.rip || {}).forEach(k => { const p = k.split('|'); const c = S.capitoli.find(x => x.id === p[0]); if (!c || !arr(c.test)[+p[1]]) delete S.rip[k]; }); }
function capCorrente() { return V.test && V.test.cap === '__rip' ? V.ripCap : S.capitoli.find(x => x.id === V.cap); }

function prossimeVerifiche(giorni) {
  return arr(S.verifiche).map(v => ({ v: v, d: giorniA(v.data) })).filter(x => x.d >= 0 && x.d <= giorni).sort((a, b) => a.d - b.d);
}
function pianoRipasso(v) {
  const n = giorniA(v.data);
  if (!(n > 0)) return { msg: t('piano_passata') };
  const caps = S.capitoli.filter(c => sameM(c.materia, v.materia));
  if (!caps.length) return { msg: t('piano_nocap') };
  const oggi = zero(new Date()); const giorni = [];
  for (let i = 0; i < n; i++) giorni.push({ data: new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + i), righe: [] });
  const studio = Math.max(1, Math.ceil(n * 0.6));
  if (caps.length >= studio) caps.forEach((c, k) => { giorni[Math.min(studio - 1, Math.floor(k * studio / caps.length))].righe.push(t('piano_studia', { t: esc(c.titolo) })); });
  else { const visti = {}; for (let i = 0; i < studio; i++) { const c = caps[Math.floor(i * caps.length / studio)]; giorni[i].righe.push(t(visti[c.id] ? 'piano_rivedi' : 'piano_studia', { t: esc(c.titolo) })); visti[c.id] = true; } }
  for (let i = studio; i < n; i++) { giorni[i].righe.push(t('piano_test', { t: esc(caps[(i - studio) % caps.length].titolo) })); giorni[i].righe.push(t('piano_errori')); }
  if (n >= 3) giorni[n - 1].righe = [t('piano_ultimo')];
  return { giorni: giorni };
}
function cardVerifica(v, conPiano) {
  const n = giorniA(v.data);
  let h = '<div class="card"><div class="row" style="justify-content:space-between"><div><b>' + esc(v.materia) + '</b>' + (v.argomento ? ' · ' + esc(v.argomento) : '') + '<div class="muted">' + esc(dataLoc(v.data, { weekday: 'long', day: 'numeric', month: 'long' })) + '</div></div>' +
    (n >= 0 ? '<span class="chip ' + (n <= 3 ? 'warn' : '') + '">' + esc(quando(n)) + '</span>' : '') + '</div>';
  if (conPiano && n >= 0) {
    const p = pianoRipasso(v);
    h += '<details><summary>' + t('piano') + '</summary>' + (p.msg ? '<p class="muted">' + p.msg + '</p>' : p.giorni.map(g => '<p><b>' + esc(g.data.toLocaleDateString(LINGUE_VOCE[LINGUA_CORRENTE], { weekday: 'short', day: 'numeric', month: 'short' })) + '</b>: ' + g.righe.join(' · ') + '</p>').join('')) + '</details>';
  }
  return h + '<p></p><button class="btn sec small" data-act="elimina-verifica" data-id="' + v.id + '">' + t('elimina') + '</button></div>';
}
function boxNuovaVerifica() {
  return '<div class="card"><h3>' + t('agg_verifica') + '</h3><label class="f">' + t('data') + '<input type="date" id="vdata"></label><label class="f">' + t('argomento') + '<input type="text" id="varg" maxlength="80" autocomplete="off"></label><button class="btn sec small" data-act="aggiungi-verifica">' + t('aggiungi') + '</button></div>';
}

/* ===== Voce: lettura con parola evidenziata, quiz a voce ===== */
let TOKEN = 0;
function plain(s) { return String(s == null ? '' : s).replace(/\[\[[dcp]:/g, '').replace(/\]\]/g, '').replace(/\*\*/g, '').replace(/^### /gm, '').replace(/\s+/g, ' ').trim(); }
function voceDi() { return LINGUE_VOCE[(S.profilo && S.profilo.lingua) || 'it']; }
function scegliVoce(lang) { try { const vs = speechSynthesis.getVoices(); const b = lang.slice(0, 2); return vs.find(v => v.lang.replace('_', '-') === lang) || vs.find(v => v.lang.replace('_', '-').slice(0, 2) === b); } catch (e) { return null; } }
function fermaVoce() { TOKEN++; try { speechSynthesis.cancel(); } catch (e) { /* non disponibile */ } try { if (V && V.rec) V.rec.abort(); } catch (e) { /* già fermo */ } if (V) V.rec = null; }
function parlaCb(testo, cb, bnd) {
  if (!('speechSynthesis' in window)) { toast(t('voce_non')); if (cb) cb(); return null; }
  try {
    speechSynthesis.cancel(); const id = ++TOKEN;
    const u = new SpeechSynthesisUtterance(testo); u.lang = voceDi(); const vv = scegliVoce(u.lang); if (vv) u.voice = vv;
    u.rate = (S.profilo && S.profilo.vel) || 0.9;
    u.onend = () => { if (id === TOKEN && cb) cb(); };
    u.onerror = ev => { if (id !== TOKEN || ev.error === 'interrupted' || ev.error === 'canceled') return; toast(t('voce_non')); if (cb) cb(); };
    if (bnd) u.onboundary = ev => { if (id === TOKEN) bnd(ev); };
    speechSynthesis.speak(u); return u;
  } catch (e) { toast(t('voce_non')); if (cb) cb(); return null; }
}
function leggiConEvidenza(testo) {
  const clean = plain(testo); if (!clean) return;
  const parole = []; const re = /\S+/g; let m;
  while ((m = re.exec(clean))) parole.push([m.index, m.index + m[0].length]);
  fermaVoce(); V.lettura = { clean: clean, parole: parole }; render();
  const evidenzia = i => {
    document.querySelectorAll('#lettura .ora').forEach(x => x.classList.remove('ora'));
    const w = document.querySelector('#lettura [data-w="' + i + '"]'); if (w) { w.classList.add('ora'); w.scrollIntoView({ block: 'nearest' }); }
  };
  let boundary = false, timer = null, corr = 0; const vel = (S.profilo && S.profilo.vel) || 0.9;
  const fine = () => { if (timer) clearInterval(timer); if (V.lettura) { V.lettura = null; render(); } };
  const u = parlaCb(clean, fine, ev => {
    if (ev.name && ev.name !== 'word') return;
    boundary = true; if (timer) { clearInterval(timer); timer = null; }
    let i = parole.findIndex(w => ev.charIndex >= w[0] && ev.charIndex < w[1]); if (i < 0) i = parole.findIndex(w => w[0] >= ev.charIndex); if (i >= 0) evidenzia(i);
  });
  if (u) setTimeout(() => {
    if (boundary || !V.lettura) return;
    timer = setInterval(() => { if (!V.lettura) { clearInterval(timer); return; } evidenzia(Math.min(corr++, parole.length - 1)); }, 1000 / (2.6 * vel));
  }, 1300);
}
function boxLettura() {
  const L = V.lettura; if (!L) return '';
  let out = '', pos = 0;
  L.parole.forEach((w, i) => { out += esc(L.clean.slice(pos, w[0])) + '<span data-w="' + i + '">' + esc(L.clean.slice(w[0], w[1])) + '</span>'; pos = w[1]; });
  return '<div class="card" id="lettura" dir="auto"><h3>' + t('lettura') + '</h3><div class="lettura-testo">' + out + '</div><p></p><button class="btn sec small" data-act="stop">' + t('ferma') + '</button></div>';
}
function capisciRisposta(alts) {
  const c = capCorrente(); const q = c.test[V.test.dom[V.test.i]];
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const lettere = { a: 0, b: 1, c: 2, d: 3, prima: 0, seconda: 1, terza: 2, quarta: 3, first: 0, second: 1, third: 2, fourth: 3, uno: 0, due: 1, tre: 2, quattro: 3, one: 0, two: 1, three: 2, four: 3, '1': 0, '2': 1, '3': 2, '4': 3, be: 1, bi: 1, ci: 2, di: 3 };
  const opz = q.tipo === 'vf' ? null : arr(q.opzioni).map(norm);
  for (const a of alts.map(norm)) {
    const tok = a.split(' ').filter(Boolean);
    if (q.tipo === 'vf') {
      const sv = ['vero', 'giusto', 'true', 'right', 'yes', 'si', norm(t('vero'))], sf = ['falso', 'sbagliato', 'false', 'wrong', 'no', norm(t('falso'))];
      if (tok.some(x => sf.includes(x))) return 1; if (tok.some(x => sv.includes(x))) return 0; continue;
    }
    if (tok.length <= 3) for (const x of tok) if (Object.prototype.hasOwnProperty.call(lettere, x)) { const k = lettere[x]; if (k < opz.length) return k; }
    let best = -1, bs = 0, pari = false;
    opz.forEach((o, i) => { const ow = o.split(' ').filter(w => w.length > 3); const s = ow.filter(w => a.includes(w)).length / (ow.length || 1); if (s > bs) { bs = s; best = i; pari = false; } else if (s === bs && s > 0) pari = true; });
    if (best >= 0 && bs >= 0.5 && !pari) return best;
  }
  return -1;
}
function ascoltaRisposta() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast(t('voce_non')); return; }
  try { if (V.rec) V.rec.abort(); } catch (e) { /* già fermo */ }
  const r = new SR(); V.rec = r; r.lang = voceDi(); r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
  const tt = V.test;
  r.onresult = ev => {
    if (V.test !== tt || tt.scelta != null) return;
    const idx = capisciRisposta([...ev.results[0]].map(a => a.transcript));
    if (idx < 0) toast(t('non_capito')); else { AZ.rispondi({ dataset: { i: idx } }); render(); }
  };
  r.onerror = () => { /* nessun audio o permesso negato: resta il tocco */ };
  r.onend = () => { if (V.rec === r) V.rec = null; const b = document.getElementById('mic'); if (b) b.classList.remove('on'); };
  const b = document.getElementById('mic'); if (b) b.classList.add('on');
  try { r.start(); } catch (e) { /* già in ascolto */ }
}
function voceTick() {
  const ts = V.test; if (!ts || ts.fine || !V.voce) return;
  const c = capCorrente(); if (!c) return;
  const chiave = ts.cap + ':' + ts.i + ':' + (ts.scelta == null ? 'q' : 'a'); if (ts.parlato === chiave) return; ts.parlato = chiave;
  const q = c.test[ts.dom[ts.i]]; const vf = q.tipo === 'vf'; const opz = vf ? [t('vero'), t('falso')] : arr(q.opzioni); const corr = vf ? (q.corretta ? 0 : 1) : q.corretta;
  if (ts.scelta == null) {
    const testo = plain(q.domanda) + '. ' + (vf ? opz.join(' · ') : opz.map((o, i) => 'ABCD'[i] + ': ' + plain(o)).join('. '));
    parlaCb(testo, () => { if (V.voce && V.test === ts && ts.scelta == null) ascoltaRisposta(); });
  } else {
    parlaCb((ts.scelta === corr ? t('giusto') : t('quasi')) + ' ' + plain(q.spiegazione), () => {
      if (!V.voce || V.test !== ts) return;
      setTimeout(() => { if (V.voce && V.test === ts && ts.scelta != null) { AZ.avanti(); render(); } }, 700);
    });
  }
}

/* ===== Viste ===== */
function barra() {
  const p = S.profilo;
  const brand = p ? '<button class="brand" data-act="home" aria-label="' + esc(t('torna_home')) + '">Scio<small>v' + VERSIONE + '</small></button>' : '<div class="brand">Scio<small>v' + VERSIONE + '</small></div>';
  return '<div class="bar">' + brand + '<div class="row">' +
    (p ? '<button class="btn sec small" data-act="home">' + t('studio') + '</button><button class="btn sec small" data-act="fs-" aria-label="' + esc(t('testo_piccolo')) + '">A−</button><button class="btn sec small" data-act="fs+" aria-label="' + esc(t('testo_grande')) + '">A+</button><button class="btn sec small" data-act="aspetto">' + t('aspetto_btn') + '</button>' + (DB.figli.length > 1 ? '<button class="btn sec small" data-act="scelta">' + t('cambia_profilo') + '</button>' : '') : '') +
    '<button class="btn sec small" data-act="genitori">' + t('genitori') + '</button></div></div>';
}
function cardCap(c) {
  const ult = c.risultati[c.risultati.length - 1];
  return '<div class="card"><div class="row" style="justify-content:space-between"><div><b>' + esc(c.titolo) + '</b><div class="muted">' + esc(c.materia) + (c.focus ? ' · ' + esc(c.focus) : '') + '</div></div>' +
    (ult ? '<span class="chip ' + (ult.punti / ult.totale >= 0.7 ? 'ok' : 'warn') + '">' + t('test') + ' ' + ult.punti + '/' + ult.totale + '</span>' : '<span class="chip">' + t('test_da_fare') + '</span>') + '</div><p></p><button class="btn sec small" data-act="apri-cap" data-id="' + c.id + '">' + t('apri') + '</button></div>';
}
function cardEs(e) {
  return '<div class="card"><b>' + esc(e.materia) + '</b><div class="muted">' + esc(e.richiesta).slice(0, 90) + '</div><p></p><span class="chip ' + (e.finito ? 'ok' : '') + '">' + (e.finito ? t('completato') : t('passo_di', { i: e.i + 1, n: e.passi.length })) + '</span> <button class="btn sec small" data-act="apri-es" data-id="' + e.id + '">' + t('apri') + '</button></div>';
}
function boxSposta(item, tipo) {
  const altre = S.materie.filter(m => !sameM(m, item.materia));
  return '<div class="card"><h3>' + t('sposta_titolo') + '</h3>' + (altre.length ? '<div class="row"><select id="spostaM" aria-label="' + esc(t('materia_lbl')) + '">' + altre.map(m => '<option>' + esc(m) + '</option>').join('') + '</select><button class="btn sec small" data-act="sposta" data-k="' + tipo + '" data-id="' + item.id + '">' + t('sposta_btn') + '</button></div>' : '') +
    '<p></p><button class="btn sec small" data-act="elimina-' + tipo + '" data-id="' + item.id + '">' + t('elimina_lavoro') + '</button></div>';
}
function vScelta() {
  const f = V.pinFiglio ? DB.figli.find(x => x.id === V.pinFiglio) : null;
  return barra() + '<div class="card"><h1>' + t('chi_studia') + '</h1><p class="muted">' + t('scegli_profilo') + '</p></div>' +
    (DB.figli.length ? '<div class="mat-grid">' + DB.figli.map(x => '<button class="mat" data-act="entra-figlio" data-id="' + x.id + '"><b>' + esc(x.profilo.nome) + '</b>' + (x.profilo.pin ? '<span class="muted">🔒</span>' : '') + '</button>').join('') + '</div>' : '<div class="card muted">' + t('nessun_profilo') + '</div>') +
    (f ? '<div class="card"><label class="f">' + t('pin_di', { n: esc(f.profilo.nome) }) + '<input type="password" id="pinfiglio" inputmode="numeric" maxlength="8" autocomplete="off"></label><button class="btn" data-act="pin-figlio-ok">' + t('entra') + '</button></div>' : '');
}
function vMateria() {
  const m = V.materia; if (!S.materie.some(x => sameM(x, m))) return vHome();
  const e = elementiMateria(m);
  const ver = arr(S.verifiche).filter(v => sameM(v.materia, m)).sort((a, b) => a.data.localeCompare(b.data));
  return barra() + '<div class="card"><button class="btn sec small" data-act="home">' + t('tutte_materie') + '</button><p></p><h1>' + esc(m) + '</h1></div>' +
    '<div class="row" style="margin-bottom:12px"><button class="btn" style="flex:1" data-act="nuovo-cap">' + t('foto_cap') + '</button><button class="btn sec" style="flex:1" data-act="nuovo-es">' + t('ho_es') + '</button><button class="btn sec" style="flex:1" data-act="nuovo-controllo">' + t('controlla_svol') + '</button></div>' +
    '<h2>' + t('capitoli') + '</h2>' + (e.cap.length ? e.cap.map(cardCap).join('') : '<div class="card muted">' + t('nessun_cap') + '</div>') +
    (e.es.length ? '<h2>' + t('esercizi') + '</h2>' + e.es.map(cardEs).join('') : '') +
    '<h2>' + t('verifiche') + '</h2>' + ver.map(v => cardVerifica(v, true)).join('') + boxNuovaVerifica() +
    '<div class="card"><button class="btn sec small" data-act="elimina-materia">' + t('elimina_materia') + '</button></div>';
}
function infoDsa(k) { return '<b>' + t('come_lavora') + '</b><p>' + esc(t('i_' + k)) + '</p>'; }
const FONT_STACK = { lexend: "'Lexend',system-ui,sans-serif", andika: "'Andika',system-ui,sans-serif", atkinson: "'Atkinson Hyperlegible',system-ui,sans-serif", sistema: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" };
function bloccoAspetto(p) {
  const opt = (v, k, cur) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + t(k) + '</option>';
  const r = (k, min, max, step, val, lab) => '<label class="f">' + t(lab) + '<input type="range" data-pref="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></label>';
  const cur = p.font || 'tema';
  return '<label class="f">' + t('carattere') + '<select data-pref="font">' + opt('tema', 'f_tema', cur) + opt('lexend', 'f_lexend', cur) + opt('andika', 'f_andika', cur) + opt('atkinson', 'f_atkinson', cur) + opt('sistema', 'f_sistema', cur) + '</select></label>' +
    r('fs', 0.8, 1.6, 0.1, p.fs || 1, 'dimensione') + r('lh', 1.3, 2.4, 0.1, p.lh || 1.6, 'interlinea') + r('ls', 0, 0.2, 0.02, p.ls || 0, 'spaz_lettere') + r('ws', 0, 0.4, 0.05, p.ws || 0, 'spaz_parole') + r('vel', 0.5, 1.4, 0.1, p.vel || 0.9, 'vel_lettura') +
    '<div class="fb" id="anteprima">' + t('anteprima') + '</div>';
}
function bloccoTema(p) {
  const cons = consigliato(p.livello, p.dsa);
  return Object.keys(TEMI).map(k => '<label class="chk"><input type="radio" name="tema" data-pref="tema" value="' + k + '"' + ((p.tema || cons) === k ? ' checked' : '') + '>' + t(k) + '</label>').join('');
}
function vAspetto() {
  const p = S.profilo;
  return barra() + '<div class="card"><h1>' + t('aspetto') + '</h1>' + bloccoTema(p) + bloccoAspetto(p) + '<p></p><button class="btn" data-act="home">' + t('fatto') + '</button></div>';
}
function vFam() {
  const b = V.bozzaFam || {}; const a = Object.assign({}, FAM.ai, b.ai || {});
  const lingua = b.lingua || FAM.lingua;
  const srv = [['demo', 'srv_demo'], ['compat', 'srv_compat'], ['openrouter', 'srv_or'], ['anthropic', 'srv_anth']];
  return barra() + '<div class="card"><h1>' + t('imp_famiglia') + '</h1>' + (!FAM.pin ? '<p class="muted">' + t('passo_fam') + '</p>' : '') + '</div>' +
    '<div class="card"><label class="f">' + t('lingua_gen') + '<select id="lingua-gen">' + LINGUE_ORD.map(l => '<option value="' + l + '"' + (lingua === l ? ' selected' : '') + '>' + LINGUE[l] + '</option>').join('') + '</select></label><p class="muted">' + t('lingua_nota') + '</p></div>' +
    '<div class="card"><h2>' + t('ai_titolo') + '</h2><label class="f">' + t('servizio') + '<select id="prov">' + srv.map(o => '<option value="' + o[0] + '"' + (a.provider === o[0] ? ' selected' : '') + '>' + t(o[1]) + '</option>').join('') + '</select></label>' +
    '<div id="boxcompat"' + (a.provider === 'compat' ? '' : ' hidden') + '><label class="f">' + t('quale') + '<select id="preset">' + Object.keys(PRESET).map(k => '<option value="' + k + '"' + ((a.preset || 'ollama') === k ? ' selected' : '') + '>' + PRESET[k].nome + '</option>').join('') + '</select></label>' +
    '<label class="f">' + t('indirizzo_servizio') + '<input type="text" id="url" value="' + esc(a.url || PRESET.ollama.url) + '" autocomplete="off"></label></div>' +
    '<label class="f">' + t('chiave_api') + '<input type="password" id="chiave" value="' + esc(b.ai && b.ai.key ? b.ai.key : '') + '" placeholder="' + esc(haChiave(FAM.ai) ? t('chiave_salvata') : '') + '" autocomplete="off"></label>' + (haChiave(FAM.ai) ? '<button class="btn sec small" type="button" data-act="rimuovi-chiave">' + t('rimuovi_chiave') + '</button>' : '') +
    '<label class="f">' + t('modello') + '<input type="text" id="modello" value="' + esc(a.model) + '" placeholder="OpenRouter: google/gemini-2.5-flash · Claude: claude-sonnet-5-5 · Ollama: gemma4:26b"></label>' +
    '<button class="btn sec" type="button" data-act="prova-ai">' + t('prova_coll') + '</button><p class="muted" id="esitoprova" role="status"></p><p class="muted">' + t('srv_note') + '</p>' +
    '<details><summary>Guida / Guide: Ollama, LM Studio</summary><p class="muted"><b>Ollama</b>: <code>ollama pull gemma4:26b</code> (GPU ~16 GB). <code>OLLAMA_ORIGINS=' + esc(location.origin.startsWith('http') ? location.origin : 'https://toskurim.github.io') + '</code>. <b>LM Studio</b>: Developer › server + CORS.<br>Funziona solo sul PC dove girano / works only on the PC where they run.</p></details></div>' +
    '<div class="card"><h2>' + t('pin_gen') + '</h2><label class="f">' + (FAM.pin ? t('pin_nuovo') : t('pin_scegli')) + '<input type="password" id="pin" inputmode="numeric" maxlength="8" value="" autocomplete="off"></label><p class="muted">' + t('pin_regole') + '</p></div>' +
    '<button class="btn full" data-act="salva-fam">' + t('salva') + '</button>' + (FAM.pin ? '<p></p><button class="btn sec full" data-act="genitori">' + t('annulla') + '</button>' : '');
}
function vSetup() {
  const f = V.edit ? DB.figli.find(x => x.id === V.edit) : null;
  const p = f ? f.profilo : { nome: '', livello: 'superiori', dsa: {}, tema: '', fs: 1, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: 0.9, pin: '' };
  return barra() + '<div class="card"><h1>' + (f ? esc(p.nome) : t('aggiungi_figlio')) + '</h1></div>' +
    '<div class="card"><label class="f">' + t('nome') + '<input type="text" id="nome" value="' + esc(p.nome) + '" autocomplete="off"></label>' +
    '<label class="f">' + t('livello') + '<select id="livello"><option value="media"' + (p.livello === 'media' ? ' selected' : '') + '>' + t('media') + '</option><option value="superiori"' + (p.livello === 'superiori' ? ' selected' : '') + '>' + t('superiori') + '</option></select></label>' +
    '<p class="muted">' + t('primaria_dopo') + '</p>' +
    '<label class="f">' + t('lingua_figlio') + '<select id="lingua-fig">' + LINGUE_ORD.map(l => '<option value="' + l + '"' + ((p.lingua || 'it') === l ? ' selected' : '') + '>' + LINGUE[l] + '</option>').join('') + '</select></label><p class="muted">' + t('lingua_nota') + '</p></div>' +
    '<div class="card"><h2>' + t('come_studia') + '</h2><p class="muted">' + t('piu_profili') + '</p>' +
    Object.keys(DSA).map(k => '<label class="chk"><input type="checkbox" data-dsa="' + k + '"' + (p.dsa && p.dsa[k] ? ' checked' : '') + '>' + t(k) + '</label><div class="dsainfo" id="info-' + k + '"' + (p.dsa && p.dsa[k] ? '' : ' hidden') + '>' + infoDsa(k) + '</div>').join('') +
    '<p class="muted">' + t('nota_dsa') + '</p>' +
    '<label class="chk"><input type="checkbox" id="colori"' + (p.colori === undefined ? ' checked' : (p.colori ? ' checked' : '')) + '>' + t('colori_lbl') + '</label><p class="muted">' + t('colori_nota') + '</p></div>' +
    '<div class="card"><h2>' + t('aspetto') + '</h2><div id="cons">' + bloccoTema(p) + '</div>' + bloccoAspetto(p) + '</div>' +
    '<div class="card"><h2>' + t('pin_figlio', { n: esc(p.nome || '…') }) + '</h2><label class="f"><input type="password" id="pinf" inputmode="numeric" maxlength="8" value="" autocomplete="off" placeholder="' + esc(p.pin ? t('pin_figlio_tieni') : '') + '"></label>' + (p.pin ? '<label class="chk"><input type="checkbox" id="rmpin">' + t('rimuovi_pin_figlio') + '</label>' : '') + '<p class="muted">' + t('pin_figlio_nota') + '</p></div>' +
    '<button class="btn full" data-act="salva-figlio">' + t('salva') + '</button>' + (DB.figli.length ? '<p></p><button class="btn sec full" data-act="genitori">' + t('annulla') + '</button>' : '');
}
function vHome() {
  const p = S.profilo; if (!p) return vScelta();
  const ultimi = S.capitoli.slice(0, 3);
  const mancanti = MATERIE.filter(m => m !== 'Altro' && !S.materie.some(x => sameM(x, m)));
  const due = ripDovute().length, ver = prossimeVerifiche(21);
  return barra() + (FAM.ai.provider === 'demo' ? '<div class="fb warn" role="status">' + t('demo_banner') + '</div>' : '') +
    '<div class="card"><h1>' + t('ciao', { n: esc(p.nome) }) + '</h1><p class="muted">' + t('scegli_materia') + '</p></div>' +
    '<h2>' + t('le_materie') + '</h2>' + (S.materie.length ? '<div class="mat-grid">' + S.materie.map(m => { const e = elementiMateria(m); return '<button class="mat" data-act="apri-materia" data-m="' + esc(m) + '"><b>' + esc(m) + '</b><span class="muted">' + t('n_cap', { n: e.cap.length }) + ' · ' + t('n_es', { n: e.es.length }) + '</span></button>'; }).join('') + '</div>' : '<div class="card muted">' + t('nessuna_materia') + '</div>') +
    '<div class="card"><h3>' + t('agg_materia') + '</h3>' + (mancanti.length ? '<div class="row" style="margin-bottom:8px">' + mancanti.map(m => '<button class="btn sec small" data-act="aggiungi-materia" data-m="' + esc(m) + '">+ ' + esc(m) + '</button>').join('') + '</div>' : '') +
    '<label class="f">' + t('altra_materia') + '<input type="text" id="nuovaM" maxlength="40" autocomplete="off"></label><button class="btn sec small" data-act="aggiungi-materia">' + t('aggiungi') + '</button></div>' +
    (S.capitoli.some(c => arr(c.test).length) ? '<div class="card"><h2>' + t('ripasso_oggi') + '</h2>' + (due ? '<p>' + (due === 1 ? t('una_rip') : t('n_domande_rip', { n: due })) + '</p><button class="btn" data-act="inizia-ripasso">' + t('inizia_ripasso') + '</button>' : '<p class="muted">' + t('nessun_ripasso') + '</p>') + '<p class="muted">' + t('rip_spiega') + '</p></div>' : '') +
    (ver.length ? '<h2>' + t('verifiche') + '</h2>' + ver.map(x => { const pr = pianoRipasso(x.v); const oggi = pr.giorni && pr.giorni[0] ? pr.giorni[0].righe.join(' · ') : ''; return '<div class="card"><div class="row" style="justify-content:space-between"><div><b>' + esc(x.v.materia) + '</b>' + (x.v.argomento ? ' · ' + esc(x.v.argomento) : '') + '</div><span class="chip ' + (x.d <= 3 ? 'warn' : '') + '">' + esc(quando(x.d)) + '</span></div>' + (oggi ? '<p class="muted"><b>' + t('compito_oggi') + ':</b> ' + oggi + '</p>' : '') + '<button class="btn sec small" data-act="apri-materia" data-m="' + esc(x.v.materia) + '">' + t('piano') + '</button></div>'; }).join('') : '') +
    (ultimi.length ? '<h2>' + t('continua') + '</h2>' + ultimi.map(cardCap).join('') : '');
}
function fotoBox() {
  return '<div class="row"><label class="btn sec">' + t('scatta') + '<input type="file" accept="image/*" capture="environment" id="f1" hidden></label><label class="btn sec">' + t('scegli_foto') + '<input type="file" accept="image/*" multiple id="f2" hidden></label></div>' +
    '<p class="muted">' + t('foto_aiuto') + '</p>' +
    '<div class="thumbs">' + V.foto.map((u, i) => '<div class="th"><img src="' + u + '" alt="' + (i + 1) + '"><div class="row"><button data-act="su" data-i="' + i + '" aria-label="↑">↑</button><button data-act="giu" data-i="' + i + '" aria-label="↓">↓</button><button data-act="del" data-i="' + i + '" aria-label="✕">✕</button></div></div>').join('') + '</div>' +
    (V.errore ? '<div class="fb warn" role="alert">' + esc(V.errore) + '</div>' : '');
}
function vNuovo(tipo) {
  const demo = FAM.ai.provider === 'demo';
  return barra() + '<div class="card"><h1>' + (tipo === 'cap' ? t('nuovo_cap') : t('nuovo_es')) + '</h1>' +
    (demo ? '<div class="fb">' + t('demo_banner') + '</div>' : '') +
    '<p><span class="muted">' + t('materia_lbl') + ':</span> <b>' + esc(V.materia) + '</b> <button class="btn sec small" data-act="home">' + t('cambia_materia') + '</button></p>' +
    (tipo === 'cap' ? '<label class="f">' + t('focus') + '<input type="text" id="focus"></label>' : '') +
    fotoBox() +
    (V.busy ? '<p><span class="spin"></span> ' + t('lavora') + '</p>' : '<button class="btn full" data-act="' + (tipo === 'cap' ? 'prepara-cap' : 'prepara-es') + '">' + (tipo === 'cap' ? t('prepara_studio') : t('guidami')) + '</button>') +
    '<p class="muted">' + t('foto_privacy') + '</p></div>';
}
function vControllo() {
  const r = V.controllo;
  const cl = e => e === 'ok' ? 'ok' : e === 'errore' ? 'warn' : '';
  return barra() + '<div class="card"><h1>' + t('controlla_svol') + '</h1><p class="muted">' + t('svol_intro') + '</p>' + (FAM.ai.provider === 'demo' ? '<div class="fb">' + t('demo_banner') + '</div>' : '') +
    '<p><span class="muted">' + t('materia_lbl') + ':</span> <b>' + esc(V.materia) + '</b></p>' +
    '<label class="f">' + t('cosa_chiedeva') + '<textarea id="cosa">' + esc(V.cosa || '') + '</textarea></label>' + fotoBox() +
    (V.busy ? '<p><span class="spin"></span> ' + t('lavora') + '</p>' : '<button class="btn full" data-act="controlla-svol">' + t('controlla_btn') + '</button>') + '</div>' +
    (r ? '<div class="card"><h2>' + md(r.riepilogo || '') + '</h2>' + arr(r.passi).map(x => '<div class="step"><span class="num ' + (x.esito === 'ok' ? 'done' : '') + '">' + (x.esito === 'ok' ? '✓' : x.esito === 'errore' ? '!' : '?') + '</span><div style="flex:1"><b>' + md(x.cosa_hai_fatto || '') + '</b> <span class="chip ' + cl(x.esito) + '">' + t(x.esito === 'ok' ? 'esito_ok' : x.esito === 'errore' ? 'esito_err' : 'esito_dub') + '</span>' + (x.suggerimento ? '<div class="fb ' + (x.esito === 'errore' ? 'warn' : '') + '">' + md(x.suggerimento) + '</div>' : '') + '</div></div>').join('') + (r.domanda_guida ? '<div class="fb"><b>?</b> ' + md(r.domanda_guida) + '</div>' : '') + (arr(r.passi).some(x => x.esito !== 'ok') ? '<p class="muted">' + t('prova_correggere') + '</p>' : '') + '</div>' : '');
}
function mancano(c) {
  const m = [];
  if (!arr(c.schema && c.schema.rami).length) m.push('schema');
  if (!arr(c.spiegazioni).length) m.push('spiegazioni');
  if (!arr(c.glossario).length) m.push('glossario');
  if (!arr(c.test).length) m.push('test');
  return m.map(x => t(x)).join(', ');
}
function vCapitolo() {
  const c = S.capitoli.find(x => x.id === V.cap); if (!c) return vHome();
  const TB = ['riassunto', 'schema', 'spiegazioni', 'glossario', 'test'];
  let corpo = '';
  if (V.tab === 'riassunto') corpo = legendaColori() + '<div class="card"><h2>' + t('in_breve') + '</h2><ul>' + c.riassunto_breve.map(x => '<li>' + md(x) + '</li>').join('') + '</ul></div><div class="card"><h2>' + t('riass_compl') + '</h2>' + md(c.riassunto_completo) + '</div>' + (arr(c.inventario).length ? '<details class="card"><summary><b>' + t('inventario') + '</b> (' + c.inventario.length + ')</summary><ul>' + c.inventario.map(x => '<li>' + md(x) + '</li>').join('') + '</ul></details>' : '');
  else if (V.tab === 'schema') corpo = '<div class="card"><h2>' + esc(c.schema.radice || c.titolo) + '</h2>' + arr(c.schema.rami).map(r => '<div class="tree"><h3>' + md(r.titolo) + '</h3><ul>' + arr(r.punti).map(p => '<li>' + md(p) + '</li>').join('') + '</ul></div>').join('') + '</div>';
  else if (V.tab === 'spiegazioni') corpo = c.spiegazioni.map((s, i) => '<div class="card"><h3>' + md(s.concetto) + '</h3><p>' + md(s.spiegazione) + '</p><div class="fb"><b>' + t('esempio') + ':</b> ' + md(s.esempio) + '</div><button class="btn sec small" data-act="meglio" data-i="' + i + '">' + t('spiega_meglio') + '</button><div id="m' + i + '"></div></div>').join('') || '<div class="card muted">–</div>';
  else if (V.tab === 'glossario') corpo = '<div class="card">' + c.glossario.map(g => '<p><b>' + esc(g.termine) + '</b>: ' + md(g.definizione) + '</p>').join('') + '</div>';
  else corpo = vTestPartenza(c);
  const gr = V.genRiass && V.genRiass.id === c.id ? '<div class="card" dir="' + (FAM.lingua === 'ar' ? 'rtl' : 'ltr') + '" lang="' + FAM.lingua + '"><h3>' + t('gen_in_lingua') + '</h3>' + md(V.genRiass.testo) + '</div>' : '';
  return barra() + '<div class="card"><div class="muted">' + esc(c.materia) + '</div><h1>' + esc(c.titolo) + '</h1>' + (c.avvisi.length ? '<div class="fb warn">' + c.avvisi.map(esc).join('<br>') + '</div>' : '') +
    (mancano(c) ? '<div class="fb warn" role="alert"><b>!</b> (' + esc(mancano(c)) + '). <button class="btn small" data-act="completa"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('completa')) + '</button></div>' : '') +
    '<div class="row" style="margin-top:8px"><button class="btn sec small" data-act="apri-materia" data-m="' + esc(c.materia) + '">‹ ' + esc(c.materia) + '</button><button class="btn small" data-act="ascolta">' + t('ascolta') + '</button><button class="btn sec small" data-act="stop">' + t('ferma') + '</button><button class="btn sec small" data-act="stampa">' + t('stampa') + '</button><button class="btn sec small" data-act="scarica">' + t('scarica') + '</button>' + (FAM.lingua !== 'it' ? '<button class="btn sec small" data-act="spiega-gen"' + (V.busy ? ' disabled' : '') + '>' + t('spiega_gen') + '</button>' : '') + '</div></div>' + boxLettura() + gr +
    '<div class="tabs" role="tablist">' + TB.map(x => '<button class="tab' + (V.tab === x ? ' on' : '') + '" role="tab" data-act="tab" data-t="' + x + '">' + t(x) + '</button>').join('') + '</div>' + corpo + boxSposta(c, 'cap');
}
function vTestPartenza(c) {
  if (V.test && V.test.cap === c.id) return vTest(c);
  const ult = c.risultati[c.risultati.length - 1];
  return '<div class="card"><h2>' + t('test_finale') + '</h2><p>' + t('test_intro', { n: c.test.length }) + '</p>' + (ult ? '<p class="muted">' + t('ultimo_ris', { p: ult.punti, n: ult.totale }) + '</p>' : '') +
    '<div class="row"><button class="btn" data-act="inizia-test">' + (ult ? t('rifai_test') : t('inizia_test')) + '</button><button class="btn sec" data-act="inizia-voce">' + t('quiz_voce') + '</button></div><p class="muted">' + t('voce_info') + '</p></div>';
}
function vTest(c) {
  const ts = V.test;
  if (ts.fine) {
    const errati = [...new Set(ts.errati.map(i => c.test[i].argomento).filter(Boolean))];
    return '<div class="card"><h2>' + t('hai_finito') + '</h2><p><b>' + t('p_su_n', { p: ts.punti, n: ts.dom.length }) + '</b></p>' +
      (errati.length ? '<div class="fb warn"><b>' + t('da_ripassare') + ':</b> ' + errati.map(esc).join(', ') + '</div>' : '<div class="fb ok">' + t('tutto_chiaro') + '</div>') +
      '<div class="row">' + (ts.errati.length ? '<button class="btn" data-act="solo-errori">' + t('ripeti_errori') + '</button>' : '') + '<button class="btn sec" data-act="chiudi-test">' + t('chiudi') + '</button></div></div>';
  }
  const q = c.test[ts.dom[ts.i]]; const opz = q.tipo === 'vf' ? [t('vero'), t('falso')] : arr(q.opzioni);
  const corr = q.tipo === 'vf' ? (q.corretta ? 0 : 1) : q.corretta;
  return '<div class="card"><div class="muted">' + t('domanda_di', { i: ts.i + 1, n: ts.dom.length }) + '</div><h2>' + md(q.domanda) + '</h2>' +
    opz.map((o, i) => { let cl = 'opt'; if (ts.scelta != null) { if (i === corr) cl += ' good'; else if (i === ts.scelta) cl += ' bad'; } return '<button class="' + cl + '" data-act="rispondi" data-i="' + i + '"' + (ts.scelta != null ? ' disabled' : '') + '>' + (q.tipo === 'vf' ? '' : '<b>' + 'ABCD'[i] + '.</b> ') + md(o) + (ts.scelta != null && i === corr ? ' ✓' : '') + '</button>'; }).join('') +
    (ts.scelta != null ? '<div class="fb ' + (ts.scelta === corr ? 'ok' : 'warn') + '"><b>' + (ts.scelta === corr ? t('giusto') : t('quasi')) + '</b> ' + md(q.spiegazione) + '</div>' + (V.voce ? '' : '<button class="btn" data-act="avanti">' + (ts.i + 1 >= ts.dom.length ? t('vedi_ris') : t('avanti')) + '</button>') : '') +
    (V.voce ? '<div class="row" style="margin-top:10px"><button class="btn sec" id="mic" data-act="mic">🎤 ' + t('rispondi_voce') + '</button><button class="btn sec" data-act="esci-voce">' + t('esci_voce') + '</button></div>' : '') + '</div>';
}
function vRipasso() {
  return barra() + '<div class="card"><h1>' + t('ripasso_oggi') + '</h1></div>' + (V.ripCap && V.test ? vTest(V.ripCap) : '<div class="card muted">' + t('nessun_ripasso') + '</div><button class="btn" data-act="home">' + t('studio') + '</button>');
}
function vEsercizio() {
  const es = S.esercizi.find(x => x.id === V.es); if (!es) return vHome();
  let h = barra() + '<div class="card"><div class="muted">' + esc(es.materia) + ' · ' + t('es_guidato') + '</div><h2>' + md(es.richiesta) + '</h2></div>';
  es.passi.forEach((p, i) => {
    if (i < es.i || es.finito) h += '<div class="card"><div class="step"><span class="num done">✓</span><div><b>' + esc(p.titolo) + '</b><div class="muted">' + t('hai_scritto') + ' ' + esc((es.fatti.find(f => f.i === i) || {}).risposta || '') + '</div></div></div></div>';
    else if (i === es.i) {
      const sh = V.mostra || {};
      h += '<div class="card" style="border-color:var(--accent)"><div class="step"><span class="num">' + (i + 1) + '</span><div style="flex:1"><h2>' + esc(p.titolo) + '</h2><p>' + md(p.domanda) + '</p>' +
        (V.passoOk ? '<div class="fb ok">' + md(V.fb.testo) + '</div><button class="btn" data-act="passo-avanti">' + (i + 1 >= es.passi.length ? t('concludi') : t('passo_succ')) + '</button>' :
          '<label class="f">' + t('la_tua_idea') + '<textarea id="idea" placeholder="' + esc(t('scrivi_qui')) + '">' + esc(V.bozza || '') + '</textarea></label>' +
          (V.fb ? '<div class="fb warn">' + md(V.fb.testo) + '</div>' : '') +
          arr(p.indizi).slice(0, sh.n || 0).map((x, k) => '<div class="fb"><b>' + t('indizio_n', { n: k + 1 }) + '</b> ' + md(x) + '</div>').join('') +
          (sh.es ? '<div class="fb"><b>' + t('es_simile') + ':</b> ' + md(p.esempio_simile) + '</div>' : '') +
          (V.errore ? '<div class="fb warn" role="alert">' + esc(V.errore) + '</div>' : '') +
          (V.busy ? '<p><span class="spin"></span></p>' : '<div class="row"><button class="btn" data-act="controlla">' + t('controlla_idea') + '</button><button class="btn sec" data-act="indizio"' + ((sh.n || 0) >= arr(p.indizi).length ? ' disabled' : '') + '>' + t('dammi_indizio') + ' (' + (sh.n || 0) + '/' + arr(p.indizi).length + ')</button><button class="btn sec" data-act="esempio">' + t('es_simile') + '</button></div>')) +
        '</div></div></div>';
    } else h += '<div class="card muted"><b>' + (i + 1) + '. ' + esc(p.titolo) + '</b> · ' + t('si_sblocca') + '</div>';
  });
  if (es.finito) h += '<div class="card"><div class="fb ok"><b>' + t('es_completato') + '</b> ' + t('indizi_usati', { n: es.indiziTotali }) + '</div><button class="btn" data-act="home">' + t('torna_studio') + '</button></div>';
  return h + '<div class="row" style="margin-bottom:12px"><button class="btn sec small" data-act="apri-materia" data-m="' + esc(es.materia) + '">‹ ' + esc(es.materia) + '</button></div>' + boxSposta(es, 'es') + '<p class="muted" style="text-align:center">' + t('no_soluzione') + '</p>';
}
function vGenitori() {
  if (!V.genitoriOk) return barra() + '<div class="card"><h1>' + t('area_gen') + '</h1><label class="f">' + t('pin') + '<input type="password" id="pinin" inputmode="numeric" maxlength="8" autocomplete="off"></label><button class="btn" data-act="pin-ok">' + t('entra') + '</button></div>';
  const lang = LINGUE_VOCE[LINGUA_CORRENTE];
  const figli = DB.figli.map(f => {
    const rr = []; f.capitoli.forEach(c => c.risultati.forEach(r => rr.push({ c: c, r: r })));
    const s0 = S; S = f; const nrip = ripDovute().length, ver = prossimeVerifiche(30); S = s0;
    rr.sort((a, b) => b.r.data.localeCompare(a.r.data));
    return '<div class="card"><h2>' + esc(f.profilo.nome) + (f.profilo.pin ? ' 🔒' : '') + '</h2><div class="row"><span class="chip">' + t('n_cap', { n: f.capitoli.length }) + '</span><span class="chip">' + t('test_fatti') + ': ' + rr.length + '</span><span class="chip">' + t('n_es', { n: f.esercizi.length }) + '</span><span class="chip ' + (nrip ? 'warn' : '') + '">' + t('ripasso_oggi') + ': ' + nrip + '</span></div><p></p>' +
      '<div class="row"><button class="btn small" data-act="apri-figlio" data-id="' + f.id + '">' + t('apri_come', { n: esc(f.profilo.nome) }) + '</button><button class="btn sec small" data-act="modifica-figlio" data-id="' + f.id + '">' + t('modifica') + '</button><button class="btn sec small" data-act="elimina-figlio" data-id="' + f.id + '">' + t('elimina_figlio') + '</button></div>' +
      (ver.length ? '<p></p><b>' + t('verifiche') + '</b>' + ver.map(x => '<p>' + esc(x.v.materia) + (x.v.argomento ? ' · ' + esc(x.v.argomento) : '') + ' <span class="chip ' + (x.d <= 3 ? 'warn' : '') + '">' + esc(quando(x.d)) + '</span></p>').join('') : '') +
      '<details><summary>' + t('da_rinforzare') + '</summary>' + (rr.length ? rr.slice(0, 8).map(x => '<p><b>' + esc(x.c.titolo) + '</b> · ' + t('p_su_n', { p: x.r.punti, n: x.r.totale }) + ' · ' + esc(new Date(x.r.data).toLocaleDateString(lang)) + (x.r.errati.length ? '<br><span class="muted">' + t('da_ripassare') + ': ' + esc(x.r.errati.join(', ')) + '</span>' : '') + '</p>').join('') : '<p class="muted">' + t('nessun_test') + '</p>') + '</details>' +
      '<details><summary>' + t('contenuti') + '</summary>' + (f.capitoli.length ? f.capitoli.map(c => '<p><b>' + esc(c.titolo) + '</b> <span class="muted">(' + esc(c.materia) + ')</span> <button class="btn sec small" data-act="apri-cap-di" data-f="' + f.id + '" data-id="' + c.id + '">' + t('vedi') + '</button></p>').join('') : '<p class="muted">–</p>') + f.esercizi.map(e => '<p><b>' + esc(e.materia) + '</b>: ' + esc(e.richiesta).slice(0, 70) + ' <span class="chip ' + (e.finito ? 'ok' : 'warn') + '">' + (e.finito ? t('completato') : t('in_corso')) + '</span></p>').join('') + '</details></div>';
  }).join('');
  const bk = FAM.ultimoBackup ? t('ultima_copia', { d: esc(new Date(FAM.ultimoBackup).toLocaleDateString(lang)) }) + (Date.now() - new Date(FAM.ultimoBackup).getTime() > 30 * 86400000 ? ' ' + t('copia_vecchia') : '') : '<b>' + t('no_copia') + '</b>';
  return barra() + '<div class="card"><h1>' + t('area_gen') + '</h1></div><h2>' + t('figli') + '</h2>' + (figli || '<div class="card muted">' + t('nessun_profilo') + '</div>') +
    '<div class="card"><button class="btn" data-act="aggiungi-figlio">+ ' + t('aggiungi_figlio') + '</button></div>' +
    '<div class="card"><h2>' + t('imp_famiglia') + '</h2><p class="muted">' + t('lingua_gen') + ': <b>' + LINGUE[FAM.lingua] + '</b> · ' + t('ai_titolo') + ': <b>' + esc(FAM.ai.provider) + '</b></p><button class="btn sec" data-act="modifica-fam">' + t('modifica') + '</button></div>' +
    '<div class="card"><h2>' + t('dati_sic') + '</h2><p class="muted">' + t('dati_info') + '</p><p class="muted">' + bk + '</p><div class="row"><button class="btn sec" data-act="esporta">' + t('salva_copia') + '</button><label class="btn sec">' + t('ripristina') + '<input type="file" accept="application/json" id="imp" hidden></label><button class="btn sec" id="installa" data-act="installa"' + (promptInstalla ? '' : ' hidden') + '>' + t('installa') + '</button><button class="btn sec" data-act="azzera">' + t('cancella_tutto') + '</button></div></div>';
}
function render() {
  if ((V.vista === 'fam' || V.vista === 'setup') && FAM.pin && !V.genitoriOk) V.vista = 'genitori';
  if (V.vista === 'genitori' && !FAM.pin) V.vista = 'fam';
  if (!S.profilo && ['home', 'materia', 'capitolo', 'esercizio', 'nuovo-cap', 'nuovo-es', 'controllo', 'aspetto', 'ripasso'].includes(V.vista)) V.vista = DB.figli.length ? 'scelta' : (FAM.pin ? 'genitori' : 'fam');
  if (!['genitori', 'fam', 'setup'].includes(V.vista)) V.genitoriOk = false;
  applicaTema();
  const v = V.vista;
  const M = { fam: vFam, setup: vSetup, scelta: vScelta, home: vHome, 'nuovo-cap': () => vNuovo('cap'), 'nuovo-es': () => vNuovo('es'), controllo: vControllo, materia: vMateria, capitolo: vCapitolo, esercizio: vEsercizio, genitori: vGenitori, aspetto: vAspetto, ripasso: vRipasso };
  document.getElementById('app').innerHTML = (M[v] || vHome)();
  const f1 = document.getElementById('f1'), f2 = document.getElementById('f2');
  if (f1) f1.onchange = e => aggiungiFoto([...e.target.files]);
  if (f2) f2.onchange = e => aggiungiFoto([...e.target.files]);
  const imp = document.getElementById('imp');
  if (imp) imp.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      try {
        if (txt.length > 30000000) throw new Error('grande');
        DB = pulisciDati(JSON.parse(txt)); FAM = DB.fam; S = statoVuoto(); migraTutti(); salva();
        lucchettoSalva({ n: 0, fino: 0 }); V.vista = 'fam'; V.genitoriOk = false; V.bozzaFam = null; render(); toast(t('ripristinata'));
      } catch (x) { toast(t('file_non_valido')); }
    });
  };
  if (v === 'fam') {
    const prov = document.getElementById('prov'), preset = document.getElementById('preset');
    document.getElementById('chiave').oninput = () => { const a = leggiAi(); if (a.provider !== prov.value) { prov.value = a.provider; prov.onchange(); } };
    prov.onchange = () => { document.getElementById('boxcompat').hidden = prov.value !== 'compat'; };
    preset.onchange = () => { const x = PRESET[preset.value]; document.getElementById('url').value = x.url; if (x.modello) document.getElementById('modello').value = x.modello; };
    document.getElementById('lingua-gen').onchange = e => { V.bozzaFam = { ai: leggiAi(), lingua: e.target.value }; FAM.lingua = e.target.value; render(); };
  }
  if (v === 'setup') {
    let toccato = false;
    document.querySelectorAll('[data-pref]').forEach(x => x.addEventListener('input', () => { toccato = true; }));
    document.getElementById('colori').addEventListener('change', () => { toccato = true; });
    document.querySelectorAll('[data-dsa]').forEach(x => x.onchange = () => {
      document.getElementById('info-' + x.dataset.dsa).hidden = !x.checked;
      const dis = document.querySelector('[data-dsa=dislessia]').checked;
      if (!toccato) {
        document.getElementById('colori').checked = !dis;
        const setv = (k, val) => { const e = document.querySelector('[data-pref="' + k + '"]'); if (e) e.value = val; };
        if (dis) { setv('font', 'lexend'); setv('lh', 1.8); setv('ls', 0.04); setv('ws', 0.1); } else { setv('font', 'tema'); setv('lh', 1.6); setv('ls', 0); setv('ws', 0); }
        anteprima();
      }
    });
  }
  if (v === 'setup' || v === 'aspetto') anteprima();
  if (V.voce) voceTick();
}
function anteprima() {
  const a = document.getElementById('anteprima'); if (!a) return;
  const g = k => { const e = document.querySelector('[data-pref="' + k + '"]'); return e ? e.value : ''; };
  a.style.fontFamily = FONT_STACK[g('font')] || '';
  a.style.lineHeight = g('lh') || '';
  a.style.letterSpacing = parseFloat(g('ls')) ? g('ls') + 'em' : '';
  a.style.wordSpacing = parseFloat(g('ws')) ? g('ws') + 'em' : '';
  if (V.vista === 'setup') a.style.fontSize = (parseFloat(g('fs')) || 1) + 'rem';
}
function migraTutti() { const s0 = S; DB.figli.forEach(f => { S = f; migraMaterie(); }); S = s0; }

/* ===== Azioni ===== */
function indovinaServizio(a) {
  if (a.provider === 'demo' && a.key) {
    if (/^sk-ant-/.test(a.key)) a.provider = 'anthropic';
    else if (/^sk-or-/.test(a.key)) a.provider = 'openrouter';
  }
  return a;
}
function leggiAi() {
  const g = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  return indovinaServizio({ provider: g('prov'), key: g('chiave'), model: g('modello'), preset: g('preset') || 'ollama', url: g('url') });
}
const AZ = {
  'prova-ai': async () => {
    const out = document.getElementById('esitoprova'); const a = leggiAi(); if (!a.key) { a.kc = FAM.ai.kc; a.key = FAM.ai.key; }
    if (a.provider === 'demo') { out.textContent = '–'; return; }
    out.textContent = '…';
    try { const r = await chiamaAI('Rispondi solo con la parola OK.', 'Rispondi OK.', [], a); out.textContent = t('esito_prova_ok') + ' ' + r.slice(0, 40); }
    catch (e) { out.textContent = e.message === 'NODEMO' ? t('chiave_api') + '?' : e.message; }
  },
  'home': () => { fermaVoce(); V.vista = S.profilo ? 'home' : 'scelta'; V.test = null; V.voce = false; V.lettura = null; },
  'genitori': () => { fermaVoce(); V.voce = false; V.lettura = null; V.test = null; V.vista = FAM.pin ? 'genitori' : 'fam'; },
  'fs+': () => { if (!S.profilo) return; S.profilo.fs = Math.min(1.5, (S.profilo.fs || 1) + .1); salva(); },
  'fs-': () => { if (!S.profilo) return; S.profilo.fs = Math.max(.9, (S.profilo.fs || 1) - .1); salva(); },
  'nuovo-cap': () => { if (!V.materia) { V.vista = 'home'; return; } V.vista = 'nuovo-cap'; V.foto = []; V.errore = ''; },
  'nuovo-es': () => { if (!V.materia) { V.vista = 'home'; return; } V.vista = 'nuovo-es'; V.foto = []; V.errore = ''; },
  'apri-materia': el => { V.materia = el.dataset.m; V.vista = 'materia'; V.test = null; },
  'aggiungi-materia': el => {
    let n = el.dataset.m; if (!n) { const i = document.getElementById('nuovaM'); n = i ? i.value : ''; }
    n = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!n) { toast('Scrivi il nome della materia.'); return 'async'; }
    n = n.charAt(0).toUpperCase() + n.slice(1);
    if (S.materie.some(m => sameM(m, n))) { toast('Questa materia c\'è già.'); return 'async'; }
    S.materie.push(n); salva();
  },
  'elimina-materia': () => {
    const m = V.materia; if (!confirm(t('conferma', { n: m }))) return 'async';
    S.materie = S.materie.filter(x => !sameM(x, m)); S.capitoli = S.capitoli.filter(c => !sameM(c.materia, m)); S.esercizi = S.esercizi.filter(x => !sameM(x.materia, m)); S.verifiche = S.verifiche.filter(v => !sameM(v.materia, m)); pulisciRip();
    salva(); V.vista = 'home'; V.materia = '';
  },
  'sposta': el => {
    const sel = document.getElementById('spostaM'); if (!sel || !sel.value) return 'async';
    const lista = el.dataset.k === 'es' ? S.esercizi : S.capitoli; const it = lista.find(x => x.id === el.dataset.id); if (!it) return 'async';
    it.materia = sel.value; V.materia = sel.value; salva(); toast(t('spostato', { n: sel.value }));
  },
  'elimina-cap': el => { const it = S.capitoli.find(x => x.id === el.dataset.id); if (!it || !confirm(t('conferma', { n: it.titolo }))) return 'async'; S.capitoli = S.capitoli.filter(x => x.id !== it.id); pulisciRip(); salva(); V.materia = it.materia; V.vista = 'materia'; },
  'elimina-es': el => { const it = S.esercizi.find(x => x.id === el.dataset.id); if (!it || !confirm(t('conferma', { n: String(it.richiesta).slice(0, 40) }))) return 'async'; S.esercizi = S.esercizi.filter(x => x.id !== it.id); salva(); V.materia = it.materia; V.vista = 'materia'; },
  'su': el => { const i = +el.dataset.i; if (i > 0) [V.foto[i - 1], V.foto[i]] = [V.foto[i], V.foto[i - 1]]; },
  'giu': el => { const i = +el.dataset.i; if (i < V.foto.length - 1) [V.foto[i + 1], V.foto[i]] = [V.foto[i], V.foto[i + 1]]; },
  'del': el => { V.foto.splice(+el.dataset.i, 1); },
  'prepara-cap': () => { preparaCapitolo(); return 'async'; },
  'prepara-es': () => { preparaEsercizio(); return 'async'; },
  'apri-cap': el => { V.cap = el.dataset.id; V.tab = 'riassunto'; V.test = null; V.vista = 'capitolo'; },
  'apri-es': el => { V.es = el.dataset.id; V.fb = null; V.passoOk = false; V.mostra = {}; V.bozza = ''; V.vista = 'esercizio'; },
  'tab': el => { V.tab = el.dataset.t; },
  'ascolta': () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async';
    const tx = V.tab === 'riassunto' ? c.riassunto_breve.join('. ') + '. ' + c.riassunto_completo
      : V.tab === 'glossario' ? c.glossario.map(g => g.termine + ': ' + g.definizione).join('. ')
      : V.tab === 'spiegazioni' ? c.spiegazioni.map(x => x.concetto + '. ' + x.spiegazione + ' ' + x.esempio).join(' ')
      : V.tab === 'schema' ? (c.schema.radice || c.titolo) + '. ' + arr(c.schema.rami).map(r => r.titolo + ': ' + arr(r.punti).join('. ')).join('. ')
      : c.titolo;
    leggiConEvidenza(tx); return 'async';
  },
  'stampa': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async'; document.getElementById('stampa').innerHTML = dispensaHTML(c); const t = document.title; document.title = c.titolo; try { window.print(); } catch (e) { toast('La stampa non è disponibile.'); } document.title = t; return 'async'; },
  'scarica': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async'; const b = new Blob(['\ufeff' + dispensaTesto(c)], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (c.titolo || 'capitolo').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) + '.txt'; document.body.appendChild(a); a.click(); a.remove(); return 'async'; },
  'completa': async () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return;
    if (FAM.ai.provider === 'demo') { toast('In modalità demo non si può completare.'); return; }
    V.busy = true; render();
    try {
      const n = await chiediJSON(SYS_COMPLETA + '\n\n' + profiloTesto(), 'Titolo: ' + c.titolo + '\nMateria: ' + c.materia + '\nRiassunto breve:\n- ' + c.riassunto_breve.join('\n- ') + '\n\nRiassunto completo:\n' + c.riassunto_completo, [], SCHEMA_CAPITOLO);
      if (!arr(c.schema && c.schema.rami).length && n.schema) c.schema = n.schema;
      if (!arr(c.spiegazioni).length) c.spiegazioni = arr(n.spiegazioni);
      if (!arr(c.glossario).length) c.glossario = arr(n.glossario);
      if (!arr(c.test).length) c.test = arr(n.test);
      if (!arr(c.inventario).length) c.inventario = arr(n.inventario);
      salva(); toast(mancano(c) ? 'Alcune parti mancano ancora: riprova.' : 'Fatto: ora c\'è tutto.');
    } catch (e) { toast('Non sono riuscito: ' + e.message); }
    V.busy = false; render();
  },
  'stop': () => { fermaVoce(); V.lettura = null; },
  'meglio': async el => { const c = S.capitoli.find(x => x.id === V.cap); const s = c.spiegazioni[+el.dataset.i]; const box = document.getElementById('m' + el.dataset.i); box.innerHTML = '<p><span class="spin"></span></p>';
    try { if (FAM.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 400)); box.innerHTML = '<div class="fb">In demo la spiegazione alternativa non è disponibile. Con la chiave AI, Scio la riscrive con parole e un esempio diversi.</div>'; }
      else { const t = await chiamaAI('Sei Scio, tutor di studio. Spiega in modo diverso, più semplice, con un nuovo esempio concreto. Massimo 6 frasi brevi, in italiano. Solo testo.\n\n' + profiloTesto(), 'Concetto: ' + s.concetto + '\nSpiegazione precedente: ' + s.spiegazione, []); box.innerHTML = '<div class="fb">' + md(t) + '</div>'; } }
    catch (e) { box.innerHTML = '<div class="fb warn">' + esc(e.message) + '</div>'; } return 'async'; },
  'inizia-voce': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c || !arr(c.test).length) return; V.voce = true; V.lettura = null; fermaVoce(); V.test = { cap: c.id, dom: c.test.map((_, i) => i), i: 0, punti: 0, errati: [], scelta: null, fine: false }; },
  'inizia-test': () => { const c = S.capitoli.find(x => x.id === V.cap); V.voce = false; V.test = { cap: c.id, dom: c.test.map((_, i) => i), i: 0, punti: 0, errati: [], scelta: null, fine: false }; },
  'rispondi': el => {
    const ts = V.test; if (!ts || ts.scelta != null) return;
    const c = capCorrente(); const ix = ts.dom[ts.i]; const q = c.test[ix]; const corr = q.tipo === 'vf' ? (q.corretta ? 0 : 1) : q.corretta;
    ts.scelta = +el.dataset.i; const ok = ts.scelta === corr; if (ok) ts.punti++; else ts.errati.push(ix);
    const mp = c._map ? c._map[ix] : [c.id, ix]; ripAggiorna(mp[0], mp[1], ok); salva();
  },
  'avanti': () => {
    const ts = V.test; if (!ts) return; const c = capCorrente(); ts.scelta = null; ts.i++;
    if (ts.i >= ts.dom.length) { ts.fine = true; if (!ts.ripasso && c.id !== '__rip') { c.risultati.push({ data: new Date().toISOString(), punti: ts.punti, totale: ts.dom.length, errati: [...new Set(ts.errati.map(i => c.test[i].argomento).filter(Boolean))] }); salva(); } }
  },
  'solo-errori': () => { const ts = V.test; V.test = { cap: ts.cap, dom: [...new Set(ts.errati)], i: 0, punti: 0, errati: [], scelta: null, fine: false, ripasso: true }; V.voce = false; fermaVoce(); },
  'chiudi-test': () => { V.test = null; V.voce = false; fermaVoce(); if (V.vista === 'ripasso') V.vista = 'home'; },
  'indizio': () => { const es = S.esercizi.find(x => x.id === V.es); const m = V.mostra = V.mostra || {}; m.n = (m.n || 0) + 1; es.indiziTotali++; salva(); V.bozza = (document.getElementById('idea') || {}).value || ''; },
  'esempio': () => { V.mostra = V.mostra || {}; V.mostra.es = true; V.bozza = (document.getElementById('idea') || {}).value || ''; },
  'controlla': () => { controllaIdea(); return 'async'; },
  'passo-avanti': () => { const es = S.esercizi.find(x => x.id === V.es); es.i++; if (es.i >= es.passi.length) { es.finito = true; es.i = es.passi.length - 1; } V.fb = null; V.passoOk = false; V.mostra = {}; V.bozza = ''; salva(); },
  'pin-ok': async () => {
    const l = lucchetto(), ora = Date.now();
    if (l.fino > ora) { toast(t('pin_attesa', { n: Math.ceil((l.fino - ora) / 1000) })); return 'async'; }
    const pin = document.getElementById('pinin').value.trim();
    if (await verificaPin(pin, FAM.pin)) {
      lucchettoSalva({ n: 0, fino: 0 }); V.genitoriOk = true;
      if (!String(FAM.pin).startsWith('p1.')) { FAM.pin = await hashPin(pin); salva(); }
    } else {
      const n = l.n + 1; lucchettoSalva({ n: n, fino: n >= 3 ? ora + Math.min(900, 15 * Math.pow(2, n - 3)) * 1000 : 0 });
      toast(t('pin_no'));
    }
    render(); return 'async';
  },
  'entra-figlio': el => { const f = DB.figli.find(x => x.id === el.dataset.id); if (!f) return; if (f.profilo.pin) { V.pinFiglio = f.id; return; } attiva(f.id); },
  'pin-figlio-ok': async () => {
    const f = DB.figli.find(x => x.id === V.pinFiglio); if (!f) return;
    const l = lucchetto(f.id), ora = Date.now();
    if (l.fino > ora) { toast(t('pin_attesa', { n: Math.ceil((l.fino - ora) / 1000) })); return 'async'; }
    if (await verificaPin(document.getElementById('pinfiglio').value.trim(), f.profilo.pin)) { lucchettoSalva({ n: 0, fino: 0 }, f.id); attiva(f.id); }
    else { const n = l.n + 1; lucchettoSalva({ n: n, fino: n >= 3 ? ora + Math.min(900, 15 * Math.pow(2, n - 3)) * 1000 : 0 }, f.id); toast(t('pin_no')); }
    render(); return 'async';
  },
  'scelta': () => { fermaVoce(); S = statoVuoto(); V.vista = 'scelta'; V.pinFiglio = null; V.test = null; V.voce = false; V.lettura = null; },
  'aspetto': () => { V.vista = 'aspetto'; },
  'apri-figlio': el => { attiva(el.dataset.id); },
  'apri-cap-di': el => { if (attiva(el.dataset.f)) { V.cap = el.dataset.id; V.tab = 'riassunto'; V.vista = 'capitolo'; } },
  'modifica-figlio': el => { V.edit = el.dataset.id; V.vista = 'setup'; },
  'aggiungi-figlio': () => { V.edit = null; V.vista = 'setup'; },
  'elimina-figlio': el => {
    const f = DB.figli.find(x => x.id === el.dataset.id); if (!f || !confirm(t('conferma', { n: f.profilo.nome }))) return 'async';
    DB.figli = DB.figli.filter(x => x.id !== f.id); if (S === f) S = statoVuoto();
    try { localStorage.removeItem('scio.lock.' + f.id); } catch (e) { /* non importa */ }
    salva(); V.vista = 'genitori';
  },
  'modifica-fam': () => { V.bozzaFam = null; V.vista = 'fam'; },
  'esporta': () => { const b = new Blob([JSON.stringify(datiEsportabili())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'scio-copia-dati-v' + VERSIONE + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); FAM.ultimoBackup = new Date().toISOString(); salva(); toast(t('copia_ok')); },
  'azzera': () => {
    if (!confirm(t('conferma', { n: t('cancella_tutto') }))) return;
    try { Object.keys(localStorage).filter(k => k.indexOf('scio.') === 0).forEach(k => localStorage.removeItem(k)); indexedDB.deleteDatabase('scio-sec'); } catch (e) { /* non importa */ }
    fermaVoce(); DB = { v: 3, fam: famVuota(), figli: [] }; FAM = DB.fam; S = statoVuoto(); V.vista = 'fam'; V.genitoriOk = false;
  },
  'installa': async () => { if (promptInstalla) { promptInstalla.prompt(); try { await promptInstalla.userChoice; } catch (e) { /* annullato */ } promptInstalla = null; } render(); return 'async'; },
  'rimuovi-chiave': () => { delete FAM.ai.key; delete FAM.ai.kc; if (FAM.ai.provider !== 'compat') FAM.ai.provider = 'demo'; salva(); toast(t('chiave_rimossa')); },
  'salva-fam': async () => {
    const pin = document.getElementById('pin').value.trim();
    if (pin || !FAM.pin) {
      if (!/^\d{4,8}$/.test(pin)) { toast(t('pin_cifre')); return 'async'; }
      if (pinBanale(pin)) { toast(t('pin_debole')); return 'async'; }
    }
    const ai = leggiAi();
    if (ai.provider === 'compat' && !urlConsentito(ai.url)) { toast(t('url_no')); return 'async'; }
    if (ai.key) { ai.kc = await cifra(ai.key); ai.key = ''; }
    else { ai.kc = FAM.ai.kc || ''; ai.key = ''; if (FAM.ai.key) ai.kc = await cifra(FAM.ai.key); }
    FAM.ai = ai; const l = document.getElementById('lingua-gen').value; FAM.lingua = LINGUE[l] ? l : 'it';
    if (pin) FAM.pin = await hashPin(pin);
    V.bozzaFam = null; V.genitoriOk = true; salva();
    V.vista = DB.figli.length ? 'genitori' : 'setup'; V.edit = null; render(); return 'async';
  },
  'salva-figlio': async () => {
    const nome = document.getElementById('nome').value.trim(); if (!nome) { toast(t('scrivi_nome')); return 'async'; }
    const f = V.edit ? DB.figli.find(x => x.id === V.edit) : null; const old = f ? f.profilo : {};
    const pinf = document.getElementById('pinf').value.trim();
    if (pinf) { if (!/^\d{4,8}$/.test(pinf)) { toast(t('pin_cifre')); return 'async'; } if (pinBanale(pinf)) { toast(t('pin_debole')); return 'async'; } }
    const dsa = {}; document.querySelectorAll('[data-dsa]').forEach(x => { if (x.checked) dsa[x.dataset.dsa] = true; });
    const g = k => { const e = document.querySelector('[data-pref="' + k + '"]'); return e ? e.value : ''; };
    const num = (k, d) => { const v = parseFloat(g(k)); return isFinite(v) ? v : d; };
    const livello = document.getElementById('livello').value === 'media' ? 'media' : 'superiori';
    const lg2 = document.getElementById('lingua-fig').value;
    const rm = document.getElementById('rmpin');
    const prof = { nome: nome, livello: livello, lingua: LINGUE[lg2] ? lg2 : 'it', dsa: dsa, tema: (document.querySelector('input[name=tema]:checked') || {}).value || consigliato(livello, dsa), colori: document.getElementById('colori').checked, fs: num('fs', 1), font: g('font') || 'tema', lh: num('lh', 0), ls: num('ls', 0), ws: num('ws', 0), vel: num('vel', 0.9), pin: pinf ? await hashPin(pinf) : (rm && rm.checked ? '' : (old.pin || '')) };
    if (f) f.profilo = prof; else { const n = statoVuoto(); n.profilo = prof; DB.figli.push(n); }
    salva(); V.edit = null;
    if (!f && DB.figli.length === 1) attiva(DB.figli[0].id); else { V.vista = 'genitori'; V.genitoriOk = true; }
    render(); return 'async';
  },
  'inizia-ripasso': () => {
    const due = ripDovute().slice(0, 15); if (!due.length) return;
    V.ripCap = { id: '__rip', titolo: t('ripasso_oggi'), materia: '', test: due.map(x => x.cap.test[x.i]), risultati: [], _map: due.map(x => [x.cap.id, x.i]) };
    V.test = { cap: '__rip', dom: V.ripCap.test.map((_, i) => i), i: 0, punti: 0, errati: [], scelta: null, fine: false, ripasso: true }; V.vista = 'ripasso';
  },
  'aggiungi-verifica': () => {
    const d = (document.getElementById('vdata') || {}).value || '', a = ((document.getElementById('varg') || {}).value || '').trim().slice(0, 80);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(parseData(d))) { toast(t('data') + '?'); return 'async'; }
    S.verifiche.push({ id: uid(), materia: V.materia, data: d, argomento: a }); S.verifiche.sort((x, y) => x.data.localeCompare(y.data)); salva();
  },
  'elimina-verifica': el => { S.verifiche = S.verifiche.filter(v => v.id !== el.dataset.id); salva(); },
  'nuovo-controllo': () => { if (!V.materia) { V.vista = 'home'; return; } V.vista = 'controllo'; V.foto = []; V.errore = ''; V.controllo = null; V.cosa = ''; },
  'controlla-svol': () => { controllaSvolgimento(); return 'async'; },
  'spiega-gen': () => { spiegaGen(); return 'async'; },
  'mic': () => { ascoltaRisposta(); return 'async'; },
  'esci-voce': () => { V.voce = false; fermaVoce(); }
};

/* ===== Controllo dello svolgimento e spiegazione per i genitori ===== */
const attendi = ms => new Promise(r => setTimeout(r, ms));
const SYS_CONTROLLO = `Sei Scio, un tutor che guida il ragionamento. Ricevi la foto dello svolgimento che uno studente ha scritto a mano (e, se c'è, il testo dell'esercizio).
Leggi con attenzione ogni passaggio. Per matematica e fisica rifai i calcoli per te stesso; per latino e greco controlla l'analisi (verbo, soggetto, casi, complementi, costruzione) senza tradurre al posto dello studente.
Regole IMPORTANTI:
- NON scrivere MAI il risultato corretto, la soluzione, il testo corretto o la traduzione. Non riscrivere i passaggi sbagliati nella forma giusta.
- Per ogni passaggio dello studente indica se è "ok", "da_controllare" o "errore". Se c'è un errore, di' DOVE si trova (quale passaggio o riga) e di che TIPO è (segno, regola applicata male, unità di misura, calcolo, concordanza, caso...) e scrivi un suggerimento sotto forma di domanda guida, per esempio "Che cosa succede al segno quando sposti il termine dall'altra parte?".
- Se tutto è giusto, dillo con calore e, se utile, suggerisci di verificare con un metodo diverso (per esempio la prova).
- Se la scrittura non si legge, dillo nel riepilogo e chiedi una foto più chiara: non inventare.
- "domanda_guida": una sola domanda che aiuti lo studente a trovare da solo il primo errore (vuota se non ci sono errori).
Tono incoraggiante, frasi brevi.`;
const SCHEMA_CONTROLLO = OBJ({ riepilogo: T, passi: { type: 'array', description: 'Un elemento per ogni passaggio scritto dallo studente, nell\'ordine', items: OBJ({ cosa_hai_fatto: T, esito: { type: 'string', enum: ['ok', 'da_controllare', 'errore'] }, suggerimento: T }) }, domanda_guida: T });
const DEMO_CONTROLLO = { riepilogo: 'Esempio: in modalità demo Scio non legge la tua foto. Con la chiave AI controlla davvero i tuoi passaggi, senza mai darti la soluzione.', passi: [{ cosa_hai_fatto: 'Passaggio 1 (esempio)', esito: 'ok', suggerimento: '' }, { cosa_hai_fatto: 'Passaggio 2 (esempio)', esito: 'errore', suggerimento: 'Guarda il segno: che cosa succede quando cambi lato?' }], domanda_guida: 'Che operazione devi fare su entrambi i lati per mantenere l\'uguaglianza?' };
async function controllaSvolgimento() {
  V.cosa = ((document.getElementById('cosa') || {}).value || '').trim();
  const demo = FAM.ai.provider === 'demo';
  if (!V.foto.length && !demo) { toast(t('serve_foto')); return; }
  V.busy = true; V.errore = ''; V.controllo = null; render();
  try {
    let r;
    if (demo) { await attendi(700); r = JSON.parse(JSON.stringify(DEMO_CONTROLLO)); }
    else r = await chiediJSON(SYS_CONTROLLO + '\n\n' + profiloTesto(), 'Materia: ' + V.materia + '.' + (V.cosa ? ' Testo dell\'esercizio: ' + V.cosa : '') + ' Controlla lo svolgimento dello studente nelle foto.', V.foto, SCHEMA_CONTROLLO);
    r.passi = arr(r.passi); S.controlli = (S.controlli || 0) + 1; salva(); V.controllo = r; V.busy = false; V.foto = []; render();
  } catch (e) { V.busy = false; V.errore = e.message === 'NODEMO' ? t('serve_ai') : e.message; render(); }
}
async function spiegaGen() {
  const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return;
  if (FAM.ai.provider === 'demo') { toast(t('serve_ai')); return; }
  V.busy = true; render();
  try {
    const nome = LINGUE_NOME_IT[FAM.lingua] || 'italiano';
    const txt = await chiamaAI('Sei Scio. Scrivi in ' + nome + ' un testo di 8-10 righe per un genitore che non conosce bene l\'italiano: di cosa parla il capitolo, i 5 concetti principali (con il termine italiano tra parentesi) e come aiutare il figlio a ripassare. Linguaggio semplice, solo testo, nessun titolo, nessun elenco numerato.', 'Titolo: ' + c.titolo + '\nMateria: ' + c.materia + '\nRiassunto breve:\n- ' + c.riassunto_breve.map(plain).join('\n- ') + '\n\nRiassunto completo:\n' + plain(c.riassunto_completo).slice(0, 7000), []);
    V.genRiass = { id: c.id, testo: txt };
  } catch (e) { toast(e.message === 'NODEMO' ? t('serve_ai') : e.message); }
  V.busy = false; render();
}
function inFotoView() { return V.vista === 'nuovo-cap' || V.vista === 'nuovo-es' || V.vista === 'controllo'; }
/* Regolazioni dell'aspetto: si applicano subito e, nella schermata "Aspetto", si salvano */
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.pref) return;
  if (el.type === 'radio' && !el.checked) return;
  if (V.vista === 'aspetto' && S.profilo) {
    const k = el.dataset.pref; S.profilo[k] = (k === 'font' || k === 'tema') ? el.value : parseFloat(el.value);
    salva(); applicaTema();
  }
  anteprima();
});
document.addEventListener('dragover', e => { if (inFotoView()) e.preventDefault(); });
document.addEventListener('drop', e => { if (!inFotoView()) return; e.preventDefault(); aggiungiFoto([...(e.dataTransfer && e.dataTransfer.files || [])]); });
document.addEventListener('paste', e => { if (!inFotoView()) return; const f = [...(e.clipboardData && e.clipboardData.files || [])]; if (f.length) { e.preventDefault(); aggiungiFoto(f); } });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = AZ[el.dataset.act]; if (!f) return;
  const r = f(el);
  if (r === 'async' || (r && typeof r.then === 'function')) return;
  render();
});

/* Migrazione: chiave e PIN di versioni precedenti */
(async () => {
  try {
    if (FAM.ai && FAM.ai.key) { FAM.ai.kc = await cifra(FAM.ai.key); FAM.ai.key = ''; }
    if (FAM.pin && !String(FAM.pin).startsWith('p1.') && /^\d{4,8}$/.test(FAM.pin)) FAM.pin = await hashPin(FAM.pin);
    if (salva() && DB.figli.length && localStorage.getItem(LS_V2)) { localStorage.removeItem(LS_V2); localStorage.removeItem(LS_VECCHIO); }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) { /* migrazione non riuscita: i dati restano com'erano */ }
})();
/* Installazione e aggiornamenti */
var promptInstalla = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalla = e; const b = document.getElementById('installa'); if (b) b.hidden = false; });
if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
  navigator.serviceWorker && navigator.serviceWorker.register('sw.js').then(r => {
    r.addEventListener('updatefound', () => { const w = r.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nuova versione di Scio pronta: chiudi e riapri l\'app.'); }); });
  }).catch(() => {});
}
render();