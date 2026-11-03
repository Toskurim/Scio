'use strict';
/* ===== AI.st.ain v0.8.1 — app web installabile (PWA) ===== */
/* Anti-clickjacking: AI.st.ain non si lascia incorniciare in altre pagine. */
if (window.top !== window.self) { document.documentElement.textContent = ''; throw new Error('AI.st.ain non può essere aperto dentro un\'altra pagina.'); }
const VERSIONE = '0.29';
const SEZ = ['riassunto', 'schema', 'mappa', 'spiegazioni', 'glossario', 'costruisci', 'pratica', 'orale'];
const LIVELLI = ['elementari', 'media', 'superiori', 'universita'];
const LS = 'scio.v0.3';
const LS_V2 = 'scio.v0.2';
const LS_VECCHIO = 'scio.v0.1';
/* Servizi "compatibili OpenAI": stesso formato, cambia solo l'indirizzo. */
const PRESET = {
  ollama:   { nome: 'Ollama sul mio PC (gratis, privato)', url: 'http://localhost:11434/v1', modello: 'gemma4:26b', chiave: false },
  lmstudio: { nome: 'LM Studio sul mio PC (gratis, privato)', url: 'http://localhost:1234/v1', modello: '', chiave: false },
  gemini:   { nome: 'Google Gemini (chiave gratuita di AI Studio)', url: 'https://generativelanguage.googleapis.com/v1beta/openai', modello: 'gemini-3.8-flash', chiave: true },
  groq:     { nome: 'Groq', url: 'https://api.groq.com/openai/v1', modello: '', chiave: true }
};
const GEMINI_ALT = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const METODI = ['riassunto', 'schema', 'mappa', 'spiegazioni', 'glossario', 'costruisci', 'pratica', 'orale', 'ascolto', 'libro', 'insieme'];
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
function statoVuoto() { return { id: uid(), profilo: null, capitoli: [], esercizi: [], materie: [], rip: {}, verifiche: [], controlli: 0, premi: premiVuoti(), esp: null }; }
function famVuota() { const l = String(navigator.language || 'it').slice(0, 2).toLowerCase(); return { pin: '', ai: aiVuoto(), lingua: LINGUE[l] ? l : 'it', ultimoBackup: '', dsaAI: true }; }
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
  fermaVoce(); V.or = null; S = f; V.vista = 'home'; V.materia = ''; V.cap = null; V.es = null; V.test = null; V.voce = false; V.pinFiglio = null; V.genitoriOk = false; V.controllo = null; V.genRiass = null; V.genVede = false; return true;
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
    const profilo = { nome: Tx(pr.nome, 60), livello: LIVELLI.includes(pr.livello) ? pr.livello : 'superiori', dsa: {}, tema: TEMI[pr.tema] ? pr.tema : 'calmo', fs: R(pr.fs, 0.8, 2, 1), colori: !!pr.colori, metodo: { chiedi: !(pr.metodo && pr.metodo.chiedi === false), confronto: !(pr.metodo && pr.metodo.confronto === false), esperimento: !(pr.metodo && pr.metodo.esperimento === false) }, lingua: LINGUE[pr.lingua] ? pr.lingua : 'it', font: ['tema', 'lexend', 'andika', 'atkinson', 'sistema'].includes(pr.font) ? pr.font : 'tema', lh: R(pr.lh, 1.3, 2.4, 0), ls: R(pr.ls, 0, 0.2, 0), ws: R(pr.ws, 0, 0.4, 0), vel: R(pr.vel, 0.5, 1.5, 0.9), voce: Tx(pr.voce, 160), pin: '', sezioni: {} };
    SEZ.forEach(k => { profilo.sezioni[k] = !(pr.sezioni && pr.sezioni[k] === false); });
    Object.keys(DSA).forEach(k => { if (pr.dsa && pr.dsa[k] === true) profilo.dsa[k] = true; });
    profilo.tema = temaValido(profilo); profilo.auto = pr.auto !== false;
    const capitoli = A(c.capitoli).filter(x => x && typeof x === 'object').slice(0, 500).map(x => ({
      id: ID(x.id), data: Tx(x.data, 40), materia: Tx(x.materia, 60), focus: Tx(x.focus, 300), titolo: Tx(x.titolo, 300), inventario: L(x.inventario, 500), avvisi: L(x.avvisi, 800),
      riassunto_breve: L(x.riassunto_breve, 1500), riassunto_completo: Tx(x.riassunto_completo),
      schema: { radice: Tx(x.schema && x.schema.radice, 300), rami: A(x.schema && x.schema.rami).filter(r => r && typeof r === 'object').map(r => ({ titolo: Tx(r.titolo, 300), punti: L(r.punti, 800) })) },
      mappa: pulisciMappa(x.mappa), mesc: !!x.mesc, lvl: Math.max(1, Math.min(5, Math.floor(N(x.lvl)) || 1)), pratica: normPratica(x.pratica), mio: normMio(x.mio), orali: arr(x.orali).filter(o => o && typeof o === 'object').slice(-100).map(o => ({ data: Tx(o.data, 40), pct: Math.max(0, Math.min(100, Math.floor(N(o.pct)))) })),
      spiegazioni: A(x.spiegazioni).filter(s => s && typeof s === 'object').map(s => ({ concetto: Tx(s.concetto, 300), spiegazione: Tx(s.spiegazione), esempio: Tx(s.esempio) })),
      glossario: A(x.glossario).filter(g => g && typeof g === 'object').map(g => ({ termine: Tx(g.termine, 300), definizione: Tx(g.definizione, 3000) })),
      test: A(x.test).filter(q => q && typeof q === 'object').map(q => ({ tipo: q.tipo === 'vf' ? 'vf' : 'scelta', argomento: Tx(q.argomento, 300), domanda: Tx(q.domanda, 2000), opzioni: L(q.opzioni, 800), corretta: typeof q.corretta === 'boolean' ? q.corretta : N(q.corretta), spiegazione: Tx(q.spiegazione, 3000), d: Math.max(1, Math.min(5, Math.floor(N(q.d)) || 1)) })),
      risultati: A(x.risultati).filter(r => r && typeof r === 'object').map(r => ({ data: Tx(r.data, 40), punti: N(r.punti), totale: N(r.totale) || 1, errati: L(r.errati, 300), come: Array.isArray(r.come) ? L(r.come, 20).filter(k => METODI.includes(k)) : null })),
      uso: (() => { const u = {}; METODI.forEach(k => { if (x.uso && x.uso[k] === 1) u[k] = 1; }); return u; })()
    }));
    const esercizi = A(c.esercizi).filter(e => e && typeof e === 'object').slice(0, 500).map(e => ({
      id: ID(e.id), data: Tx(e.data, 40), materia: Tx(e.materia, 60), richiesta: Tx(e.richiesta, 5000),
      passi: A(e.passi).filter(x => x && typeof x === 'object').map(x => ({ titolo: Tx(x.titolo, 300), domanda: Tx(x.domanda, 3000), obiettivo: Tx(x.obiettivo, 3000), indizi: L(x.indizi, 3000), esempio_simile: Tx(x.esempio_simile, 3000) })),
      i: N(e.i), indizi: N(e.indizi), indiziTotali: N(e.indiziTotali), fatti: A(e.fatti).filter(x => x && typeof x === 'object').map(x => ({ i: N(x.i), risposta: Tx(x.risposta, 3000) })), finito: !!e.finito
    }));
    const ripetizioni = {};
    if (c.rip && typeof c.rip === 'object') Object.keys(c.rip).slice(0, 3000).forEach(k => { const r = c.rip[k]; if (/^[A-Za-z0-9_-]{1,40}\|\d{1,4}$/.test(k) && r && typeof r === 'object' && DATA(r.next)) ripetizioni[k] = { b: Math.max(0, Math.min(6, Math.floor(N(r.b)))), next: DATA(r.next) }; });
    const verifiche = A(c.verifiche).filter(v => v && typeof v === 'object' && DATA(v.data)).slice(0, 200).map(v => ({ id: ID(v.id), materia: Tx(v.materia, 60), data: DATA(v.data), argomento: Tx(v.argomento, 120) }));
    return { id: ID(c.id), profilo, capitoli, esercizi, materie: L(c.materie, 60).filter(m => m.trim()), rip: ripetizioni, verifiche, controlli: Math.max(0, Math.floor(N(c.controlli))), premi: pulisciPremi(c.premi), esp: (c.esp && METODI.includes(c.esp.m)) ? { m: c.esp.m, dal: Tx(c.esp.dal, 40), base: Math.max(0, Math.min(100, N(c.esp.base))) } : null };
  });
  const fam = famVuota();
  if (p.fam && typeof p.fam === 'object' && LINGUE[p.fam.lingua]) fam.lingua = p.fam.lingua;
  if (p.fam && typeof p.fam === 'object') fam.dsaAI = p.fam.dsaAI !== false;
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
function lg() { return (['genitori', 'fam', 'setup', 'scelta', 'stat', 'privacy'].includes(V.vista) || !S.profilo) ? (FAM.lingua || 'it') : (S.profilo.lingua || 'it'); }
function applicaTema() {
  const p = S.profilo, b = document.body, r = document.documentElement;
  /* senza profilo attivo (scelta profilo, area genitori) resta l'ultimo tema usato, così non cambia da solo */
  let tema = 'calmo';
  try { if (p) { tema = temaValido(p); localStorage.setItem('scio.tema', tema); } else { const u = localStorage.getItem('scio.tema'); if (TEMI[u]) tema = u; } } catch (e) { if (p) tema = temaValido(p); }
  b.setAttribute('data-tema', tema);
  if (p && p.livello) b.setAttribute('data-liv', p.livello); else b.removeAttribute('data-liv');
  r.style.setProperty('--fs', p && p.fs ? p.fs : 1);
  const set = (k, v) => { if (v) b.style.setProperty(k, v); else b.style.removeProperty(k); };
  set('--font', p && FONT_STACK[p.font]); set('--lh', p && p.lh); set('--ls', p && p.ls ? p.ls + 'em' : ''); set('--ws', p && p.ws ? p.ws + 'em' : '');
  const l = lg(); LINGUA_CORRENTE = l; r.lang = l; r.dir = l === 'ar' ? 'rtl' : 'ltr';
}

/* ===== Collegamento all'AI ===== */
const TESTO_LIVELLO = {
  elementari: 'scuola elementare (6-10 anni). ADATTA TUTTO A UN BAMBINO: frasi corte (al massimo 12 parole), parole semplici e concrete, niente gergo; ogni spiegazione al massimo 3 frasi con un esempio dalla vita di tutti i giorni; riassunto_breve di 3 frasi; nel glossario definizioni con parole da bambino; tono giocoso e incoraggiante; il test ha da 10 a 15 domande (invece di 20-30), con domande molto semplici e dirette',
  media: 'scuola media (11-13 anni)',
  superiori: 'scuola superiore (14-18 anni)',
  universita: 'università (19 anni e oltre). ADATTA TUTTO A UNO STUDENTE ADULTO: registro tecnico e rigoroso, terminologia disciplinare corretta, definizioni precise, spiegazioni più approfondite con collegamenti tra concetti e con la teoria più ampia; nel test privilegia domande di ragionamento e applicazione rispetto alla memoria'
};
function profiloTesto() {
  const p = S.profilo;
  const dsa = FAM.dsaAI === false ? [] : Object.keys(DSA).filter(k => p.dsa && p.dsa[k]).map(k => DSA[k]);
  /* Il nome del ragazzo non viene mai inviato al servizio AI. */
  return 'Studente: ' + TESTO_LIVELLO[p.livello || 'superiori'] + '.\n' +
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
  if (compat && !urlConsentito(a.url)) throw new Error('Indirizzo non consentito: per sicurezza AI.st.ain parla solo con il PC di casa (localhost), Gemini e Groq. Scegli uno dei servizi dell\'elenco.');
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
  if (!compat) head['x-title'] = 'AI.st.ain';
  let r;
  /* Gemini: se il servizio è sovraccarico (503, 429) o il modello non c'è più (404), riprova con un modello vicino */
  const gem = compat && /generativelanguage\.googleapis\.com/.test(a.url);
  const catena = gem ? [a.model || PRESET.gemini.modello].concat(GEMINI_ALT).filter((m, i, v) => m && v.indexOf(m) === i).slice(0, 3) : [a.model || (compat ? undefined : 'google/gemini-2.5-flash')];
  try {
    for (let i = 0; i < catena.length; i++) {
      r = await fetch(url, { method: 'POST', headers: head,
        body: JSON.stringify({ model: catena[i], temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: content }] }) });
      if (r.ok || !gem || ![429, 500, 503, 404].includes(r.status) || i === catena.length - 1) break;
      if (typeof toast === 'function') toast('Il servizio è occupato: provo con un altro modello…');
      await new Promise(x => setTimeout(x, 2500));
    }
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
  pratica: { type: 'array', description: 'Da 4 a 8 esercizi di allenamento ispirati agli esercizi del libro (dati diversi), con soluzione riservata e 3 indizi', items: OBJ({ testo: T, soluzione: T, indizi: LS_ }) },
  glossario: { type: 'array', description: 'Almeno 8 termini chiave', items: OBJ({ termine: T, definizione: T }) },
  test: { type: 'array', description: 'NON fare domande sugli esercizi del libro (cosa chiedono): solo sui concetti. Da 20 a 30 domande (più il capitolo è lungo, più domande): circa 7 su 10 con tipo "scelta" (4 opzioni) e le altre con tipo "vf"', items: OBJ({ tipo: { type: 'string', enum: ['scelta', 'vf'] }, argomento: T, domanda: T, opzioni: Object.assign({ description: 'Solo per tipo scelta: 4 opzioni di lunghezza e dettaglio simili; la giusta non è la più lunga; le sbagliate sono plausibili' }, LS_), corretta: { description: 'Per scelta: indice 0-3 dell\'opzione giusta. Per vf: true o false' }, spiegazione: T }, ['tipo', 'argomento', 'domanda', 'corretta', 'spiegazione']) }
});
SCHEMA_CAPITOLO.required = SCHEMA_CAPITOLO.required.filter(k => k !== 'pratica');
const SCHEMA_ESERCIZIO = OBJ({
  materia: T, richiesta: T,
  passi: { type: 'array', description: '3-6 passi di ragionamento', items: OBJ({ titolo: T, domanda: T, obiettivo: T, indizi: Object.assign({ description: 'Esattamente 3 indizi dal più leggero al più chiaro, senza la soluzione' }, LS_), esempio_simile: T }) }
});
const SCHEMA_VALUTA = OBJ({ esito: { type: 'string', enum: ['giusto', 'quasi', 'da_rivedere'] }, feedback: T });

/* ===== Mappe concettuali ===== */
const MP = { W: 190, GAP: 150 };
function pulisciMappa(m) {
  const A = x => Array.isArray(x) ? x : [];
  const Tx = (x, n) => (typeof x === 'string' ? x : '').slice(0, n);
  const vistiId = new Set();
  const P = (x, a, b) => { x = Number(x); return Number.isFinite(x) ? Math.max(a, Math.min(b, Math.round(x))) : null; };
  const nodi = A(m && m.nodi).filter(n => n && typeof n === 'object').slice(0, 60).map(n => { const o = { id: Tx(n.id, 20).replace(/[^A-Za-z0-9_-]/g, ''), testo: Tx(n.testo, 120).trim() }; const px = P(n.px, 0, 5000), py = P(n.py, 0, 5000); if (px !== null && py !== null) { o.px = px; o.py = py; } return o; })
    .filter(n => n.id && n.testo && !vistiId.has(n.id) && vistiId.add(n.id));
  const relazioni = A(m && m.relazioni).filter(r => r && typeof r === 'object').slice(0, 120).map(r => ({ da: Tx(r.da, 20).replace(/[^A-Za-z0-9_-]/g, ''), a: Tx(r.a, 20).replace(/[^A-Za-z0-9_-]/g, ''), etichetta: Tx(r.etichetta, 60).trim(), x: r.x === true, ldx: P(r.ldx, -1500, 1500) || 0, ldy: P(r.ldy, -1500, 1500) || 0 }))
    .filter(r => vistiId.has(r.da) && vistiId.has(r.a) && r.da !== r.a).map(r => { if (!r.ldx) delete r.ldx; if (!r.ldy) delete r.ldy; return r; });
  return { nodi, relazioni };
}
const haMappa = c => !!(c && c.mappa && Array.isArray(c.mappa.nodi) && c.mappa.nodi.length >= 2);
const senzaMarc = t => String(t == null ? '' : t).replace(/\[\[[dcp]:(.+?)\]\]/g, '$1').replace(/\*\*/g, '');
function spezza(t, max, maxRighe) {
  const parole = String(t).split(/\s+/).filter(Boolean), r = []; let cur = '';
  parole.forEach(p => { if (cur && (cur + ' ' + p).length > max) { r.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p; });
  if (cur) r.push(cur);
  if (r.length > maxRighe) { const k = r.slice(0, maxRighe); k[maxRighe - 1] += '…'; return k; }
  return r;
}
/* Mappa di ripiego, senza AI: dallo schema del capitolo. */
function mappaDaSchema(c) {
  const nodi = [{ id: 'n0', testo: senzaMarc(c.schema && c.schema.radice || c.titolo) }], relazioni = [];
  arr(c.schema && c.schema.rami).slice(0, 8).forEach((r, i) => {
    nodi.push({ id: 'r' + i, testo: senzaMarc(r.titolo) }); relazioni.push({ da: 'n0', a: 'r' + i, etichetta: 'comprende' });
    arr(r.punti).slice(0, 5).forEach((p, j) => { nodi.push({ id: 'p' + i + '_' + j, testo: senzaMarc(p) }); relazioni.push({ da: 'r' + i, a: 'p' + i + '_' + j, etichetta: 'include' }); });
  });
  return pulisciMappa({ nodi, relazioni });
}
function mappaLayout(m) {
  const nodo = {}; m.nodi.forEach(n => { nodo[n.id] = { id: n.id, righe: spezza(senzaMarc(n.testo), 24, 4) }; });
  const rel = m.relazioni.map((r, i) => ({ da: r.da, a: r.a, etichetta: senzaMarc(r.etichetta), albero: false, x: !!r.x, i, ldx: Number(r.ldx) || 0, ldy: Number(r.ldy) || 0 })).filter(r => nodo[r.da] && nodo[r.a] && r.da !== r.a);
  const esplicito = rel.some(r => r.x); /* struttura già esplicita: i collegamenti trasversali non fanno da ramo */
  const radice = m.nodi[0].id; /* il primo nodo è sempre il concetto centrale */
  const figli = {}, prof = {}; prof[radice] = 0;
  const coda = [radice];
  while (coda.length) { const id = coda.shift(); rel.forEach(r => { if (r.da === id && !(r.a in prof) && !(esplicito && r.x)) { prof[r.a] = prof[id] + 1; r.albero = true; (figli[id] = figli[id] || []).push(r.a); coda.push(r.a); } }); }
  m.nodi.forEach(n => { if (!(n.id in prof)) { prof[n.id] = 1; (figli[radice] = figli[radice] || []).push(n.id); rel.push({ da: radice, a: n.id, etichetta: '', albero: true, x: false, i: -1, ldx: 0, ldy: 0 }); } });
  const maxRighe = Math.max.apply(null, Object.keys(nodo).map(k => nodo[k].righe.length));
  const h = 18 + maxRighe * 18, slot = h + 14;
  let cursore = 10;
  const posiziona = id => { const k = figli[id] || [], n = nodo[id]; if (!k.length) { n.y = cursore + h / 2; cursore += slot; return; } k.forEach(posiziona); n.y = (nodo[k[0]].y + nodo[k[k.length - 1]].y) / 2; };
  posiziona(radice);
  Object.keys(nodo).forEach(k => { nodo[k].d = prof[k]; nodo[k].x = 10 + prof[k] * (MP.W + MP.GAP); });
  /* posizioni scelte a mano (trascinando i nodi) */
  m.nodi.forEach(n => { if (Number.isFinite(n.px) && Number.isFinite(n.py)) { nodo[n.id].x = n.px; nodo[n.id].y = n.py; nodo[n.id].libero = true; } });
  const tutti = Object.keys(nodo).map(k => nodo[k]);
  return { nodo, rel, h, W: Math.max.apply(null, tutti.map(o => o.x)) + MP.W + 10, H: Math.max.apply(null, tutti.map(o => o.y)) + h / 2 + 10, radice };
}
function mappaSVG(m, zoom, titolo, edit, sel) {
  const L = mappaLayout(m), W = MP.W;
  let archi = '', etich = '', nodi = '';
  L.rel.forEach(r => {
    const a = L.nodo[r.da], b = L.nodo[r.a];
    let x1, x2, c1, c2, lx;
    if (b.x > a.x + 4) { x1 = a.x + W; x2 = b.x; c1 = c2 = (x1 + x2) / 2; lx = c1; }
    else if (b.x < a.x - 4) { x1 = a.x; x2 = b.x + W; c1 = c2 = (x1 + x2) / 2; lx = c1; }
    else { x1 = a.x; x2 = b.x; c1 = c2 = x1 - 70; lx = x1 - 52; }
    archi += '<path class="mp-arco' + (r.albero ? '' : ' mp-cross') + '" d="M' + x1 + ' ' + a.y + ' C' + c1 + ' ' + a.y + ' ' + c2 + ' ' + b.y + ' ' + x2 + ' ' + b.y + '" marker-end="url(#mpfr)"/>';
    if (r.etichetta) {
      const rg = spezza(r.etichetta, 16, 2), w = Math.max.apply(null, rg.map(x => x.length)) * 6.6 + 10, hh = rg.length * 14 + 4, ly = (a.y + b.y) / 2 + r.ldy;
      lx += r.ldx;
      etich += '<g' + (edit && r.i >= 0 ? ' class="mp-drag mp-dlab" data-drag="lab" data-i="' + r.i + '"' : '') + '><rect class="mp-lab" x="' + (lx - w / 2) + '" y="' + (ly - hh / 2) + '" width="' + w + '" height="' + hh + '" rx="4"/><text class="mp-lt" text-anchor="middle">' +
        rg.map((x, i) => '<tspan x="' + lx + '" y="' + (ly - hh / 2 + 13 + i * 14) + '">' + esc(x) + '</tspan>').join('') + '</text></g>';
    }
  });
  Object.keys(L.nodo).forEach(k => {
    const n = L.nodo[k], y0 = n.y - L.h / 2, top = n.y - (n.righe.length - 1) * 9 + 5;
    nodi += '<g' + (edit ? ' class="mp-click mp-drag" data-act="mappa-sel" data-drag="nodo" data-id="' + esc(k) + '"' : '') + '><rect class="mp-n mp-d' + Math.min(n.d, 3) + (edit && k === sel ? ' mp-sel' : '') + '" x="' + n.x + '" y="' + y0 + '" width="' + W + '" height="' + L.h + '" rx="10"/><text class="mp-t mp-td' + Math.min(n.d, 3) + '" text-anchor="middle">' +
      n.righe.map((x, i) => '<tspan x="' + (n.x + W / 2) + '" y="' + (top + i * 18) + '">' + esc(x) + '</tspan>').join('') + '</text></g>';
  });
  const dim = zoom ? ' width="' + Math.round(L.W * zoom) + '" height="' + Math.round(L.H * zoom) + '"' : ' width="100%"';
  return '<svg class="mp-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + L.W + ' ' + L.H + '"' + dim + ' data-w="' + L.W + '" data-h="' + L.H + '" role="img" aria-label="' + esc(titolo || t('mappa')) + '">' +
    '<defs><marker id="mpfr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="mp-fr" d="M0 0 L10 5 L0 10 z"/></marker></defs>' + archi + etich + nodi + '</svg>';
}
function mappaElenco(m) {
  const nm = {}; m.nodi.forEach(n => { nm[n.id] = senzaMarc(n.testo); });
  return m.relazioni.map(r => nm[r.da] + (r.etichetta ? ' — ' + senzaMarc(r.etichetta) + ' → ' : ' → ') + nm[r.a]);
}
/* --- modifica a mano --- */
function mappaNormalizza(m) {
  const L = mappaLayout(m);
  L.rel.forEach(r => { if (r.i >= 0) m.relazioni[r.i].x = !r.albero; else m.relazioni.push({ da: r.da, a: r.a, etichetta: '', x: false }); });
}
const mpFigli = (m, id) => m.relazioni.filter(r => !r.x && r.da === id).map(r => r.a);
function mpDiscendenti(m, id) { const out = new Set(), st = [id]; while (st.length) { mpFigli(m, st.pop()).forEach(f => { if (!out.has(f)) { out.add(f); st.push(f); } }); } return out; }
const mpGenIdx = (m, id) => m.relazioni.findIndex(r => !r.x && r.a === id);
const vv = id => { const e = document.getElementById(id); return e ? e.value : ''; };
function mappaCorr() { const c = S.capitoli.find(x => x.id === V.cap); return haMappa(c) ? c : null; }
function mappaPrima(c) { V.mundo = V.mundo || []; V.mundo.push(JSON.stringify(c.mappa)); if (V.mundo.length > 30) V.mundo.shift(); }
function rinfresca() {
  const w = document.querySelector('.mappa-wrap'), sx = w ? w.scrollLeft : 0, sy = w ? w.scrollTop : 0, py = window.scrollY;
  render();
  const n = document.querySelector('.mappa-wrap'); if (n) { n.scrollLeft = sx; n.scrollTop = sy; } window.scrollTo(0, py);
}
function fitMappa() {
  const w = document.querySelector('.mappa-wrap'), sv = w && w.querySelector('svg'); if (!sv) return;
  const dw = +sv.dataset.w, dh = +sv.dataset.h;
  V.mz = Math.max(0.3, Math.min(1, (w.clientWidth - 8) / dw, ((V.mFull ? w.clientHeight : Math.max(240, window.innerHeight * 0.66)) - 8) / dh));
  sv.setAttribute('width', Math.round(dw * V.mz)); sv.setAttribute('height', Math.round(dh * V.mz));
}
function ripitturaMappa(c) {
  const w = document.querySelector('.mappa-wrap'); if (!w) return;
  const sx = w.scrollLeft, sy = w.scrollTop;
  w.innerHTML = mappaSVG(c.mappa, V.mz || 1, c.titolo, true, V.mSel);
  w.scrollLeft = sx; w.scrollTop = sy;
}
/* Trascinamento dei nodi e delle etichette dei collegamenti (mouse, penna e dito) */
(function () {
  let d = null;
  const trova = () => d && document.querySelector(d.tipo === 'nodo' ? '.mappa-wrap [data-drag="nodo"][data-id="' + d.id + '"]' : '.mappa-wrap [data-drag="lab"][data-i="' + d.i + '"]');
  document.addEventListener('pointerdown', e => {
    if (!V.mEdit || V.vista !== 'capitolo' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const g = e.target.closest && e.target.closest('.mappa-wrap [data-drag]'); if (!g) return;
    const c = mappaCorr(); const sv = g.closest('svg'); if (!c || !sv) return;
    const L = mappaLayout(c.mappa), vb = sv.viewBox.baseVal, rect = sv.getBoundingClientRect();
    d = { tipo: g.dataset.drag, id: g.dataset.id, i: +g.dataset.i, x0: e.clientX, y0: e.clientY, k: rect.width / vb.width, mosso: false, snap: JSON.stringify(c.mappa), pid: e.pointerId, ymin: 10 + L.h / 2 };
    if (d.tipo === 'nodo') { const n = L.nodo[d.id]; if (!n) { d = null; return; } d.base = [n.x, n.y]; V.mSel = d.id; }
    else { const r = c.mappa.relazioni[d.i]; if (!r) { d = null; return; } d.base = [Number(r.ldx) || 0, Number(r.ldy) || 0]; }
    try { g.setPointerCapture(e.pointerId); } catch (x) { /* non disponibile */ }
  });
  document.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.pid) return;
    const dx = (e.clientX - d.x0) / d.k, dy = (e.clientY - d.y0) / d.k;
    if (!d.mosso && Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 5) return;
    const c = mappaCorr(); if (!c) { d = null; return; }
    if (!d.mosso) { d.mosso = true; V.mundo = V.mundo || []; V.mundo.push(d.snap); if (V.mundo.length > 30) V.mundo.shift(); }
    if (d.tipo === 'nodo') { const n = c.mappa.nodi.find(x => x.id === d.id); if (n) { n.px = Math.max(10, Math.min(5000, Math.round(d.base[0] + dx))); n.py = Math.max(d.ymin, Math.min(5000, Math.round(d.base[1] + dy))); } }
    else { const r = c.mappa.relazioni[d.i]; if (r) { r.ldx = Math.max(-1500, Math.min(1500, Math.round(d.base[0] + dx))); r.ldy = Math.max(-1500, Math.min(1500, Math.round(d.base[1] + dy))); } }
    ripitturaMappa(c);
    const g = trova(); if (g) { try { g.setPointerCapture(d.pid); } catch (x) { /* non disponibile */ } }
    e.preventDefault();
  });
  const fine = e => {
    if (!d || e.pointerId !== d.pid) return;
    const mosso = d.mosso; d = null;
    if (mosso) { const c = mappaCorr(); if (c) { c.mappa = pulisciMappa(c.mappa); salva(); rinfresca(); } }
  };
  document.addEventListener('pointerup', fine);
  document.addEventListener('pointercancel', fine);
})();
function nuovoIdNodo(m) { const u = new Set(m.nodi.map(n => n.id)); let id; do { id = 'u' + (Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(-9); } while (u.has(id)); return id; }
function vPannelloMappa(c) {
  const m = c.mappa, radice = m.nodi[0].id;
  if (!m.nodi.some(n => n.id === V.mSel)) V.mSel = radice;
  const sel = m.nodi.find(n => n.id === V.mSel), gi = mpGenIdx(m, sel.id), nome = n => esc(senzaMarc(n.testo).slice(0, 40));
  const desc = mpDiscendenti(m, sel.id);
  const fratelli = gi >= 0 ? m.relazioni.map((r, i) => i).filter(i => !m.relazioni[i].x && m.relazioni[i].da === m.relazioni[gi].da) : [];
  const pos = fratelli.indexOf(gi);
  const trasv = m.relazioni.map((r, i) => ({ r, i })).filter(o => o.r.x && (o.r.da === sel.id || o.r.a === sel.id));
  const nmap = {}; m.nodi.forEach(n => { nmap[n.id] = senzaMarc(n.testo).slice(0, 40); });
  return '<div class="card" id="mp-pannello"><p class="muted">' + t('mappa_aiuto') + '</p>' +
    '<label class="f">' + t('mappa_nodo') + '<select id="mp-sel">' + m.nodi.map(n => '<option value="' + esc(n.id) + '"' + (n.id === sel.id ? ' selected' : '') + '>' + nome(n) + '</option>').join('') + '</select></label>' +
    '<label class="f">' + t('mappa_testo') + '<input type="text" id="mp-testo" maxlength="120" value="' + esc(sel.testo) + '"></label>' +
    (gi >= 0 ? '<label class="f">' + t('mappa_etich') + '<input type="text" id="mp-etich" maxlength="60" value="' + esc(m.relazioni[gi].etichetta) + '"></label>' : '') +
    '<div class="row"><button class="btn small" data-act="mappa-salva">' + t('mappa_salva') + '</button>' +
    (gi >= 0 ? '<button class="btn sec small" data-act="mappa-ordine" data-d="-1"' + (pos <= 0 ? ' disabled' : '') + '>↑ ' + t('mappa_su') + '</button><button class="btn sec small" data-act="mappa-ordine" data-d="1"' + (pos >= fratelli.length - 1 ? ' disabled' : '') + '>↓ ' + t('mappa_giu') + '</button>' : '') + '</div>' +
    (gi >= 0 ? '<label class="f" style="margin-top:12px">' + t('mappa_sposta') + '<select id="mp-genitore">' + m.nodi.filter(n => n.id !== sel.id && !desc.has(n.id)).map(n => '<option value="' + esc(n.id) + '"' + (n.id === m.relazioni[gi].da ? ' selected' : '') + '>' + nome(n) + '</option>').join('') + '</select></label><button class="btn sec small" data-act="mappa-sposta">' + t('mappa_sposta_btn') + '</button>' : '') +
    '<h3 style="margin-top:16px">' + t('mappa_muovi') + '</h3><div class="row"><button class="btn sec small" data-act="mappa-muovi" data-dx="0" data-dy="-30" aria-label="↑">↑</button><button class="btn sec small" data-act="mappa-muovi" data-dx="0" data-dy="30" aria-label="↓">↓</button><button class="btn sec small" data-act="mappa-muovi" data-dx="-30" data-dy="0" aria-label="←">←</button><button class="btn sec small" data-act="mappa-muovi" data-dx="30" data-dy="0" aria-label="→">→</button><button class="btn sec small" data-act="mappa-riordina">' + t('mappa_riordina') + '</button></div>' +
    '<h3 style="margin-top:16px">' + t('mappa_aggiungi') + '</h3><label class="f">' + t('mappa_nuovo_testo') + '<input type="text" id="mp-nuovo" maxlength="120"></label><label class="f">' + t('mappa_etich') + '<input type="text" id="mp-nuovo-et" maxlength="60"></label><button class="btn sec small" data-act="mappa-aggiungi"' + (m.nodi.length >= 60 ? ' disabled' : '') + '>' + t('mappa_aggiungi_btn') + '</button>' +
    '<h3 style="margin-top:16px">' + t('mappa_collega') + '</h3><label class="f"><select id="mp-verso">' + m.nodi.filter(n => n.id !== sel.id).map(n => '<option value="' + esc(n.id) + '">' + nome(n) + '</option>').join('') + '</select></label><label class="f">' + t('mappa_etich') + '<input type="text" id="mp-verso-et" maxlength="60"></label><button class="btn sec small" data-act="mappa-collega">' + t('mappa_collega_btn') + '</button>' +
    (trasv.length ? '<h3 style="margin-top:16px">' + t('mappa_trasv') + '</h3><ul>' + trasv.map(o => '<li>' + esc(nmap[o.r.da] + (o.r.etichetta ? ' — ' + senzaMarc(o.r.etichetta) + ' → ' : ' → ') + nmap[o.r.a]) + ' <button class="btn sec small" data-act="mappa-del-x" data-i="' + o.i + '" aria-label="✕">✕</button></li>').join('') + '</ul>' : '') +
    (gi >= 0 ? '<div style="margin-top:16px"><button class="btn sec small" data-act="mappa-elimina">' + t('mappa_elimina') + '</button></div>' : '') + '</div>';
}
function vMappa(c) {
  if (!haMappa(c)) return '<div class="card"><h2>' + t('mappa') + '</h2><p>' + t('mappa_vuota') + '</p><button class="btn" data-act="crea-mappa"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('mappa_crea')) + '</button> ' + (V.busy ? '<span class="spin"></span>' : '') + '</div>';
  const ed = !!V.mEdit;
  if (ed && !c.mappa.nodi.some(n => n.id === V.mSel)) V.mSel = c.mappa.nodi[0].id;
  return '<div class="card">' + barraMappa(c, ed) + (ed ? '<p class="muted">' + t('mappa_trascina') + '</p>' : '') +
    '<div class="mappa-wrap' + (ed ? ' edit' : '') + '" tabindex="0">' + mappaSVG(c.mappa, V.mz || 1, c.titolo, ed, V.mSel) + '</div></div>' +
    (ed ? vPannelloMappa(c) : '<details class="card"><summary>' + t('mappa_elenco') + '</summary><ul>' + mappaElenco(c.mappa).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>');
}
function barraMappa(c, ed) {
  return '<div class="row"><button class="btn sec small" data-act="mappa-zoom" data-d="0.8" aria-label="' + t('mappa_meno') + '">−</button><button class="btn sec small" data-act="mappa-zoom" data-d="1.25" aria-label="' + t('mappa_piu') + '">+</button>' +
    '<button class="btn sec small" data-act="mappa-adatta">' + t('mappa_adatta') + '</button>' +
    (ed ? '<button class="btn sec small" data-act="mappa-annulla"' + (V.mundo && V.mundo.length ? '' : ' disabled') + '>↶ ' + t('mappa_annulla') + '</button>' : '<button class="btn sec small" data-act="crea-mappa"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('mappa_rifai')) + '</button>') +
    '<button class="btn sec small" data-act="stampa-mappa">' + t('mappa_stampa') + '</button>' + (V.mFull ? '' : '<button class="btn sec small" data-act="mappa-full">⛶ ' + t('mappa_full') + '</button>') + '<button class="btn small" data-act="mappa-modifica">' + (ed ? t('mappa_fine') : t('mappa_modifica')) + '</button></div>';
}
/* v0.25: la mappa a tutto schermo, con tutte le funzioni di spostamento e modifica */
function vMappaFull(c) {
  const ed = !!V.mEdit;
  if (ed && !c.mappa.nodi.some(n => n.id === V.mSel)) V.mSel = c.mappa.nodi[0].id;
  return '<div class="mp-full' + (ed ? ' ed' : '') + '"><div class="mp-full-bar"><button class="btn sec small" data-act="mappa-chiudi-full">✕ ' + t('mappa_chiudi') + '</button><b class="mp-full-t">' + esc(c.titolo) + '</b></div>' +
    '<div class="mp-full-map">' + barraMappa(c, ed) + (ed ? '<p class="muted">' + t('mappa_trascina') + '</p>' : '') +
    '<div class="mappa-wrap' + (ed ? ' edit' : '') + '" tabindex="0">' + mappaSVG(c.mappa, V.mz || 1, c.titolo, ed, V.mSel) + '</div></div>' +
    (ed ? '<div class="mp-full-pan">' + vPannelloMappa(c) + '</div>' : '') + '</div>';
}
const SCHEMA_MAPPA = OBJ({ nodi: { type: 'array', items: OBJ({ id: T, testo: T }) }, relazioni: { type: 'array', items: OBJ({ da: T, a: T, etichetta: T }) } });
const SYS_MAPPA = `Sei AI.st.ain, un tutor di studio. Ti viene dato il riassunto di un capitolo. Costruisci una MAPPA CONCETTUALE: nodi (concetti) collegati da relazioni con una breve etichetta (un verbo o una breve espressione).
REGOLE:
- Usa SOLO ciò che è nel riassunto, senza inventare nulla.
- Da 12 a 30 nodi. Ogni nodo ha "id" breve e unico (n1, n2, n3...) e "testo" di massimo 8 parole: un concetto, non una frase intera.
- Il PRIMO nodo è il concetto centrale e non riceve relazioni in entrata. Gli altri nodi formano un albero che parte da lui: ogni nodo riceve almeno una relazione dal suo "genitore", dal più generale al più particolare, al massimo 3-4 livelli.
- Ogni relazione ha "da" (id), "a" (id) ed "etichetta" di 1-4 parole che si legge in modo naturale tra i due concetti (per esempio "è composto da", "causa", "avviene in", "si chiama"). Mai etichette vuote.
- Puoi aggiungere da 2 a 5 relazioni trasversali tra rami diversi, se il testo le giustifica.
- Mantieni i termini del libro (date, nomi, termini tecnici). Rispondi SOLO con il JSON richiesto.`;
/* ===== Stampa e download ===== */
function dispensaHTML(c) {
  const li = a => '<ul>' + arr(a).map(x => '<li>' + md(x) + '</li>').join('') + '</ul>';
  const intest = '<p class="meta">' + esc(c.titolo) + ' · ' + esc(c.materia) + ' · ' + new Date(c.data).toLocaleDateString('it-IT') + ' · preparato con AI.st.ain</p>';
  const sezioni = [];
  if (sezOk('riassunto')) sezioni.push('<h1>' + esc(c.titolo) + '</h1>' + intest + legendaColori() + '<h2>In breve</h2>' + li(c.riassunto_breve) + '<h2>Riassunto</h2><p>' + md(c.riassunto_completo) + '</p>');
  else sezioni.push('<h1>' + esc(c.titolo) + '</h1>' + intest);
  if (sezOk('schema') && arr(c.schema && c.schema.rami).length) sezioni.push('<h2>Schema</h2><div class="radice">' + esc(c.schema.radice || c.titolo) + '</div>' + arr(c.schema.rami).map(r => '<div class="ramo"><h3>' + md(r.titolo) + '</h3>' + li(r.punti) + '</div>').join(''));
  if (sezOk('mappa') && haMappa(c)) sezioni.push('<div class="mappa-pg"><h1>' + esc(c.titolo) + '</h1>' + intest + '<h2>' + t('mappa') + '</h2>' + mappaSVG(c.mappa, 0, c.titolo) + '</div>');
  if (sezOk('spiegazioni') && arr(c.spiegazioni).length) sezioni.push('<h2>Spiegazioni</h2>' + c.spiegazioni.map(x => '<h3>' + md(x.concetto) + '</h3><p>' + md(x.spiegazione) + '</p><p><b>Esempio:</b> ' + md(x.esempio) + '</p>').join(''));
  if (sezOk('glossario') && arr(c.glossario).length) sezioni.push('<h2>Glossario</h2>' + c.glossario.map(g => '<p><b>' + esc(g.termine) + '</b>: ' + md(g.definizione) + '</p>').join(''));
  if (sezOk('pratica') && arr(c.pratica).length) sezioni.push('<div class="nuova-pg">' + intest + '<h2>' + t('pratica') + '</h2>' + c.pratica.map((e, i) => '<div class="es-pr"><h3>' + t('pr_n', { n: i + 1 }) + '</h3><p>' + md(e.testo) + '</p><div class="rispo"></div></div>').join('') + '</div>');
  return sezioni.map(x => /^<(div class="(mappa-pg|nuova-pg)")/.test(x) ? x : '<section>' + x + '</section>').join('');
}
function dispensaTesto(c) {
  const pulisci = t => String(t == null ? '' : t).replace(/\[\[[dcp]:(.+?)\]\]/g, '$1').replace(/\*\*/g, '').replace(/^### /gm, '');
  const r = [c.titolo, c.materia + ' · ' + new Date(c.data).toLocaleDateString('it-IT') + ' · preparato con AI.st.ain', ''];
  if (sezOk('riassunto')) { r.push('IN BREVE'); arr(c.riassunto_breve).forEach(x => r.push('- ' + pulisci(x))); r.push('', 'RIASSUNTO', pulisci(c.riassunto_completo)); }
  if (sezOk('schema') && arr(c.schema && c.schema.rami).length) { r.push('', 'SCHEMA', pulisci(c.schema.radice || c.titolo)); c.schema.rami.forEach(x => { r.push('  ' + pulisci(x.titolo)); arr(x.punti).forEach(p => r.push('    - ' + pulisci(p))); }); }
  if (sezOk('mappa') && haMappa(c)) { r.push('', 'MAPPA CONCETTUALE'); mappaElenco(c.mappa).forEach(x => r.push('  ' + pulisci(x))); }
  if (sezOk('spiegazioni') && arr(c.spiegazioni).length) { r.push('', 'SPIEGAZIONI'); c.spiegazioni.forEach(x => r.push(pulisci(x.concetto), '  ' + pulisci(x.spiegazione), '  Esempio: ' + pulisci(x.esempio), '')); }
  if (sezOk('pratica') && arr(c.pratica).length) { r.push('', 'ESERCIZI DI ALLENAMENTO'); c.pratica.forEach((e, i) => r.push((i + 1) + '. ' + pulisci(e.testo), '')); }
  if (sezOk('glossario') && arr(c.glossario).length) { r.push('', 'GLOSSARIO'); c.glossario.forEach(g => r.push(pulisci(g.termine) + ': ' + pulisci(g.definizione))); }
  return r.join('\n');
}
const SYS_COMPLETA = `Sei AI.st.ain, un tutor di studio per ragazzi italiani. Ti viene dato il riassunto di un capitolo. Prepara le parti mancanti SOLO a partire da quel testo, senza inventare nulla che non sia nel riassunto: schema, spiegazioni, glossario e test, con le stesse regole del materiale di studio (italiano semplice, parole chiave con **doppio asterisco**, test di 20 domande: 14 a scelta e 6 vero/falso, pratica con 5 esercizi di allenamento con soluzione riservata e 3 indizi). Nel test non fare MAI domande su esercizi o attività del libro (cosa chiedono, cosa si deve fare): solo domande sui concetti. Nei campi titolo, riassunto_breve e riassunto_completo ripeti il testo ricevuto.`;
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
/* v0.22: i test già salvati vengono rimescolati una sola volta */
(function () { let m = false; DB.figli.forEach(f => (f.capitoli || []).forEach(c => { if (!c.mesc) { mescolaOpzioni(c.test); c.mesc = true; m = true; } })); if (m) salva(); })();
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

const SYS_CAPITOLO = `Sei AI.st.ain, un tutor di studio per ragazzi italiani. Ricevi le foto delle pagine di un capitolo di un libro di scuola.
Regole:
- Scrivi sempre in italiano.
- Usa SOLO i contenuti presenti nelle pagine. Non inventare. Se una parte è illeggibile o tagliata, scrivilo in "avvisi".
- Le foto sono scattate con il telefono e spesso compresse (es. WhatsApp): ignora lo sfondo e gli oggetti attorno al libro, leggi con attenzione anche il testo piccolo e le didascalie, e segnala in "avvisi" solo le parti davvero illeggibili.
- Se è indicato un focus, lavora SOLO su quei paragrafi o argomenti.
- COPERTURA TOTALE: il riassunto completo segue l'ordine del libro e deve toccare TUTTI gli argomenti trattati, dall'inizio all'ultima pagina, anche se le pagine sono tante (17 o più). Per OGNI paragrafo o titolo del libro scrivi una sezione che inizia con una riga "### Titolo del paragrafo" seguita dal testo. Meglio sezioni brevi di un argomento mancante.
- COMPLETEZZA: prima compila "inventario" elencando TUTTO ciò che le pagine contengono di importante: ogni argomento, definizione, data, nome, luogo, tecnica e parola evidenziata (grassetto, colori, riquadri di approfondimento, box laterali, didascalie, note). Poi assicurati che OGNI voce dell'inventario compaia nel riassunto completo e abbia una spiegazione o una voce di glossario. I riquadri di approfondimento (per esempio un metodo o una tecnica) hanno una spiegazione dedicata. Non omettere mai ciò che il libro mette in evidenza: è quello che l'insegnante chiede.
- ESERCIZI DEL LIBRO: se le pagine contengono esercizi, verifiche o attività, usali SOLO come spunto per capire quali argomenti sono importanti e per creare in "pratica" esercizi di allenamento simili (stessi argomenti e stile, ma dati e contesto diversi). NEL TEST NON fare MAI domande sull'esercizio in sé (cosa chiede, cosa si deve fare, come è formulata la consegna, "è vero che nell'esercizio..."): fai solo domande sul concetto o sul contenuto che l'esercizio fa esercitare, comprensibili senza avere il libro davanti.
- Spiega in modo semplice e pratico, con esempi concreti e analogie.
- Evidenzia le parole chiave nel modo indicato nel profilo dello studente (sotto).
- Rispondi SOLO con un JSON valido, senza testo prima o dopo, con questa struttura:
{"inventario":["..."],"titolo":"...","avvisi":["..."],"riassunto_breve":["5 frasi brevi al massimo"],"riassunto_completo":"testo con paragrafi separati da \\n\\n","schema":{"radice":"concetto centrale","rami":[{"titolo":"...","punti":["...","..."]}]},"spiegazioni":[{"concetto":"...","spiegazione":"...","esempio":"..."}],"glossario":[{"termine":"...","definizione":"..."}],"pratica":[{"testo":"esercizio completo di tutti i dati","soluzione":"breve, riservata","indizi":["leggero","medio","chiaro ma senza soluzione"]}],"test":[{"tipo":"scelta","argomento":"...","domanda":"...","opzioni":["a","b","c","d"],"corretta":0,"spiegazione":"..."},{"tipo":"vf","argomento":"...","domanda":"...","corretta":true,"spiegazione":"..."}]}
- Spiegazioni: almeno 5; glossario: almeno 8 termini; il test copre argomenti diversi dell'inventario.
- Pratica: da 4 a 8 esercizi di allenamento sugli stessi argomenti del capitolo (ispirati agli esercizi del libro se ci sono), ciascuno con testo completo, soluzione breve (riservata) e 3 indizi graduali che non rivelano la soluzione.
- Il test ha da 20 a 30 domande (20 per un capitolo breve, fino a 30 per uno lungo), distribuite su TUTTI gli argomenti dell'inventario: circa 7 su 10 a scelta multipla (4 opzioni, "corretta" è l'indice 0-3, varia la posizione) e le altre vero/falso. REGOLE PER LE OPZIONI: tutte e 4 le opzioni hanno lunghezza e livello di dettaglio simili (la risposta giusta NON deve essere la più lunga né la più completa); le sbagliate sono plausibili, specifiche e costruite con errori tipici, non banali né assurde; niente "tutte le precedenti" o "nessuna delle precedenti". Nei vero/falso circa la metà delle affermazioni è falsa. Non ripetere due volte la stessa domanda. Le domande verificano la comprensione, non la memoria di dettagli. Le spiegazioni sono gentili e spiegano il perché.`;

const SYS_ESERCIZIO = `Sei AI.st.ain, un tutor che GUIDA IL RAGIONAMENTO. Ricevi la foto di un esercizio (matematica, fisica, latino, greco o altro).
REGOLA ASSOLUTA: non dare MAI la soluzione, né il risultato finale, né la traduzione completa. Lo studente deve arrivarci da solo.
Dividi l'esercizio in 3-6 passi di ragionamento (cosa chiede, cosa so, quale regola o metodo serve, come si combinano, controllo finale).
Per matematica e fisica controlla con cura i calcoli per te stesso. Per latino e greco guida l'analisi (verbo, soggetto, casi, complementi) senza tradurre.
Rispondi SOLO con un JSON valido:
{"materia":"...","richiesta":"l'esercizio riscritto in modo chiaro","passi":[{"titolo":"...","domanda":"domanda guida per lo studente","obiettivo":"cosa deve aver capito o ottenuto (SOLO per te, può contenere la risposta attesa)","indizi":["indizio leggero","indizio medio","indizio più chiaro ma senza soluzione"],"esempio_simile":"un esempio breve con dati diversi che mostra il metodo, senza risolvere questo esercizio"}]}
Scrivi in italiano, con tono incoraggiante.`;

const SYS_VALUTA = `Sei AI.st.ain, tutor che guida il ragionamento. Ricevi un passo di un esercizio con il suo obiettivo (riservato) e la risposta dello studente.
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
/* ===== v0.21: capitoli lunghi a blocchi ===== */
const FOTO_PER_BLOCCO = 8;
async function bloccoCap(materia, focus, foto, da, tot) {
  const aiuto = tot > foto.length ? ' Hai ricevuto le pagine da ' + (da + 1) + ' a ' + (da + foto.length) + ' di un capitolo di ' + tot + ' pagine: elabora SOLO queste pagine, come parte del capitolo.' : '';
  try {
    const r = await chiediJSON(SYS_CAPITOLO + '\n\n' + profiloTesto(), 'Materia: ' + materia + '. ' + (focus ? 'Concentrati SOLO su: ' + focus + '.' : 'Usa tutto il capitolo.') + aiuto + ' Genera il materiale di studio.', foto, SCHEMA_CAPITOLO);
    V.prog.fatte += foto.length; render();
    return [{ r, da, n: foto.length }];
  } catch (e) {
    if (foto.length > 1 && /troppo lunga|formato non valido|formato atteso|vuota/.test(e.message)) {   /* troppo per una volta sola: dimezza e riprova */
      const m = Math.ceil(foto.length / 2);
      return (await bloccoCap(materia, focus, foto.slice(0, m), da, tot)).concat(await bloccoCap(materia, focus, foto.slice(m), da + m, tot));
    }
    if (/Errore 40[13]|chiave|Manca|Rete non raggiungibile|Non riesco/i.test(e.message)) throw e;   /* problemi che riguardano tutto: inutile continuare */
    return [{ errore: e.message, da, n: foto.length }];
  }
}
function unisciParti(parti) {
  if (parti.length === 1) return parti[0];
  const uniq = (l, k) => { const v = new Set(); return l.filter(x => { const s = String(k ? x[k] : x).trim().toLowerCase(); if (!s || v.has(s)) return false; v.add(s); return true; }); };
  const giro = (liste, max) => { const out = []; for (let i = 0; out.length < max && liste.some(l => i < l.length); i++) liste.forEach(l => { if (i < l.length && out.length < max) out.push(l[i]); }); return out; };
  return {
    titolo: parti[0].titolo,
    inventario: uniq(parti.flatMap(p => arr(p.inventario))),
    avvisi: uniq(parti.flatMap(p => arr(p.avvisi))),
    riassunto_breve: giro(parti.map(p => arr(p.riassunto_breve)), 12),
    riassunto_completo: parti.map(p => p.riassunto_completo || '').filter(Boolean).join('\n\n'),
    schema: { radice: (parti[0].schema && parti[0].schema.radice) || parti[0].titolo, rami: parti.flatMap(p => arr(p.schema && p.schema.rami)) },
    spiegazioni: parti.flatMap(p => arr(p.spiegazioni)),
    glossario: uniq(parti.flatMap(p => arr(p.glossario)), 'termine'),
    pratica: giro(parti.map(p => arr(p.pratica)), 12),
    test: giro(parti.map(p => arr(p.test)), 30)
  };
}
async function elaboraCapitolo(materia, focus, foto) {
  V.prog = { fatte: 0, tot: foto.length };
  const blocchi = [];
  for (let i = 0; i < foto.length; i += FOTO_PER_BLOCCO) blocchi.push([i, foto.slice(i, i + FOTO_PER_BLOCCO)]);
  let esiti = [];
  for (const [da, fl] of blocchi) esiti = esiti.concat(await bloccoCap(materia, focus, fl, da, foto.length));
  V.prog = null;
  const ok = esiti.filter(x => x.r), ko = esiti.filter(x => x.errore);
  if (!ok.length) throw new Error(ko[0].errore);
  const c = unisciParti(ok.map(x => x.r));
  ko.forEach(x => c.avvisi = arr(c.avvisi).concat(t('avv_parte_mancante', { a: x.da + 1, b: x.da + x.n })));
  return c;
}
async function preparaCapitolo() {
  const materia = V.materia;
  const focus = document.getElementById('focus').value.trim();
  V.bozza = { materia, focus };
  if (!V.foto.length && FAM.ai.provider !== 'demo') { toast('Aggiungi almeno una foto.'); return; }
  V.busy = true; V.errore = ''; render();
  try {
    let c;
    if (FAM.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 900)); c = JSON.parse(JSON.stringify(DEMO_CAP)); c.pratica = JSON.parse(JSON.stringify(DEMO_PRATICA)); }
    else {
      c = await elaboraCapitolo(materia, focus, V.foto);
    }
    const cap = { id: uid(), data: new Date().toISOString(), materia, focus, titolo: c.titolo || 'Capitolo', inventario: arr(c.inventario), avvisi: arr(c.avvisi), riassunto_breve: arr(c.riassunto_breve), riassunto_completo: c.riassunto_completo || '', schema: c.schema || { radice: '', rami: [] }, spiegazioni: arr(c.spiegazioni), glossario: arr(c.glossario), test: mescolaOpzioni(normDomande(arr(c.test), 1)), mesc: true, risultati: [], lvl: 1, pratica: normPratica(c.pratica), mio: null, orali: [] };
    S.capitoli.unshift(cap); salva();
    V.foto = []; V.cap = cap.id; V.genVede = false; V.tab = primoTab(); V.vista = 'capitolo'; V.busy = false; render();
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

/* ===== v0.14: domande, difficoltà, esercizi di allenamento, premi ===== */
const LIV_TEST = 5;
const RANGHI = [0, 60, 200, 450, 900];
const BADGE = ['primo', 'dieci', 'perfetto', 'liv3', 'liv5', 'allenato', 'autore', 'oratore'];
function premiVuoti() { return { xp: 0, test: 0, perfetti: 0, maxLiv: 1, pratica: 0, badge: [] }; }
function pulisciPremi(p) {
  const n = x => { x = Math.floor(Number(x)); return isFinite(x) && x > 0 ? Math.min(x, 1000000) : 0; };
  const r = premiVuoti(); if (!p || typeof p !== 'object') return r;
  r.xp = n(p.xp); r.test = n(p.test); r.perfetti = n(p.perfetti); r.pratica = n(p.pratica); r.maxLiv = Math.max(1, Math.min(LIV_TEST, n(p.maxLiv) || 1));
  r.badge = (Array.isArray(p.badge) ? p.badge : []).filter((b, i, a) => BADGE.includes(b) && a.indexOf(b) === i);
  return r;
}
function premi() { if (!S.premi) S.premi = premiVuoti(); return S.premi; }
function rango(xp) { let r = 0; RANGHI.forEach((s, i) => { if (xp >= s) r = i; }); return r; }
/* Domande che parlano dell'esercizio in sé ("è vero che nell'esercizio devi...") non servono: si scartano. */
const META_ES = [/\besercizi\w*\b[^.?!]{0,60}\b(chied\w*|richied\w*|devi|dice|propone|prevede|domanda)\b/i, /\b(ti|ci|vi) chied\w+/i, /\bchiede di\b/i, /\b(nella|della|dalla|secondo la) (consegna|traccia)\b/i, /\b(pag\.|pagina|esercizio) ?n?\.? ?\d+/i, /\bnell['’]attivit[àa]\b/i, /\b(nel|dal) (libro|testo) (si )?(chied\w*|dice)\b/i];
function domandaOk(q) { const s = String(q.domanda || '') + ' ' + arr(q.opzioni).join(' '); return !META_ES.some(r => r.test(s)); }
function normDomande(lista, d) {
  const T = (x, n) => (typeof x === 'string' ? x : '').slice(0, n);
  const out = arr(lista).filter(q => q && typeof q === 'object').map(q => {
    const tipo = q.tipo === 'vf' ? 'vf' : 'scelta';
    const o = { tipo: tipo, argomento: T(q.argomento, 300), domanda: T(q.domanda, 2000), spiegazione: T(q.spiegazione, 3000), d: Math.max(1, Math.min(LIV_TEST, Math.floor(Number(q.d)) || d || 1)) };
    if (tipo === 'vf') { o.opzioni = []; o.corretta = q.corretta === true || q.corretta === 'true' || q.corretta === 'vero'; }
    else { o.opzioni = arr(q.opzioni).map(x => T(String(x), 800)); o.corretta = Math.floor(Number(q.corretta)); }
    return o;
  }).filter(q => q.domanda && (q.tipo === 'vf' || (q.opzioni.length >= 2 && q.corretta >= 0 && q.corretta < q.opzioni.length)));
  const buone = out.filter(domandaOk);
  return buone.length >= Math.min(8, out.length) ? buone : out;
}
/* Posizione della risposta giusta: distribuita in modo uniforme e casuale (l'AI tende a metterla in A o B e a farla più lunga). */
function mescolaOpzioni(lista) {
  const sc = arr(lista).filter(q => q && q.tipo !== 'vf' && arr(q.opzioni).length === 4 && q.corretta >= 0 && q.corretta < 4 && !arr(q.opzioni).some(o => /\b(tutte|nessuna|entrambe)\b|le precedenti|\b[a-d]\s*(e|e\/o|,)\s*[a-d]\b/i.test(o)));
  const rnd = () => (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
  const mesc = l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
  let pos = [];
  sc.forEach(q => {
    if (!pos.length) pos = mesc([0, 1, 2, 3]);
    const dove = pos.pop(), giusta = q.opzioni[q.corretta], altre = mesc(q.opzioni.filter((x, i) => i !== q.corretta));
    altre.splice(dove, 0, giusta); q.opzioni = altre; q.corretta = dove;
  });
  return lista;
}
function normPratica(lista) {
  const T = (x, n) => (typeof x === 'string' ? x : '').slice(0, n);
  return arr(lista).filter(e => e && typeof e === 'object').slice(0, 30).map(e => {
    const indizi = arr(e.indizi).map(x => T(String(x), 1000)).slice(0, 3);
    return { testo: T(e.testo, 3000), soluzione: T(e.soluzione, 3000), indizi: indizi, ok: e.ok === true, ind: Math.max(0, Math.min(indizi.length, Math.floor(Number(e.ind)) || 0)), tent: Math.max(0, Math.min(1000, Math.floor(Number(e.tent)) || 0)) };
  }).filter(e => e.testo);
}
function idxLivello(c, liv) {
  const tutti = arr(c.test).map((q, i) => i).filter(i => domandaOk(c.test[i]));
  const sel = tutti.filter(i => (c.test[i].d || 1) === liv);
  return sel.length || liv !== 1 ? sel : tutti;
}
function campiona(dom, n) {
  if (dom.length <= n) return dom.slice();
  const a = dom.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
  return a.slice(0, n).sort((x, y) => x - y);
}
const DIFF = ['',
  'Livello 1 (Base): ricordo e comprensione di definizioni e fatti principali; le opzioni sbagliate sono chiaramente diverse da quella giusta.',
  'Livello 2 (Medio): comprensione con parole diverse da quelle del libro, collegamento fra due informazioni, opzioni sbagliate plausibili.',
  'Livello 3 (Avanzato): cause e conseguenze, confronti fra concetti, applicazione a un caso nuovo.',
  'Livello 4 (Esperto): ragionamento in più passaggi, casi nuovi, riconoscere l\'errore in un\'affermazione, opzioni sbagliate molto vicine a quella giusta.',
  'Livello 5 (Maestro): sintesi e valutazione: collegare più parti del capitolo, ragionare su situazioni nuove, spiegare il perché.'];
const SYS_NUOVE = `Sei AI.st.ain, un tutor di studio. Ti viene dato il riassunto di un capitolo e l'elenco delle domande già fatte. Scrivi NUOVE domande di test SOLO sui contenuti del capitolo, senza inventare nulla.
Regole:
- Non ripetere né riformulare le domande già fatte.
- Ogni domanda verifica la comprensione di un concetto, di una causa, di un collegamento o di un'applicazione e si capisce senza avere il libro davanti.
- Non fare MAI domande sugli esercizi o sulle attività del libro (cosa chiede un esercizio, cosa si deve fare, come è scritta una consegna, "è vero che nell'esercizio..."): gli esercizi sono solo uno spunto per gli argomenti.
- Circa 7 domande su 10 a scelta multipla (4 opzioni, "corretta" è l'indice 0-3, varia la posizione) e le altre vero/falso.
- REGOLE PER LE OPZIONI: tutte e 4 le opzioni hanno lunghezza e livello di dettaglio simili (la risposta giusta NON deve essere la più lunga né la più completa); le sbagliate sono plausibili, specifiche e costruite con errori tipici, non banali né assurde; niente "tutte le precedenti" o "nessuna delle precedenti". Nei vero/falso circa la metà delle affermazioni è falsa.
- Spiegazione gentile che dice perché la risposta è quella giusta.
Difficoltà richiesta: `;
async function generaDomande(c, liv, n) {
  if (FAM.ai.provider === 'demo') throw new Error('NODEMO');
  const gia = arr(c.test).map(q => '- ' + q.domanda).slice(-80).join('\n');
  const sch = OBJ({ test: Object.assign({}, SCHEMA_CAPITOLO.properties.test, { description: 'Esattamente ' + n + ' domande nuove' }) });
  const r = await chiediJSON(SYS_NUOVE + DIFF[liv] + '\n\n' + profiloTesto(), 'Titolo: ' + c.titolo + '\nMateria: ' + c.materia + '\nQuante domande: ' + n + '\n\nRiassunto completo:\n' + c.riassunto_completo + '\n\nArgomenti:\n' + arr(c.inventario).join('; ') + '\n\nDomande già fatte (da non ripetere):\n' + gia, [], sch);
  const nuove = mescolaOpzioni(normDomande(r.test, liv)).map(q => Object.assign(q, { d: liv }));
  if (nuove.length < 4) throw new Error('Non sono riuscito a preparare nuove domande valide: riprova.');
  return nuove;
}
async function nuoviTest(c, liv) {
  V.busy = true; render();
  try {
    const nuove = await generaDomande(c, liv, 15);
    const base = c.test.length; nuove.forEach(q => c.test.push(q)); c.lvl = liv; salva();
    fermaVoce(); V.voce = false; V.test = { cap: c.id, dom: nuove.map((_, i) => base + i), i: 0, punti: 0, errati: [], scelta: null, fine: false, liv: liv }; V.tab = 'test';
  } catch (e) { toast(e.message === 'NODEMO' ? t('serve_chiave_ai') : e.message); }
  V.busy = false; render();
}
const SYS_PRATICA = `Sei AI.st.ain, un tutor che GUIDA IL RAGIONAMENTO. Dal riassunto di un capitolo prepara esercizi di allenamento sullo STESSO argomento, nello stile degli esercizi dei libri di scuola per la materia (completare, spiegare, collegare, riconoscere, mini-problemi, analisi di un breve caso o testo).
Regole:
- 6 esercizi di difficoltà crescente, svolgibili senza avere il libro davanti: il testo contiene tutti i dati.
- "soluzione" è RISERVATA: breve e corretta, serve solo a controllare la risposta dello studente.
- 3 indizi in ordine, dal più leggero al più chiaro, senza mai dire la soluzione.
- Per matematica e scienze: numeri semplici e ragionamento; controlla con cura i calcoli.
- Usa SOLO contenuti del capitolo. Scrivi in italiano, tono incoraggiante.`;
const SCHEMA_PRATICA = OBJ({ pratica: { type: 'array', description: '6 esercizi di allenamento', items: OBJ({ testo: T, soluzione: T, indizi: Object.assign({ description: 'Esattamente 3 indizi graduali, senza la soluzione' }, LS_) }) } });
const SYS_VALUTA_PRATICA = `Sei AI.st.ain, tutor che guida il ragionamento. Ricevi un esercizio, la sua soluzione (RISERVATA) e la risposta dello studente.
Valuta se la risposta è corretta nella sostanza: accetta formulazioni diverse da quella della soluzione. Non rivelare MAI la soluzione. Se la risposta è sbagliata o incompleta, individua il punto in cui il ragionamento si inceppa e fai UNA domanda che aiuti lo studente a rendersene conto.
Rispondi SOLO con JSON: {"esito":"giusto"|"quasi"|"da_rivedere","feedback":"massimo 3 frasi, tono incoraggiante, in italiano"}`;
const DEMO_PRATICA = [
  { testo: 'Spiega con parole tue perché le prime civiltà sono nate vicino ai fiumi.', soluzione: 'I fiumi danno acqua e terra fertile: si coltiva di più e si può vivere in gruppi numerosi.', indizi: ['Pensa a cosa serve per far crescere le piante.', 'Cosa porta un fiume quando straripa?', 'Acqua e terra fertile permettono di avere più...?'] },
  { testo: 'A cosa serve l\'irrigazione? Fai un esempio.', soluzione: 'Porta l\'acqua del fiume ai campi lontani con canali, così i raccolti crescono.', indizi: ['È una parola legata all\'acqua e ai campi.', 'Pensa ai canali.', 'I canali portano l\'acqua dove i campi sono lontani dal fiume.'] }
];
function assegnaPremi(c, ts) {
  const P = premi(), vecchio = rango(P.xp), liv = ts.liv || 1, pct = ts.punti / Math.max(1, ts.dom.length), nuovi = [];
  let xp = ts.punti * (1 + liv);
  if (!ts.ripasso) {
    const perfetto = pct === 1 && ts.dom.length >= 8;
    if (pct >= 0.8) xp += 10 * liv;
    if (perfetto) xp += 10;
    P.test++; if (perfetto) P.perfetti++;
    if (pct >= 0.8) P.maxLiv = Math.max(P.maxLiv, liv);
    const dai = b => { if (!P.badge.includes(b)) { P.badge.push(b); nuovi.push(b); } };
    dai('primo'); if (P.test >= 10) dai('dieci'); if (P.perfetti >= 1) dai('perfetto'); if (pct >= 0.8 && liv >= 3) dai('liv3'); if (pct >= 0.8 && liv >= 5) dai('liv5');
  }
  P.xp += xp; ts.xp = xp; ts.nuovi = nuovi; ts.pct = pct; ts.rangoNuovo = rango(P.xp) > vecchio ? rango(P.xp) : -1;
}
function vTraguardi() {
  const P = premi(), r = rango(P.xp), prox = RANGHI[r + 1];
  const testo = prox != null ? t('verso_rango', { r: t('rango_' + (r + 1)), n: prox - P.xp }) : t('rango_max');
  return '<div class="card"><h2>' + t('traguardi') + '</h2><p><b>⭐ ' + esc(t('rango_' + r)) + '</b> · ' + t('n_punti', { n: P.xp }) + '</p>' +
    (prox != null ? '<progress max="' + (prox - RANGHI[r]) + '" value="' + (P.xp - RANGHI[r]) + '" aria-label="' + esc(testo) + '"></progress>' : '') + '<p class="muted">' + esc(testo) + '</p>' +
    '<div class="badges">' + BADGE.map(b => { const on = P.badge.includes(b); return '<span class="badge' + (on ? ' on' : '') + '" title="' + esc(t('badge_' + b + '_d')) + '">' + (on ? '🏅 ' : '🔒 ') + esc(t('badge_' + b)) + '</span>'; }).join('') + '</div></div>';
}
function vPratica(c) {
  const lista = arr(c.pratica);
  if (!lista.length) return '<div class="card"><h2>' + t('pratica') + '</h2><p>' + t('pr_vuota') + '</p><button class="btn" data-act="crea-pratica"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('pr_crea')) + '</button> ' + (V.busy ? '<span class="spin"></span>' : '') + '</div>';
  V.prFb = V.prFb || {}; V.prBozza = V.prBozza || {};
  return '<div class="card"><h2>' + t('pratica') + '</h2><p class="muted">' + t('pr_aiuto') + '</p><button class="btn sec small" data-act="crea-pratica"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('pr_altri')) + '</button></div>' +
    lista.map((e, i) => { const fb = V.prFb[i]; return '<div class="card"><h3>' + t('pr_n', { n: i + 1 }) + (e.ok ? ' ✓' : '') + '</h3><p>' + md(e.testo) + '</p>' +
      (e.ind ? '<div class="fb"><b>' + t('pr_indizio') + '</b>' + e.indizi.slice(0, e.ind).map((x, j) => '<p>' + (j + 1) + '. ' + md(x) + '</p>').join('') + '</div>' : '') +
      '<label class="f">' + t('pr_tua') + '<textarea id="pr' + i + '" rows="3" maxlength="3000">' + esc(V.prBozza[i] || '') + '</textarea></label>' +
      '<div class="row"><button class="btn small" data-act="pratica-controlla" data-i="' + i + '"' + (V.busy ? ' disabled' : '') + '>' + t('pr_controlla') + '</button>' + (e.ind < e.indizi.length ? '<button class="btn sec small" data-act="pratica-indizio" data-i="' + i + '">' + t('pr_dammi_indizio') + '</button>' : '') + '</div>' +
      (fb ? '<div class="fb ' + fb.tipo + '" role="status">' + md(fb.testo) + '</div>' : '') + '</div>'; }).join('');
}
/* ===== v0.15: costruisci il tuo riassunto ===== */
function titoliSezioni(c) {
  let tt = []; String(c.riassunto_completo || '').replace(/^### (.+)$/gm, (m, x) => { tt.push(senzaMarc(x).trim()); return m; });
  if (tt.length < 2) tt = arr(c.schema && c.schema.rami).map(r => senzaMarc(r.titolo).trim());
  if (tt.length < 2) tt = [c.titolo];
  return tt.filter(Boolean).slice(0, 20);
}
function testoSezione(c, i) { const p = String(c.riassunto_completo || '').split(/^### .+$/gm).slice(1); return p[i] ? p[i].trim() : ''; }
function normMio(m) {
  const T = (x, n) => (typeof x === 'string' ? x : '').slice(0, n);
  if (!m || typeof m !== 'object') return null;
  const sez = arr(m.sez).filter(s => s && typeof s === 'object').slice(0, 20).map(s => {
    const f = s.fb && typeof s.fb === 'object' ? s.fb : {};
    return { t: T(s.t, 300), k: T(s.k, 300), testo: T(s.testo, 4000), ok: s.ok === true, n: Math.max(0, Math.min(1000, Math.floor(Number(s.n)) || 0)), fb: { esito: ['completo', 'quasi', 'da_rivedere'].includes(f.esito) ? f.esito : '', colto: arr(f.colto).map(x => T(String(x), 300)).slice(0, 8), mancano: arr(f.mancano).map(x => T(String(x), 300)).slice(0, 5), consigli: T(f.consigli, 600) } };
  }).filter(s => s.t);
  return sez.length ? { sez: sez } : null;
}
function mioDi(c) {
  if (!c.mio || !arr(c.mio.sez).length) c.mio = { sez: titoliSezioni(c).map(x => ({ t: x, k: '', testo: '', ok: false, n: 0, fb: { esito: '', colto: [], mancano: [], consigli: '' } })) };
  return c.mio;
}
function salvaBozzeCo(c) {
  const m = mioDi(c); let cambiato = false;
  m.sez.forEach((s, i) => { const k = document.getElementById('cok' + i), x = document.getElementById('cot' + i); if (k && k.value !== s.k) { s.k = k.value.slice(0, 300); cambiato = true; } if (x && x.value !== s.testo) { s.testo = x.value.slice(0, 4000); cambiato = true; } });
  if (cambiato) salva();
}
const SYS_CO = `Sei AI.st.ain, un tutor che INSEGNA A RIASSUMERE. Ricevi un paragrafo di riferimento (RISERVATO), le parole chiave scelte dallo studente e il riassunto che ha scritto con parole sue.
Valuta se ha colto le idee principali del paragrafo.
Regole ASSOLUTE:
- Non scrivere MAI il riassunto al posto suo, né frasi del riassunto corretto, né copiare il testo di riferimento. Non rivelare le informazioni che mancano: trasformale in DOMANDE GUIDA ("Cosa succede dopo...?", "Perché...?"), al massimo 3.
- "colto": le idee principali che ha già colto, frasi brevissime, tono positivo (al massimo 5).
- "esito": "completo" se ci sono le idee principali (non servono tutti i dettagli); "quasi" se ne manca una importante; "da_rivedere" se ne mancano diverse, se ha solo copiato o è fuori tema.
- "consigli": UN solo consiglio sulla tecnica del riassumere (troppo lungo o copiato dal libro: riscrivi con parole tue; troppo corto; parole chiave poco utili; frasi non collegate), al massimo 2 frasi, incoraggiante.
- Se il testo è quasi uguale a quello del libro, dillo con gentilezza.`;
const SCHEMA_CO = OBJ({ esito: { type: 'string', enum: ['completo', 'quasi', 'da_rivedere'] }, colto: LS_, mancano: LS_, consigli: T });
function coDemo(c, i, s) {
  const rif = (testoSezione(c, i) || c.riassunto_completo).toLowerCase().match(/[a-zàèéìòù]{6,}/g) || [], mio = s.testo.toLowerCase();
  const uniq = [...new Set(rif)], hit = uniq.filter(w => mio.includes(w)), r = uniq.length ? hit.length / uniq.length : 0;
  const ec = hit.length >= 3 || r >= 0.25;
  return { esito: ec ? 'completo' : hit.length >= 1 ? 'quasi' : 'da_rivedere', colto: hit.length ? ['Hai usato parole importanti: ' + hit.slice(0, 3).join(', ') + '.'] : [], mancano: ec ? [] : ['Rileggi il paragrafo: quale idea importante non hai ancora scritto?'], consigli: 'Scrivi con parole tue e in poche frasi. (In modalità demo il controllo è semplificato.)' };
}
function vCostruisci(c) {
  const m = mioDi(c), fatte = m.sez.filter(s => s.ok).length; V.coAiuto = V.coAiuto || {};
  return '<div class="card"><h2>' + t('costruisci') + '</h2><p>' + t('co_intro') + '</p><div class="fb"><b>' + t('co_metodo_t') + '</b><ol><li>' + t('co_m1') + '</li><li>' + t('co_m2') + '</li><li>' + t('co_m3') + '</li><li>' + t('co_m4') + '</li></ol></div>' +
    '<p class="muted">' + t('co_avanz', { a: fatte, n: m.sez.length }) + '</p><progress max="' + m.sez.length + '" value="' + fatte + '" aria-label="' + esc(t('co_avanz', { a: fatte, n: m.sez.length })) + '"></progress></div>' +
    m.sez.map((s, i) => {
      const f = s.fb;
      return '<div class="card"><h3>' + (i + 1) + '. ' + esc(s.t) + (s.ok ? ' ✓' : '') + '</h3>' +
        '<label class="f">' + t('co_chiave') + '<input type="text" id="cok' + i + '" maxlength="300" value="' + esc(s.k) + '" autocomplete="off"></label>' +
        '<label class="f">' + t('co_tuo') + '<textarea id="cot' + i + '" rows="4" maxlength="4000">' + esc(s.testo) + '</textarea></label>' +
        '<div class="row"><button class="btn small" data-act="co-controlla" data-i="' + i + '"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('co_controlla')) + '</button><button class="btn sec small" data-act="co-aiuto" data-i="' + i + '">' + t('co_aiuto') + '</button>' + (!s.ok && s.n >= 3 && f.esito ? '<button class="btn sec small" data-act="co-ok" data-i="' + i + '">' + t('co_va_bene') + '</button>' : '') + '</div>' +
        (V.coAiuto[i] ? '<div class="fb"><b>' + t('co_aiuto_t') + '</b><p>' + t('co_aiuto_txt', { t: esc(s.t) }) + '</p></div>' : '') +
        (f.esito ? '<div class="fb ' + (f.esito === 'completo' ? 'ok' : 'warn') + '" role="status"><b>' + t('co_esito_' + f.esito) + '</b>' +
          (f.colto.length ? '<ul>' + f.colto.map(x => '<li>✔ ' + esc(x) + '</li>').join('') + '</ul>' : '') +
          (f.mancano.length ? '<p><b>' + t('co_pensa') + '</b></p><ul>' + f.mancano.map(x => '<li>❓ ' + esc(x) + '</li>').join('') + '</ul>' : '') +
          (f.consigli ? '<p>💡 ' + esc(f.consigli) + '</p>' : '') + '</div>' : '') + '</div>';
    }).join('') +
    (fatte === m.sez.length ? '<div class="card"><h2>' + t('co_finale') + '</h2>' + m.sez.map(s => '<h3>' + esc(s.t) + '</h3><p>' + esc(s.testo).replace(/\n/g, '<br>') + '</p>').join('') + '<div class="row"><button class="btn" data-act="co-stampa">' + t('co_stampa') + '</button></div></div>' : '');
}
/* ===== v0.16: interrogazione orale a turni ===== */
const SYS_ORALE = `Sei AI.st.ain, un tutor che fa da insegnante in un'interrogazione orale di prova. Ricevi il testo di riferimento (RISERVATO), la conversazione finora e l'ultima risposta dello studente, trascritta dal riconoscimento vocale.
Regole:
- La trascrizione può avere errori di parole, punteggiatura mancante o termini difficili storpiati: sii tollerante e valuta il CONTENUTO, mai la pronuncia, la fluidità o la grammatica.
- "giusto": cosa ha detto correttamente (al massimo 4 voci brevi, tono positivo).
- "da_correggere": affermazioni sbagliate o imprecise, ciascuna con la correzione in una frase (al massimo 3). Lista vuota se non ce ne sono.
- "manca": ciò che l'insegnante si aspetterebbe e non è stato detto, scritto come DOMANDE GUIDA e non come risposte (al massimo 3).
- "esito": "ottimo" (idee principali giuste e abbastanza complete), "bene" (giusto ma con lacune), "da_rivedere" (errori importanti o molto incompleto).
- "parlato": 2-4 frasi che verranno lette ad alta voce: si parte dal positivo, poi un'osservazione sulle correzioni o sulle lacune. Niente elenchi né simboli.
- "domanda": UNA sola domanda di approfondimento per il turno successivo, su qualcosa che manca o su un altro punto del testo; vuota se l'interrogazione è conclusa.
- "fine": true solo se l'argomento è stato coperto bene o lo studente non ha altro da dire.
- Tono incoraggiante, mai giudicante. Non leggere il testo di riferimento: parafrasa.`;
const SCHEMA_ORALE = OBJ({ esito: { type: 'string', enum: ['ottimo', 'bene', 'da_rivedere'] }, giusto: LS_, da_correggere: LS_, manca: LS_, parlato: T, domanda: T, fine: { type: 'boolean' } });
function normOrale(r) {
  const T0 = (x, n) => (typeof x === 'string' ? x : '').slice(0, n), L0 = (x, k, n) => arr(x).map(y => T0(String(y), n)).filter(Boolean).slice(0, k);
  r = r && typeof r === 'object' ? r : {};
  return { esito: ['ottimo', 'bene', 'da_rivedere'].includes(r.esito) ? r.esito : 'bene', giusto: L0(r.giusto, 4, 300), da_correggere: L0(r.da_correggere, 3, 400), manca: L0(r.manca, 3, 300), parlato: T0(r.parlato, 900), domanda: T0(r.domanda, 400), fine: r.fine === true };
}
function oralDemo(rif, testo, n) {
  const w = [...new Set((String(rif).toLowerCase().match(/[a-zàèéìòù]{6,}/g) || []))], mio = testo.toLowerCase(), hit = w.filter(x => mio.includes(x));
  const esito = hit.length >= 4 ? 'ottimo' : hit.length >= 2 ? 'bene' : 'da_rivedere';
  return { esito: esito, giusto: hit.length ? ['Hai nominato: ' + hit.slice(0, 4).join(', ') + '.'] : [], da_correggere: [], manca: esito === 'ottimo' ? [] : ['Rileggi il testo: quale idea importante non hai ancora raccontato?'],
    parlato: (hit.length ? 'Bene, hai ricordato alcune parole importanti. ' : 'Proviamo a ricordare di più. ') + '(In modalità demo la valutazione è semplificata.)', domanda: n >= 2 ? '' : 'Cosa altro ricordi di questo argomento?', fine: n >= 2 };
}
function orPronto(c, parte) {
  const tit = parte >= 0 ? titoliSezioni(c)[parte] : c.titolo;
  V.or = { cap: c.id, parte: parte, turni: [{ ruolo: 'ai', testo: t('or_prima', { t: tit }) }], fase: 'pronto', trascr: '', base: '', n: 0, max: 5, esiti: [], voce: true, fermo: true, riavvii: 0, t0: 0, errore: '', chiuso: null };
  if (V.or.voce) parlaCb(plain(V.or.turni[0].testo));
}
function orChiudiAscolto() {
  const o = V.or; if (!o || o.fase !== 'ascolto') return;
  if (o.errore === 'perm') toast(t('or_mic_negato')); o.errore = '';
  o.fase = 'rivedi'; render();
}
function orAvviaRec() {
  const o = V.or, SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast(t('or_nomic')); o.fase = 'rivedi'; render(); return; }
  fermaVoce();
  o.fase = 'ascolto'; o.base = o.trascr ? o.trascr.trim() + ' ' : ''; o.fermo = false; o.riavvii = 0; o.t0 = Date.now(); o.errore = ''; render();
  const nuovo = () => {
    const r = new SR(); V.rec = r; r.lang = LINGUE_VOCE.it; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = ev => { if (V.or !== o) return; const tx = [...ev.results].map(x => x[0].transcript).join(' '); o.trascr = (o.base + tx).replace(/\s+/g, ' ').trim(); const el = document.getElementById('or-live'); if (el) el.textContent = o.trascr; };
    r.onerror = ev => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { o.fermo = true; o.errore = 'perm'; } else if (ev.error === 'network' || ev.error === 'audio-capture') { o.fermo = true; o.errore = ev.error; } };
    r.onend = () => {
      if (V.rec === r) V.rec = null;
      if (V.or !== o || o.fase !== 'ascolto') return;
      if (!o.fermo && o.riavvii < 12 && Date.now() - o.t0 < 180000) { o.riavvii++; o.base = o.trascr ? o.trascr + ' ' : ''; try { nuovo(); return; } catch (e) { /* si chiude qui sotto */ } }
      orChiudiAscolto();
    };
    try { r.start(); } catch (e) { orChiudiAscolto(); }
  };
  nuovo();
}
function orFinisci(c) {
  const o = V.or; if (!o || !o.n) { if (o) o.fase = 'pronto'; return; }
  const pt = { ottimo: 2, bene: 1, da_rivedere: 0 }, pct = o.esiti.reduce((a, e) => a + pt[e], 0) / (2 * o.n), P = premi(), nuovi = [];
  const xp = o.esiti.reduce((a, e) => a + pt[e] * 2 + 1, 0) + (pct >= 0.8 ? 10 : 0);
  P.xp += xp; if (pct >= 0.8 && o.n >= 3 && !P.badge.includes('oratore')) { P.badge.push('oratore'); nuovi.push('oratore'); }
  const ripassare = []; o.turni.forEach(x => { if (x.fb) { x.fb.da_correggere.concat(x.fb.manca).forEach(y => { if (!ripassare.includes(y)) ripassare.push(y); }); } });
  c.orali = arr(c.orali).concat([{ data: new Date().toISOString(), pct: Math.round(pct * 100) }]).slice(-100);
  o.chiuso = { pct: Math.round(pct * 100), xp: xp, nuovi: nuovi, ripassare: ripassare.slice(0, 8) }; o.fase = 'fine'; fermaVoce(); salva();
}
async function orInvia(c) {
  const o = V.or, tx = ((document.getElementById('or-testo') || {}).value || '').trim();
  if (tx.length < 8) { toast(t('or_poco')); return; }
  o.trascr = tx; o.fase = 'invio'; render();
  try {
    const rif = (o.parte >= 0 ? testoSezione(c, o.parte) : '') || c.riassunto_completo;
    let r;
    if (FAM.ai.provider === 'demo') { await new Promise(x => setTimeout(x, 400)); r = oralDemo(rif, tx, o.n); }
    else r = await chiediJSON(SYS_ORALE + '\n\n' + profiloTesto(), 'Materia: ' + c.materia + '\nArgomento: ' + (o.parte >= 0 ? titoliSezioni(c)[o.parte] : c.titolo) + '\n\nTesto di riferimento (RISERVATO):\n' + String(rif).slice(0, 20000) + '\n\nConversazione finora:\n' + o.turni.map(x => (x.ruolo === 'ai' ? 'Insegnante: ' : 'Studente: ') + x.testo).join('\n') + '\n\nUltima risposta dello studente (trascrizione):\n' + tx, [], SCHEMA_ORALE);
    const fb = normOrale(r);
    o.turni.push({ ruolo: 'io', testo: tx }); o.n++; o.esiti.push(fb.esito);
    o.turni.push({ ruolo: 'ai', testo: (fb.parlato + ' ' + fb.domanda).trim(), fb: fb });
    o.trascr = '';
    if (o.n >= o.max || fb.fine || !fb.domanda) orFinisci(c);
    else { o.fase = 'pronto'; if (o.voce) parlaCb(plain(fb.parlato + ' ' + fb.domanda)); }
  } catch (e) { toast(e.message === 'NODEMO' ? t('serve_chiave_ai') : e.message); o.fase = 'rivedi'; }
  render();
}
function vOrale(c) {
  const o = V.or && V.or.cap === c.id ? V.or : null, SRok = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!o) {
    const tt = titoliSezioni(c);
    return '<div class="card"><h2>' + t('orale') + '</h2><p>' + t('or_intro') + '</p>' +
      '<label class="f">' + t('or_parte') + '<select id="or-parte"><option value="-1">' + esc(t('or_tutto')) + '</option>' + tt.map((x, i) => '<option value="' + i + '">' + esc(x) + '</option>').join('') + '</select></label>' +
      '<button class="btn" data-act="or-inizia">' + t('or_inizia') + '</button>' +
      '<p class="muted">' + t('or_nota_it') + ' ' + t('or_privacy') + '</p>' + (SRok ? '' : '<div class="fb warn">' + t('or_nomic') + '</div>') + '</div>';
  }
  const ult = o.turni[o.turni.length - 1];
  const bolle = o.turni.map(x => '<div class="bolla ' + x.ruolo + '"><b>' + (x.ruolo === 'ai' ? '🎓 ' : '🙂 ') + '</b>' + esc(x.testo) + '</div>').join('');
  const fbh = ult && ult.fb && o.fase !== 'fine' ? '<div class="fb ' + (ult.fb.esito === 'ottimo' ? 'ok' : 'warn') + '" role="status"><b>' + t('or_esito_' + ult.fb.esito) + '</b>' +
    (ult.fb.giusto.length ? '<p><b>' + t('or_giusto') + '</b></p><ul>' + ult.fb.giusto.map(x => '<li>✔ ' + esc(x) + '</li>').join('') + '</ul>' : '') +
    (ult.fb.da_correggere.length ? '<p><b>' + t('or_correggi') + '</b></p><ul>' + ult.fb.da_correggere.map(x => '<li>✏️ ' + esc(x) + '</li>').join('') + '</ul>' : '') +
    (ult.fb.manca.length ? '<p><b>' + t('or_manca') + '</b></p><ul>' + ult.fb.manca.map(x => '<li>❓ ' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>' : '';
  let ctrl = '';
  if (o.fase === 'fine') {
    const f = o.chiuso || { pct: 0, xp: 0, nuovi: [], ripassare: [] };
    return '<div class="card"><h2>' + t('or_fine_t') + '</h2><p><b>' + t('or_risultato', { p: f.pct }) + '</b> · ⭐ ' + t('punti_guadagnati', { n: f.xp }) + '</p>' + f.nuovi.map(b => '<p>🏅 ' + esc(t('nuovo_badge', { b: t('badge_' + b) })) + '</p>').join('') +
      (f.ripassare.length ? '<div class="fb warn"><b>' + t('or_da_ripassare') + '</b><ul>' + f.ripassare.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '<div class="fb ok">' + t('tutto_chiaro') + '</div>') + '<div class="row"><button class="btn" data-act="or-ancora">' + t('or_ancora') + '</button></div></div>';
  }
  if (o.fase === 'pronto') ctrl = '<div class="row">' + (SRok ? '<button class="btn mic-grande" data-act="or-parla">🎤 ' + t('or_parla') + '</button>' : '') + '<button class="btn sec" data-act="or-scrivi">✏️ ' + t('or_scrivi') + '</button>' + '<button class="btn sec" data-act="or-riascolta">🔊 ' + t('or_riascolta') + '</button></div>';
  else if (o.fase === 'ascolto') ctrl = '<div class="fb" aria-live="polite"><b class="rec-dot">● ' + t('or_ascolto_t') + '</b><p id="or-live">' + esc(o.trascr) + '</p></div><div class="row"><button class="btn mic-grande rec" data-act="or-fine">✋ ' + t('or_ho_finito') + '</button><button class="btn sec" data-act="or-annulla">' + t('or_annulla') + '</button></div>';
  else if (o.fase === 'rivedi') ctrl = '<p class="muted">' + t('or_rivedi_t') + '</p><label class="f"><textarea id="or-testo" rows="5" maxlength="4000">' + esc(o.trascr) + '</textarea></label><div class="row"><button class="btn" data-act="or-invia">' + t('or_invia') + '</button>' + (SRok ? '<button class="btn sec" data-act="or-parla">🎤 ' + t('or_aggiungi') + '</button>' : '') + '<button class="btn sec" data-act="or-cancella">' + t('or_cancella') + '</button></div>';
  else if (o.fase === 'invio') ctrl = '<p><span class="spin"></span> ' + t('or_attesa') + '</p>';
  return '<div class="card"><h2>' + t('orale') + '</h2><p class="muted">' + t('or_turno', { n: Math.min(o.n + 1, o.max), m: o.max }) + '</p>' + bolle + fbh + ctrl +
    '<div class="row" style="margin-top:12px">' + (o.n ? '<button class="btn sec small" data-act="or-concludi">' + t('or_concludi') + '</button>' : '') + '<label class="chk"><input type="checkbox" id="or-voce"' + (o.voce ? ' checked' : '') + ' data-act="or-voce">' + t('or_voce_ai') + '</label></div></div>';
}
function salvaBozzePratica(c) { V.prBozza = V.prBozza || {}; arr(c.pratica).forEach((_, i) => { const el = document.getElementById('pr' + i); if (el) V.prBozza[i] = el.value; }); }
/* ===== v0.14: aspetto automatico per livello e DSA ===== */
function temiPer(livello) { return livello === 'elementari' ? ['gioco'] : ['calmo', 'notte']; }
function temaValido(p) { const ok = temiPer(p && p.livello); return p && ok.includes(p.tema) ? p.tema : ok[0]; }
function aspettoConsigliato(livello, dsa) {
  const d = dsa || {}, r = { tema: livello === 'elementari' ? 'gioco' : 'calmo', font: 'tema', fs: 1, lh: 1.6, ls: 0, ws: 0 };
  if (d.dislessia) Object.assign(r, { font: 'lexend', fs: 1.1, lh: 1.9, ls: 0.06, ws: 0.15 });
  else if (d.disortografia) Object.assign(r, { font: 'andika', fs: 1.05, lh: 1.7, ls: 0.03, ws: 0.08 });
  else if (d.discalculia) Object.assign(r, { font: 'atkinson', lh: 1.7 });
  else if (d.disgrafia) Object.assign(r, { lh: 1.7 });
  return r;
}
function consigliato(livello, dsa) { return aspettoConsigliato(livello, dsa).tema; }

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
/* Ogni dispositivo ha voci diverse: quelle "naturali" o di rete suonano molto meglio di quelle di base (metalliche).
   AI.st.ain le ordina per qualità; la persona può comunque sceglierne una a mano nelle impostazioni. */
function punteggioVoce(v, lang) {
  const l = String(v.lang || '').replace('_', '-').toLowerCase(), n = String(v.name || ''), L = String(lang).toLowerCase();
  let p = 0;
  if (l === L) p += 40; else if (l.slice(0, 2) === L.slice(0, 2)) p += 20; else return -1000;
  if (/natural|neural|wavenet|studio|premium|enhanced|migliorat|alta qualit|high.?quality/i.test(n)) p += 60;
  if (/google/i.test(n)) p += 35;
  if (/online|network/i.test(n)) p += 30;
  if (/microsoft/i.test(n)) p += 10;
  if (/espeak|festival|pico|compact|\blite\b|rhvoice|mbrola/i.test(n)) p -= 80;
  if (v.default) p += 3;
  if (v.localService === false && navigator.onLine === false) p -= 300;
  return p;
}
function vociLingua(lang) {
  try { return speechSynthesis.getVoices().map(v => [punteggioVoce(v, lang), v]).filter(x => x[0] > -1000).sort((a, b) => b[0] - a[0]).map(x => x[1]); } catch (e) { return []; }
}
function scegliVoce(lang, nome) { const vs = vociLingua(lang); return vs.length ? ((nome && vs.find(v => v.name === nome)) || vs[0]) : null; }
function fermaVoce() { if (V && V.or) V.or.fermo = true; TOKEN++; try { speechSynthesis.cancel(); } catch (e) { /* non disponibile */ } try { if (V && V.rec) V.rec.abort(); } catch (e) { /* già fermo */ } if (V) V.rec = null; }
function parlaCb(testo, cb, bnd, opz) {
  if (!('speechSynthesis' in window)) { toast(t('voce_non')); if (cb) cb(); return null; }
  opz = opz || {};
  try {
    speechSynthesis.cancel(); const id = ++TOKEN;
    const lang = opz.lingua ? LINGUE_VOCE[opz.lingua] : voceDi();
    const nome = opz.voce !== undefined ? opz.voce : (S.profilo && S.profilo.voce);
    const vel = opz.vel || (S.profilo && S.profilo.vel) || 0.9;
    const prima = scegliVoce(lang, nome); let ripiego = false;
    const crea = vv => {
      const u = new SpeechSynthesisUtterance(testo); u.lang = lang; if (vv) u.voice = vv;
      u.rate = vel; u.pitch = 1;
      u.onend = () => { if (id === TOKEN && cb) cb(); };
      u.onerror = ev => {
        if (id !== TOKEN || ev.error === 'interrupted' || ev.error === 'canceled') return;
        const locale = vociLingua(lang).find(x => x.localService);
        if (!ripiego && vv && vv.localService === false && locale) { ripiego = true; try { speechSynthesis.cancel(); speechSynthesis.speak(crea(locale)); return; } catch (e) { /* si segnala sotto */ } }
        toast(t('voce_non')); if (cb) cb();
      };
      if (bnd) u.onboundary = ev => { if (id === TOKEN) bnd(ev); };
      return u;
    };
    const u = crea(prima); speechSynthesis.speak(u); return u;
  } catch (e) { toast(t('voce_non')); if (cb) cb(); return null; }
}
/* Elenco delle voci nelle impostazioni (le voci si caricano con calma: si riempie anche quando arrivano) */
function riempiVoci() {
  const s = document.getElementById('voce-sel'); if (!s) return;
  const sel = document.getElementById('lingua-fig');
  const lg = (sel && sel.value) || (S.profilo && S.profilo.lingua) || 'it';
  const cur = s.dataset.pronto ? s.value : (s.dataset.cur || ''); s.dataset.pronto = '1';
  const vs = vociLingua(LINGUE_VOCE[lg] || 'it-IT');
  s.innerHTML = '<option value="">' + esc(t('voce_auto')) + '</option>' + vs.map(v => '<option value="' + esc(v.name) + '">' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('');
  s.value = vs.some(v => v.name === cur) ? cur : '';
}
try { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', riempiVoci); } catch (e) { /* voce non disponibile */ }
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
  const ico = '<img class="brand-ico" src="icons/favicon.svg" alt="" width="34" height="34">';
  const brand = p ? '<button class="brand" data-act="home" aria-label="' + esc(t('torna_home')) + '">' + ico + '<span>AI.st.ain<small>v' + VERSIONE + '</small></span></button>' : '<div class="brand">' + ico + '<span>AI.st.ain<small>v' + VERSIONE + '</small></span></div>';
  return '<div class="bar">' + brand + '<div class="row nav">' +
    (p ? '<button class="btn sec small" data-act="home">📚 ' + t('studio') + '</button><button class="btn sec small" data-act="fs-" aria-label="' + esc(t('testo_piccolo')) + '">A−</button><button class="btn sec small" data-act="fs+" aria-label="' + esc(t('testo_grande')) + '">A+</button><button class="btn sec small" data-act="aspetto">🎨 ' + t('aspetto_btn') + '</button>' + (DB.figli.length > 1 ? '<button class="btn sec small" data-act="scelta">🔁 ' + t('cambia_profilo') + '</button>' : '') : '') +
    '<button class="btn sec small" data-act="genitori">👪 ' + t('genitori') + '</button><button class="btn sec small" data-act="tour" aria-label="' + esc(t('tour_btn')) + '" title="' + esc(t('tour_btn')) + '">❓</button></div></div>';
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
  /* tutte le materie del profilo + quelle standard non ancora create (si creano scegliendole) */
  const altre = S.materie.concat(MATERIE.filter(m => !S.materie.some(x => sameM(x, m)))).filter(m => !sameM(m, item.materia));
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
    '<label class="f">' + t('voce_scelta') + '<select data-pref="voce" id="voce-sel" data-cur="' + esc(p.voce || '') + '"><option value="">' + esc(t('voce_auto')) + '</option></select></label>' +
    '<button class="btn sec small" type="button" data-act="prova-voce">' + t('prova_voce') + '</button><p class="muted">' + t('voce_aiuto') + '</p>' +
    '<div class="fb" id="anteprima">' + t('anteprima') + '</div><p class="muted">' + t('aspetto_auto_nota') + '</p><button class="btn sec small" type="button" id="btn-cons" data-act="aspetto-consigliato">' + t('aspetto_ripristina') + '</button>';
}
function bloccoTema(p) {
  const ok = temiPer(p.livello), cur = ok.includes(p.tema) ? p.tema : ok[0];
  return ok.map(k => '<label class="chk"><input type="radio" name="tema" data-pref="tema" value="' + k + '"' + (cur === k ? ' checked' : '') + '>' + t(k) + '</label>').join('') + '<p class="muted">' + t(ok.length === 1 ? 'tema_solo_elem' : 'tema_dalle_medie') + '</p>';
}
function vAspetto() {
  const p = S.profilo;
  return barra() + '<div class="card"><h1>' + t('aspetto') + '</h1>' + bloccoTema(p) + bloccoAspetto(p) + '<p></p><button class="btn" data-act="home">' + t('fatto') + '</button></div>';
}
function vPrivacy() {
  const li = k => '<ul>' + t(k).split('|').map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  return barra() + '<div class="card"><h1>' + t('priv_titolo') + '</h1><p>' + t('priv_intro') + '</p></div>' +
    '<div class="card"><h2>✅ ' + t('priv_dev_t') + '</h2>' + li('priv_dev') + '</div>' +
    '<div class="card"><h2>☁️ ' + t('priv_ai_t') + '</h2>' + li('priv_ai') + '<p class="muted">' + t('priv_dsa_nota') + '</p></div>' +
    '<div class="card"><h2>🎤 ' + t('priv_voce_t') + '</h2>' + li('priv_voce') + '</div>' +
    '<div class="card"><h2>🌐 ' + t('priv_gh_t') + '</h2><p>' + t('priv_gh') + '</p></div>' +
    '<div class="card"><h2>🚫 ' + t('priv_no_t') + '</h2><p>' + t('priv_no') + '</p></div>' +
    '<div class="card"><p class="muted">' + t('priv_nota') + '</p></div>' +
    '<button class="btn full" data-act="priv-indietro">' + t('priv_indietro') + '</button>';
}
function vFam() {
  const b = V.bozzaFam || {}; const a = Object.assign({}, FAM.ai, b.ai || {});
  const lingua = b.lingua || FAM.lingua;
  const srv = [['demo', 'srv_demo'], ['gemini', 'srv_gemini'], ['groq', 'srv_groq'], ['compat', 'srv_compat'], ['openrouter', 'srv_or'], ['anthropic', 'srv_anth']];
  const sel = a.provider === 'compat' && (a.preset === 'gemini' || a.preset === 'groq') ? a.preset : a.provider;
  return barra() + '<div class="card"><h1>' + t('imp_famiglia') + '</h1>' + (!FAM.pin ? '<p class="muted">' + t('passo_fam') + '</p>' : '') + '</div>' +
    '<div class="card"><label class="f">' + t('lingua_gen') + '<select id="lingua-gen">' + LINGUE_ORD.map(l => '<option value="' + l + '"' + (lingua === l ? ' selected' : '') + '>' + LINGUE[l] + '</option>').join('') + '</select></label><p class="muted">' + t('lingua_nota') + '</p></div>' +
    '<div class="card"><h2>' + t('ai_titolo') + '</h2><label class="f">' + t('servizio') + '<select id="prov">' + srv.map(o => '<option value="' + o[0] + '"' + (sel === o[0] ? ' selected' : '') + '>' + t(o[1]) + '</option>').join('') + '</select></label>' +
    '<div id="boxcompat"' + (sel === 'compat' ? '' : ' hidden') + '><label class="f">' + t('quale') + '<select id="preset">' + Object.keys(PRESET).filter(k => !PRESET[k].chiave).map(k => '<option value="' + k + '"' + ((a.preset === 'lmstudio' ? 'lmstudio' : 'ollama') === k ? ' selected' : '') + '>' + PRESET[k].nome + '</option>').join('') + '</select></label>' +
    '<label class="f">' + t('indirizzo_servizio') + '<input type="text" id="url" value="' + esc(a.url || PRESET.ollama.url) + '" autocomplete="off"></label></div>' +
    '<label class="f">' + t('chiave_api') + '<input type="password" id="chiave" value="' + esc(b.ai && b.ai.key ? b.ai.key : '') + '" placeholder="' + esc(haChiave(FAM.ai) ? t('chiave_salvata') : '') + '" autocomplete="off"></label>' + (haChiave(FAM.ai) ? '<button class="btn sec small" type="button" data-act="rimuovi-chiave">' + t('rimuovi_chiave') + '</button>' : '') +
    '<label class="f">' + t('modello') + '<input type="text" id="modello" list="mod-sugg" value="' + esc(a.model) + '" placeholder="OpenRouter: google/gemini-2.5-flash · Claude: claude-sonnet-5-5 · Ollama: gemma4:26b"></label>' +
    '<datalist id="mod-sugg">' + ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'claude-haiku-5-5', 'claude-sonnet-5-5'].map(m => '<option value="' + m + '"></option>').join('') + '</datalist>' +
    '<button class="btn sec" type="button" data-act="prova-ai">' + t('prova_coll') + '</button><p class="muted" id="esitoprova" role="status"></p><p class="muted">' + t('srv_note') + '</p>' +
    '<details><summary>Guida / Guide: Ollama, LM Studio</summary><p class="muted"><b>Ollama</b>: <code>ollama pull gemma4:26b</code> (GPU ~16 GB). <code>OLLAMA_ORIGINS=' + esc(location.origin.startsWith('http') ? location.origin : 'https://toskurim.github.io') + '</code>. <b>LM Studio</b>: Developer › server + CORS.<br>Funziona solo sul PC dove girano / works only on the PC where they run.</p></details></div>' +
    '<div class="card"><h2>' + t('priv_btn') + '</h2><p class="muted">' + t('priv_breve') + '</p><button class="btn sec" type="button" data-act="priv-apri">' + t('priv_btn') + '</button>' +
    '<label class="chk"><input type="checkbox" id="dsa-ai"' + ((b.dsaAI !== undefined ? b.dsaAI : FAM.dsaAI) === false ? '' : ' checked') + '>' + t('dsa_ai_lbl') + '</label><p class="muted">' + t('dsa_ai_nota') + '</p>' +
    (!FAM.pin ? '<label class="chk"><input type="checkbox" id="priv-ok">' + t('priv_ho_letto') + '</label>' : '') + '</div>' +
    '<div class="card"><h2>' + t('pin_gen') + '</h2><label class="f">' + (FAM.pin ? t('pin_nuovo') : t('pin_scegli')) + '<input type="password" id="pin" inputmode="numeric" maxlength="8" value="" autocomplete="off"></label><p class="muted">' + t('pin_regole') + '</p></div>' +
    '<button class="btn full" data-act="salva-fam">' + t('salva') + '</button>' + (FAM.pin ? '<p></p><button class="btn sec full" data-act="genitori">' + t('annulla') + '</button>' : '');
}
function vSetup() {
  const f = V.edit ? DB.figli.find(x => x.id === V.edit) : null;
  const p = f ? f.profilo : { nome: '', sezioni: {}, livello: 'superiori', dsa: {}, tema: '', fs: 1, lingua: 'it', font: 'tema', lh: 0, ls: 0, ws: 0, vel: 0.9, pin: '' };
  return barra() + '<div class="card"><h1>' + (f ? esc(p.nome) : t('aggiungi_figlio')) + '</h1></div>' + (f ? '' : quizPromo()) +
    '<div class="card"><label class="f">' + t('nome') + '<input type="text" id="nome" value="' + esc(p.nome) + '" autocomplete="off"></label>' +
    '<label class="f">' + t('livello') + '<select id="livello">' + LIVELLI.map(k => '<option value="' + k + '"' + (p.livello === k ? ' selected' : '') + '>' + t(k) + '</option>').join('') + '</select></label>' +
    '<label class="f">' + t('lingua_figlio') + '<select id="lingua-fig">' + LINGUE_ORD.map(l => '<option value="' + l + '"' + ((p.lingua || 'it') === l ? ' selected' : '') + '>' + LINGUE[l] + '</option>').join('') + '</select></label><p class="muted">' + t('lingua_nota') + '</p></div>' +
    '<div class="card"><h2>' + t('come_studia') + '</h2><p class="muted">' + t('piu_profili') + '</p>' + (f ? '<p><button class="btn sec small" type="button" data-act="dsa-quiz">' + t('dsaq_promo_btn') + '</button></p>' : '') +
    Object.keys(DSA).map(k => '<label class="chk"><input type="checkbox" data-dsa="' + k + '"' + (p.dsa && p.dsa[k] ? ' checked' : '') + '>' + t(k) + '</label><div class="dsainfo" id="info-' + k + '"' + (p.dsa && p.dsa[k] ? '' : ' hidden') + '>' + infoDsa(k) + '</div>').join('') +
    '<p class="muted">' + t('nota_dsa') + '</p>' +
    '<label class="chk"><input type="checkbox" id="colori"' + (p.colori === undefined ? ' checked' : (p.colori ? ' checked' : '')) + '>' + t('colori_lbl') + '</label><p class="muted">' + t('colori_nota') + '</p></div>' +
    '<div class="card"><h2>' + t('sez_titolo') + '</h2><p class="muted">' + t('sez_nota') + '</p><p class="muted">' + t('co_nota_sez') + '</p>' + SEZ.map(k => '<label class="chk"><input type="checkbox" data-sez="' + k + '"' + (p.sezioni && p.sezioni[k] === false ? '' : ' checked') + '>' + t(k) + '</label>').join('') + '<label class="chk"><input type="checkbox" checked disabled>' + t('test') + ' — ' + t('sez_sempre') + '</label></div>' +
    '<div class="card"><h2>' + t('met_set_t') + '</h2><p class="muted">' + t('met_set_nota') + '</p>' +
    [['chiedi', 'met_set_chiedi'], ['confronto', 'met_set_confronto'], ['esperimento', 'met_set_esp']].map(o => '<label class="chk"><input type="checkbox" id="met-' + o[0] + '"' + (!p.metodo || p.metodo[o[0]] !== false ? ' checked' : '') + '>' + t(o[1]) + '</label>').join('') + '</div>' +
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
    '<div class="hero"><img src="icons/icon-192.png" alt="" width="64" height="64"><div><h1>' + t('ciao', { n: esc(p.nome) }) + '</h1><p class="muted">' + t('scegli_materia') + '</p></div></div>' +
    '<h2>' + t('le_materie') + '</h2>' + (S.materie.length ? '<div class="mat-grid">' + S.materie.map(m => { const e = elementiMateria(m); return '<button class="mat" data-act="apri-materia" data-m="' + esc(m) + '">' + iconaMateria(m) + '<b>' + esc(m) + '</b><span class="muted">' + t('n_cap', { n: e.cap.length }) + ' · ' + t('n_es', { n: e.es.length }) + '</span></button>'; }).join('') + '</div>' : '<div class="card muted">' + t('nessuna_materia') + '</div>') +
    '<div class="card add-mat"><h3>' + t('agg_materia') + '</h3>' + (mancanti.length ? '<div class="row" style="margin-bottom:8px">' + mancanti.map(m => '<button class="btn sec small" data-act="aggiungi-materia" data-m="' + esc(m) + '">+ ' + esc(m) + '</button>').join('') + '</div>' : '') +
    '<label class="f">' + t('altra_materia') + '<input type="text" id="nuovaM" maxlength="40" autocomplete="off"></label><button class="btn sec small" data-act="aggiungi-materia">' + t('aggiungi') + '</button></div>' +
    (S.capitoli.some(c => arr(c.test).length) ? '<div class="card"><h2>' + t('ripasso_oggi') + '</h2>' + (due ? '<p>' + (due === 1 ? t('una_rip') : t('n_domande_rip', { n: due })) + '</p><button class="btn" data-act="inizia-ripasso">' + t('inizia_ripasso') + '</button>' : '<p class="muted">' + t('nessun_ripasso') + '</p>') + '<p class="muted">' + t('rip_spiega') + '</p></div>' : '') +
    (ver.length ? '<h2>' + t('verifiche') + '</h2>' + ver.map(x => { const pr = pianoRipasso(x.v); const oggi = pr.giorni && pr.giorni[0] ? pr.giorni[0].righe.join(' · ') : ''; return '<div class="card"><div class="row" style="justify-content:space-between"><div><b>' + esc(x.v.materia) + '</b>' + (x.v.argomento ? ' · ' + esc(x.v.argomento) : '') + '</div><span class="chip ' + (x.d <= 3 ? 'warn' : '') + '">' + esc(quando(x.d)) + '</span></div>' + (oggi ? '<p class="muted"><b>' + t('compito_oggi') + ':</b> ' + oggi + '</p>' : '') + '<button class="btn sec small" data-act="apri-materia" data-m="' + esc(x.v.materia) + '">' + t('piano') + '</button></div>'; }).join('') : '') +
    (ultimi.length ? '<h2>' + t('continua') + '</h2>' + ultimi.map(cardCap).join('') : '') +
    cardMetodo() + vTraguardi() + '<p class="muted" style="text-align:center;margin-top:18px"><b>AI.st.ain</b> = ' + esc(t('acronimo')) + '</p>';
}
function fotoBox() {
  return '<div class="row"><label class="btn sec">' + t('scatta') + '<input type="file" accept="image/*" capture="environment" id="f1" hidden></label><label class="btn sec">' + t('scegli_foto') + '<input type="file" accept="image/*" multiple id="f2" hidden></label></div>' +
    '<p class="muted">' + t('foto_aiuto') + '</p><p class="muted">🔒 ' + t('priv_foto') + '</p>' +
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
    (V.busy ? '<p><span class="spin"></span> ' + t('lavora') + (V.prog && V.prog.tot > FOTO_PER_BLOCCO ? ' (' + t('prog_pagine', { i: V.prog.fatte, n: V.prog.tot }) + ')' : '') + '</p>' : (tipo === 'cap' && V.foto.length > FOTO_PER_BLOCCO ? '<p class="muted">' + t('blocchi_nota', { b: FOTO_PER_BLOCCO, n: Math.ceil(V.foto.length / FOTO_PER_BLOCCO) }) + '</p>' : '') + '<button class="btn full" data-act="' + (tipo === 'cap' ? 'prepara-cap' : 'prepara-es') + '">' + (tipo === 'cap' ? t('prepara_studio') : t('guidami')) + '</button>') +
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
function sezOk(k) { return k === 'test' || !!V.genVede || !S.profilo || !S.profilo.sezioni || S.profilo.sezioni[k] !== false; }
function tabsAttive() { return ['riassunto', 'schema', 'mappa', 'spiegazioni', 'glossario', 'costruisci', 'pratica', 'orale', 'test'].filter(sezOk); }
function primoTab() { return tabsAttive()[0]; }
function mancano(c) {
  const m = [];
  if (sezOk('schema') && !arr(c.schema && c.schema.rami).length) m.push('schema');
  if (sezOk('spiegazioni') && !arr(c.spiegazioni).length) m.push('spiegazioni');
  if (sezOk('glossario') && !arr(c.glossario).length) m.push('glossario');
  if (!arr(c.test).length) m.push('test');
  return m.map(x => t(x)).join(', ');
}
function vCapitolo() {
  const c = S.capitoli.find(x => x.id === V.cap); if (!c) return vHome();
  const TB = tabsAttive(); if (!TB.includes(V.tab)) V.tab = TB[0];
  if (V.mFull && V.tab === 'mappa' && haMappa(c)) return vMappaFull(c);
  const stampabile = TB.length > 1;
  let corpo = '';
  if (V.tab === 'riassunto') corpo = legendaColori() + '<div class="card"><h2>' + t('in_breve') + '</h2><ul>' + c.riassunto_breve.map(x => '<li>' + md(x) + '</li>').join('') + '</ul></div><div class="card"><h2>' + t('riass_compl') + '</h2>' + md(c.riassunto_completo) + '</div>' + (arr(c.inventario).length ? '<details class="card"><summary><b>' + t('inventario') + '</b> (' + c.inventario.length + ')</summary><ul>' + c.inventario.map(x => '<li>' + md(x) + '</li>').join('') + '</ul></details>' : '');
  else if (V.tab === 'schema') corpo = '<div class="card"><h2>' + esc(c.schema.radice || c.titolo) + '</h2>' + arr(c.schema.rami).map(r => '<div class="tree"><h3>' + md(r.titolo) + '</h3><ul>' + arr(r.punti).map(p => '<li>' + md(p) + '</li>').join('') + '</ul></div>').join('') + '</div>';
  else if (V.tab === 'mappa') corpo = vMappa(c);
  else if (V.tab === 'pratica') corpo = vPratica(c);
  else if (V.tab === 'costruisci') corpo = vCostruisci(c);
  else if (V.tab === 'orale') corpo = vOrale(c);
  else if (V.tab === 'spiegazioni') corpo = c.spiegazioni.map((s, i) => '<div class="card"><h3>' + md(s.concetto) + '</h3><p>' + md(s.spiegazione) + '</p><div class="fb"><b>' + t('esempio') + ':</b> ' + md(s.esempio) + '</div><button class="btn sec small" data-act="meglio" data-i="' + i + '">' + t('spiega_meglio') + '</button><div id="m' + i + '"></div></div>').join('') || '<div class="card muted">–</div>';
  else if (V.tab === 'glossario') corpo = '<div class="card">' + c.glossario.map(g => '<p><b>' + esc(g.termine) + '</b>: ' + md(g.definizione) + '</p>').join('') + '</div>';
  else corpo = vTestPartenza(c);
  const gr = V.genRiass && V.genRiass.id === c.id ? '<div class="card" dir="' + (FAM.lingua === 'ar' ? 'rtl' : 'ltr') + '" lang="' + FAM.lingua + '"><h3>' + t('gen_in_lingua') + '</h3>' + md(V.genRiass.testo) + '</div>' : '';
  return barra() + '<div class="card"><div class="muted">' + esc(c.materia) + '</div><h1>' + esc(c.titolo) + '</h1>' + (c.avvisi.length ? '<div class="fb warn">' + c.avvisi.map(esc).join('<br>') + '</div>' : '') +
    (mancano(c) ? '<div class="fb warn" role="alert"><b>!</b> (' + esc(mancano(c)) + '). <button class="btn small" data-act="completa"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('completa')) + '</button></div>' : '') +
    '<div class="row" style="margin-top:8px"><button class="btn sec small" data-act="apri-materia" data-m="' + esc(c.materia) + '">‹ ' + esc(c.materia) + '</button><button class="btn small" data-act="ascolta">' + t('ascolta') + '</button><button class="btn sec small" data-act="stop">' + t('ferma') + '</button>' + (stampabile ? '<button class="btn sec small" data-act="stampa">' + t('stampa') + '</button><button class="btn sec small" data-act="scarica">' + t('scarica') + '</button>' : '') + (FAM.lingua !== 'it' && sezOk('riassunto') ? '<button class="btn sec small" data-act="spiega-gen"' + (V.busy ? ' disabled' : '') + '>' + t('spiega_gen') + '</button>' : '') + '</div></div>' + boxLettura() + gr +
    '<div class="tabs" role="tablist">' + TB.map(x => '<button class="tab' + (V.tab === x ? ' on' : '') + '" role="tab" data-act="tab" data-t="' + x + '">' + t(x) + '</button>').join('') + '</div>' + corpo + boxSposta(c, 'cap');
}
function vTestPartenza(c) {
  if (V.come && V.come.cap === c.id) return cardCome();
  if (V.test && V.test.cap === c.id) return vTest(c);
  const liv = c.lvl || 1, n = idxLivello(c, liv).length, ult = c.risultati[c.risultati.length - 1];
  return '<div class="card"><h2>' + t('test_finale') + '</h2><p><b>' + t('livello_test', { n: liv, nome: t('liv_' + liv) }) + '</b></p><p>' + t('test_intro', { n: Math.min(n, 30) }) + '</p>' + (ult ? '<p class="muted">' + t('ultimo_ris', { p: ult.punti, n: ult.totale }) + '</p>' : '') +
    '<div class="row"><button class="btn" data-act="inizia-test"' + (n ? '' : ' disabled') + '>' + (ult ? t('rifai_test') : t('inizia_test')) + '</button><button class="btn sec" data-act="inizia-voce"' + (n ? '' : ' disabled') + '>' + t('quiz_voce') + '</button></div>' +
    '<div class="row" style="margin-top:8px"><button class="btn sec" data-act="test-nuovi"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('test_altre')) + '</button>' + (liv < LIV_TEST ? '<button class="btn sec" data-act="test-livello" data-d="1"' + (V.busy ? ' disabled' : '') + '>' + t('test_piu_difficile') + '</button>' : '') + (liv > 1 ? '<button class="btn sec" data-act="test-livello" data-d="-1"' + (V.busy ? ' disabled' : '') + '>' + t('test_piu_facile') + '</button>' : '') + '</div>' + (V.busy ? '<p><span class="spin"></span> ' + t('preparo_domande') + '</p>' : '') +
    '<p class="muted">' + t('voce_info') + '</p></div>';
}
function vTest(c) {
  const ts = V.test;
  if (ts.fine) {
    const errati = [...new Set(ts.errati.map(i => c.test[i].argomento).filter(Boolean))];
    return '<div class="card"><h2>' + t('hai_finito') + '</h2><p><b>' + t('p_su_n', { p: ts.punti, n: ts.dom.length }) + '</b></p>' +
      (errati.length ? '<div class="fb warn"><b>' + t('da_ripassare') + ':</b> ' + errati.map(esc).join(', ') + '</div>' : '<div class="fb ok">' + t('tutto_chiaro') + '</div>') +
      (ts.xp != null ? '<div class="fb ok" role="status"><b>⭐ ' + t('punti_guadagnati', { n: ts.xp }) + '</b>' + (ts.rangoNuovo >= 0 ? '<br>' + t('nuovo_rango', { r: t('rango_' + ts.rangoNuovo) }) : '') + arr(ts.nuovi).map(b => '<br>🏅 ' + t('nuovo_badge', { b: t('badge_' + b) })).join('') + '</div>' : '') +
      (ts.liv && !ts.ripasso && c.id !== '__rip' ? '<div class="row">' + (ts.pct >= 0.8 && ts.liv < LIV_TEST ? '<button class="btn" data-act="test-livello" data-d="1"' + (V.busy ? ' disabled' : '') + '>' + t('test_sali', { n: ts.liv + 1, nome: t('liv_' + (ts.liv + 1)) }) + '</button>' : '') + '<button class="btn sec" data-act="test-nuovi"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? '…' : t('test_altre')) + '</button>' + (ts.pct < 0.5 && ts.liv > 1 ? '<button class="btn sec" data-act="test-livello" data-d="-1"' + (V.busy ? ' disabled' : '') + '>' + t('test_piu_facile') + '</button>' : '') + '</div>' + (V.busy ? '<p><span class="spin"></span> ' + t('preparo_domande') + '</p>' : '') : '') +
      '<div class="row">' + (ts.errati.length ? '<button class="btn" data-act="solo-errori">' + t('ripeti_errori') + '</button>' : '') + '<button class="btn sec" data-act="chiudi-test">' + t('chiudi') + '</button></div></div>' + (ts.espMsg ? '<div class="card"><div class="fb ok">' + esc(t('esp_esito', { m: t('met_' + ts.espMsg.m), p: ts.espMsg.pct, b: ts.espMsg.base })) + ' <b>' + t(ts.espMsg.pct >= ts.espMsg.base + 5 ? 'esp_v_su' : ts.espMsg.pct <= ts.espMsg.base - 5 ? 'esp_v_giu' : 'esp_v_pari') + '</b></div></div>' : '') + (ts.ripasso || c.id === '__rip' ? '' : cardMetodo());
  }
  const q = c.test[ts.dom[ts.i]]; const opz = q.tipo === 'vf' ? [t('vero'), t('falso')] : arr(q.opzioni);
  const corr = q.tipo === 'vf' ? (q.corretta ? 0 : 1) : q.corretta;
  return '<div class="card"><div class="muted">' + t('domanda_di', { i: ts.i + 1, n: ts.dom.length }) + (ts.liv ? ' · ' + t('livello_test', { n: ts.liv, nome: t('liv_' + ts.liv) }) : '') + '</div><h2>' + md(q.domanda) + '</h2>' +
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
/* ===== Statistiche per i genitori ===== */
function statisticheFiglio(f, adesso) {
  const oggi = zero(adesso || new Date());
  const gg = iso => { const d = new Date(iso); return isNaN(d) ? null : fmtData(zero(d)); };
  const attivita = {}, add = iso => { const g = gg(iso); if (g) attivita[g] = (attivita[g] || 0) + 1; };
  arr(f.capitoli).forEach(c => { add(c.data); arr(c.risultati).forEach(r => add(r.data)); });
  arr(f.esercizi).forEach(e => add(e.data));
  const giorni = n => Array.from({ length: n }, (_, k) => { const d = new Date(oggi); d.setDate(oggi.getDate() - (n - 1 - k)); const sd = fmtData(d); return { giorno: sd, n: attivita[sd] || 0, data: d }; });
  const g14 = giorni(14), g30 = giorni(30);
  const norm = x => String(x || '').trim().toLowerCase();
  const tutti = [];
  arr(f.capitoli).forEach(c => arr(c.risultati).forEach(r => { const d = new Date(r.data); if (!isNaN(d)) tutti.push({ t: d.getTime(), data: r.data, pct: Math.round(100 * r.punti / (r.totale || 1)), titolo: c.titolo, materia: c.materia, errati: arr(r.errati) }); }));
  tutti.sort((a, b) => a.t - b.t);
  const media = tutti.length ? Math.round(tutti.reduce((a, x) => a + x.pct, 0) / tutti.length) : null;
  const mat = {};
  arr(f.capitoli).forEach(c => { const k = norm(c.materia) || '—'; (mat[k] = mat[k] || { materia: c.materia || '—', capitoli: 0, ris: [] }).capitoli++; });
  tutti.forEach(r => { const k = norm(r.materia) || '—'; (mat[k] = mat[k] || { materia: r.materia || '—', capitoli: 0, ris: [] }).ris.push(r); });
  const mean = a => a.reduce((x, y) => x + y.pct, 0) / a.length;
  const materie = Object.keys(mat).sort().map(k => {
    const m = mat[k], r = m.ris; let tr = 'poco';
    if (r.length >= 2) { const ult = r.slice(-3), prima = r.slice(0, Math.max(0, r.length - 3)).slice(-3); if (prima.length) { const d = mean(ult) - mean(prima); tr = d >= 8 ? 'su' : d <= -8 ? 'giu' : 'stabile'; } }
    return { materia: m.materia, capitoli: m.capitoli, test: r.length, media: r.length ? Math.round(mean(r)) : null, ultimo: r.length ? r[r.length - 1].data : '', trend: tr };
  });
  const cont = {};
  tutti.forEach(r => r.errati.forEach(a => { const k = norm(a); if (!k) return; const o = cont[k] = cont[k] || { argomento: a.trim(), volte: 0, materie: new Set() }; o.volte++; if (r.materia) o.materie.add(r.materia); }));
  const deboli = Object.keys(cont).map(k => ({ argomento: cont[k].argomento, volte: cont[k].volte, materie: [...cont[k].materie] })).sort((a, b) => b.volte - a.volte || a.argomento.localeCompare(b.argomento)).slice(0, 10);
  const os = fmtData(oggi), limite = new Date(oggi); limite.setDate(limite.getDate() - 3); const lim = fmtData(limite);
  const rip = Object.keys(f.rip || {}).map(k => f.rip[k]).filter(r => r && r.next);
  const ripasso = { totale: rip.length, dovute: rip.filter(r => r.next <= os).length, ritardo: rip.filter(r => r.next < lim).length };
  const verifiche = arr(f.verifiche).map(v => ({ materia: v.materia, argomento: v.argomento, data: v.data, giorni: Math.round((parseData(v.data) - oggi) / 864e5) })).filter(x => x.giorni >= 0 && x.giorni <= 30).sort((a, b) => a.giorni - b.giorni).map(x => {
    const r = tutti.filter(y => norm(y.materia) === norm(x.materia)); x.nTest = r.length; x.ultimoPct = r.length ? r[r.length - 1].pct : null; return x;
  });
  const es = arr(f.esercizi), fin = es.filter(e => e.finito);
  return { capitoli: arr(f.capitoli).length, test: tutti.length, media, esercizi: es.length, esFiniti: fin.length, indiziMedi: fin.length ? Math.round(10 * fin.reduce((a, e) => a + e.indiziTotali, 0) / fin.length) / 10 : null, controlli: f.controlli || 0,
    g14, attivi7: g14.slice(-7).filter(g => g.n > 0).length, attivi30: g30.filter(g => g.n > 0).length, ultimiTest: tutti.slice(-20), materie, deboli, ripasso, verifiche };
}
function graficoAttivita(st, lang) {
  const w = 28, h = 70, G = st.g14, max = Math.max(1, Math.max.apply(null, G.map(g => g.n)));
  let barre = '';
  G.forEach((g, i) => {
    const x = 6 + i * w, bh = Math.round(g.n / max * (h - 14));
    barre += (g.n ? '<rect class="st-bar" x="' + (x + 4) + '" y="' + (h - bh) + '" width="' + (w - 8) + '" height="' + bh + '" rx="3"/><text class="st-t" x="' + (x + w / 2) + '" y="' + (h - bh - 3) + '" text-anchor="middle">' + g.n + '</text>' : '<rect class="st-zero" x="' + (x + 4) + '" y="' + (h - 2) + '" width="' + (w - 8) + '" height="2"/>') +
      '<text class="st-t st-d" x="' + (x + w / 2) + '" y="' + (h + 14) + '" text-anchor="middle">' + esc(g.data.toLocaleDateString(lang, { weekday: 'narrow' })) + '</text>';
  });
  return '<svg class="st-svg" viewBox="0 0 ' + (12 + 14 * w) + ' ' + (h + 20) + '" width="' + (12 + 14 * w) + '" role="img" aria-label="' + esc(t('stat_attivita') + ': ' + t('stat_giorni7', { a: st.attivi7 })) + '">' + barre + '</svg>';
}
function graficoTest(st) {
  const L = st.ultimiTest, w = 28, h = 100; let barre = '';
  L.forEach((r, i) => {
    const x = 6 + i * w, bh = Math.max(2, Math.round(r.pct * 0.8));
    barre += '<rect class="' + (r.pct >= 70 ? 'st-ok' : 'st-basso') + '" x="' + (x + 3) + '" y="' + (90 - bh) + '" width="' + (w - 6) + '" height="' + bh + '" rx="3"/><text class="st-t" x="' + (x + w / 2) + '" y="' + (90 - bh - 3) + '" text-anchor="middle">' + r.pct + '</text>';
  });
  const vw = 12 + Math.max(L.length, 20) * w;
  return '<svg class="st-svg" viewBox="0 0 ' + vw + ' ' + h + '" width="' + vw + '" role="img" aria-label="' + esc(t('stat_test_tempo') + ': ' + L.map(r => r.pct + '%').join(', ')) + '"><line class="st-soglia" x1="0" x2="' + vw + '" y1="' + (90 - 56) + '" y2="' + (90 - 56) + '"/>' + barre + '</svg>';
}
function statisticheCorpo(f, st) {
  const lang = LINGUE_VOCE[LINGUA_CORRENTE], tr = { su: '↑ ' + t('stat_su'), giu: '↓ ' + t('stat_giu'), stabile: '→ ' + t('stat_stabile'), poco: '– ' + t('stat_poco') };
  const vuoto = '<p class="muted">' + t('stat_vuoto') + '</p>';
  return '<div class="row"><span class="chip">' + t('n_cap', { n: st.capitoli }) + '</span><span class="chip">' + t('test_fatti') + ': ' + st.test + '</span>' +
    '<span class="chip ' + (st.media != null && st.media < 60 ? 'warn' : st.media != null ? 'ok' : '') + '">' + t('stat_media') + ': ' + (st.media != null ? st.media + '%' : '–') + '</span>' +
    '<span class="chip">' + t('n_es', { n: st.esercizi }) + '</span><span class="chip">' + t('stat_controlli') + ': ' + st.controlli + '</span></div>' +
    '<h3 style="margin-top:16px">' + t('stat_attivita') + '</h3><p>' + t('stat_giorni7', { a: st.attivi7 }) + ' · ' + t('stat_giorni30', { a: st.attivi30 }) + '</p>' + graficoAttivita(st, lang) + '<p class="muted">' + t('stat_giorni_nota') + '</p>' +
    '<h3 style="margin-top:16px">' + t('stat_test_tempo') + '</h3>' + (st.ultimiTest.length ? graficoTest(st) + '<p class="muted">' + t('stat_soglia') + '</p>' : vuoto) +
    '<h3 style="margin-top:16px">' + t('stat_materie') + '</h3>' + (st.materie.length ? '<div class="st-scroll"><table class="st-tab"><thead><tr><th>' + t('stat_materia') + '</th><th>' + t('stat_cap') + '</th><th>' + t('stat_test') + '</th><th>' + t('stat_media_c') + '</th><th>' + t('stat_trend') + '</th></tr></thead><tbody>' +
      st.materie.map(m => '<tr><td>' + esc(m.materia) + '</td><td>' + m.capitoli + '</td><td>' + m.test + '</td><td>' + (m.media != null ? m.media + '%' : '–') + '</td><td>' + tr[m.trend] + '</td></tr>').join('') + '</tbody></table></div>' : vuoto) +
    '<h3 style="margin-top:16px">' + t('stat_deboli') + '</h3>' + (st.deboli.length ? '<ul>' + st.deboli.map(d => '<li><b>' + esc(d.argomento) + '</b> — ' + t('stat_volte', { n: d.volte }) + (d.materie.length ? ' <span class="muted">(' + esc(d.materie.join(', ')) + ')</span>' : '') + '</li>').join('') + '</ul>' : vuoto) +
    '<h3 style="margin-top:16px">' + t('stat_ripasso') + '</h3><p>' + t('stat_rip_riga', { a: st.ripasso.totale, b: st.ripasso.dovute, c: st.ripasso.ritardo }) + '</p>' +
    '<h3 style="margin-top:16px">' + t('stat_verifiche') + '</h3>' + (st.verifiche.length ? '<ul>' + st.verifiche.map(v => '<li><b>' + esc(v.materia) + '</b>' + (v.argomento ? ' · ' + esc(v.argomento) : '') + ' — ' + esc(quando(v.giorni)) + ' <span class="muted">(' + (v.ultimoPct != null ? t('stat_ultimo_test', { p: v.ultimoPct }) : t('stat_nessun_test')) + ')</span></li>').join('') + '</ul>' : vuoto) +
    '<h3 style="margin-top:16px">' + t('stat_esercizi') + '</h3><p>' + (st.esercizi ? t('stat_es_riga', { f: st.esFiniti, n: st.esercizi, m: st.indiziMedi != null ? st.indiziMedi : '–' }) : t('stat_vuoto')) + '</p>';
}
function vStat() {
  const f = DB.figli.find(x => x.id === V.statF);
  if (!V.genitoriOk || !f) return vGenitori();
  const st = statisticheFiglio(f);
  return barra() + '<div class="card"><div class="row"><button class="btn sec small" data-act="stat-indietro">‹ ' + t('area_gen') + '</button><button class="btn sec small" data-act="stat-stampa">' + t('stat_stampa') + '</button></div><h1 style="margin-top:10px">' + t('stat_di', { n: esc(f.profilo.nome) }) + '</h1>' + statisticheCorpo(f, st) + '</div>';
}
function vGenitori() {
  if (!V.genitoriOk) return barra() + '<div class="card"><h1>' + t('area_gen') + '</h1><label class="f">' + t('pin') + '<input type="password" id="pinin" inputmode="numeric" maxlength="8" autocomplete="off"></label><button class="btn" data-act="pin-ok">' + t('entra') + '</button></div>';
  const lang = LINGUE_VOCE[LINGUA_CORRENTE];
  const figli = DB.figli.map(f => {
    const rr = []; f.capitoli.forEach(c => c.risultati.forEach(r => rr.push({ c: c, r: r })));
    const s0 = S; S = f; const nrip = ripDovute().length, ver = prossimeVerifiche(30); S = s0;
    rr.sort((a, b) => b.r.data.localeCompare(a.r.data));
    return '<div class="card"><h2>' + esc(f.profilo.nome) + (f.profilo.pin ? ' 🔒' : '') + '</h2>' + (SEZ.some(k => f.profilo.sezioni && f.profilo.sezioni[k] === false) ? '<p class="muted">' + t('sez_nascoste') + ': ' + SEZ.filter(k => f.profilo.sezioni[k] === false).map(k => t(k)).join(', ') + '</p>' : '') + '<div class="row"><span class="chip">' + t('n_cap', { n: f.capitoli.length }) + '</span><span class="chip">' + t('test_fatti') + ': ' + rr.length + '</span><span class="chip">' + t('n_es', { n: f.esercizi.length }) + '</span><span class="chip ' + (nrip ? 'warn' : '') + '">' + t('ripasso_oggi') + ': ' + nrip + '</span></div><p></p>' +
      '<div class="row"><button class="btn small" data-act="stat-apri" data-id="' + f.id + '">' + t('stat_btn') + '</button><button class="btn small" data-act="apri-figlio" data-id="' + f.id + '">' + t('apri_come', { n: esc(f.profilo.nome) }) + '</button><button class="btn sec small" data-act="modifica-figlio" data-id="' + f.id + '">' + t('modifica') + '</button><button class="btn sec small" data-act="elimina-figlio" data-id="' + f.id + '">' + t('elimina_figlio') + '</button></div>' +
      (ver.length ? '<p></p><b>' + t('verifiche') + '</b>' + ver.map(x => '<p>' + esc(x.v.materia) + (x.v.argomento ? ' · ' + esc(x.v.argomento) : '') + ' <span class="chip ' + (x.d <= 3 ? 'warn' : '') + '">' + esc(quando(x.d)) + '</span></p>').join('') : '') +
      '<details><summary>' + t('da_rinforzare') + '</summary>' + (rr.length ? rr.slice(0, 8).map(x => '<p><b>' + esc(x.c.titolo) + '</b> · ' + t('p_su_n', { p: x.r.punti, n: x.r.totale }) + ' · ' + esc(new Date(x.r.data).toLocaleDateString(lang)) + (x.r.errati.length ? '<br><span class="muted">' + t('da_ripassare') + ': ' + esc(x.r.errati.join(', ')) + '</span>' : '') + '</p>').join('') : '<p class="muted">' + t('nessun_test') + '</p>') + '</details>' +
      '<details><summary>' + t('contenuti') + '</summary>' + (f.capitoli.length ? f.capitoli.map(c => '<p><b>' + esc(c.titolo) + '</b> <span class="muted">(' + esc(c.materia) + ')</span> <button class="btn sec small" data-act="apri-cap-di" data-f="' + f.id + '" data-id="' + c.id + '">' + t('vedi') + '</button></p>').join('') : '<p class="muted">–</p>') + f.esercizi.map(e => '<p><b>' + esc(e.materia) + '</b>: ' + esc(e.richiesta).slice(0, 70) + ' <span class="chip ' + (e.finito ? 'ok' : 'warn') + '">' + (e.finito ? t('completato') : t('in_corso')) + '</span></p>').join('') + '</details></div>';
  }).join('');
  const bk = FAM.ultimoBackup ? t('ultima_copia', { d: esc(new Date(FAM.ultimoBackup).toLocaleDateString(lang)) }) + (Date.now() - new Date(FAM.ultimoBackup).getTime() > 30 * 86400000 ? ' ' + t('copia_vecchia') : '') : '<b>' + t('no_copia') + '</b>';
  return barra() + '<div class="card"><h1>' + t('area_gen') + '</h1></div><h2>' + t('figli') + '</h2>' + (figli || '<div class="card muted">' + t('nessun_profilo') + '</div>') +
    '<div class="card"><button class="btn" data-act="aggiungi-figlio">+ ' + t('aggiungi_figlio') + '</button></div>' +
    '<div class="card"><h2>' + t('imp_famiglia') + '</h2><p class="muted">' + t('lingua_gen') + ': <b>' + LINGUE[FAM.lingua] + '</b> · ' + t('ai_titolo') + ': <b>' + esc(FAM.ai.provider === 'compat' && (FAM.ai.preset === 'gemini' || FAM.ai.preset === 'groq') ? FAM.ai.preset : FAM.ai.provider) + '</b></p><button class="btn sec" data-act="modifica-fam">' + t('modifica') + '</button></div>' +
    '<div class="card"><h2>' + t('priv_btn') + '</h2><p class="muted">' + t('priv_breve') + '</p><button class="btn sec" data-act="priv-apri">' + t('priv_btn') + '</button></div>' +
    '<div class="card"><h2>' + t('dati_sic') + '</h2><p class="muted">' + t('dati_info') + '</p><p class="muted">' + bk + '</p><div class="row"><button class="btn sec" data-act="esporta">' + t('salva_copia') + '</button><label class="btn sec">' + t('ripristina') + '<input type="file" accept="application/json" id="imp" hidden></label><button class="btn sec" id="installa" data-act="installa"' + (promptInstalla ? '' : ' hidden') + '>' + t('installa') + '</button><button class="btn sec" data-act="azzera">' + t('cancella_tutto') + '</button></div></div>';
}
function render() {
  if (V.mFull && !(V.vista === 'capitolo' && V.tab === 'mappa')) { V.mFull = false; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* già fuori */ } }
  if (V.or && V.or.fase === 'ascolto' && !(V.vista === 'capitolo' && V.tab === 'orale' && V.cap === V.or.cap)) { V.or.fermo = true; V.or.fase = 'pronto'; try { if (V.rec) V.rec.abort(); } catch (e) { /* già fermo */ } V.rec = null; }
  if ((V.vista === 'fam' || V.vista === 'setup') && FAM.pin && !V.genitoriOk) V.vista = 'genitori';
  if (V.vista === 'genitori' && !FAM.pin) V.vista = 'fam';
  if (!S.profilo && ['home', 'materia', 'capitolo', 'esercizio', 'nuovo-cap', 'nuovo-es', 'controllo', 'aspetto', 'ripasso'].includes(V.vista)) V.vista = DB.figli.length ? 'scelta' : (FAM.pin ? 'genitori' : 'fam');
  if (!['genitori', 'fam', 'setup', 'stat', 'privacy'].includes(V.vista)) V.genitoriOk = false;
  applicaTema();
  const v = V.vista;
  const M = { privacy: vPrivacy, fam: vFam, setup: vSetup, scelta: vScelta, home: vHome, 'nuovo-cap': () => vNuovo('cap'), 'nuovo-es': () => vNuovo('es'), controllo: vControllo, materia: vMateria, capitolo: vCapitolo, esercizio: vEsercizio, genitori: vGenitori, stat: vStat, aspetto: vAspetto, ripasso: vRipasso };
  document.getElementById('app').oninput = null;
  document.getElementById('app').innerHTML = (M[v] || vHome)();
  if (V.mzFit && document.querySelector('.mappa-wrap')) { V.mzFit = false; if (!V.mEdit || V.mFull) fitMappa(); }
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
    document.getElementById('chiave').oninput = () => { if (prov.value !== 'demo') return; const a = leggiAi(); if (a.provider !== 'demo') { prov.value = a.provider; prov.onchange(); } };
    prov.onchange = () => { document.getElementById('boxcompat').hidden = prov.value !== 'compat'; const x = PRESET[prov.value === 'compat' ? preset.value : prov.value]; if (x && prov.value !== 'anthropic' && prov.value !== 'openrouter' && prov.value !== 'demo') { document.getElementById('url').value = x.url; document.getElementById('modello').value = x.modello || ''; } };
    preset.onchange = () => { const x = PRESET[preset.value]; document.getElementById('url').value = x.url; if (x.modello) document.getElementById('modello').value = x.modello; };
    document.getElementById('lingua-gen').onchange = e => { V.bozzaFam = { ai: leggiAi(), lingua: e.target.value }; FAM.lingua = e.target.value; render(); };
  }
  if (v === 'setup') {
    const fEdit = V.edit ? DB.figli.find(x => x.id === V.edit) : null;
    let toccato = !!(fEdit && fEdit.profilo.auto === false);
    document.getElementById('app').oninput = e => { if (e.target && e.target.dataset && e.target.dataset.pref && ['font', 'fs', 'lh', 'ls', 'ws'].includes(e.target.dataset.pref)) toccato = true; };
    document.getElementById('colori').addEventListener('change', () => { toccato = true; });
    const consiglia = forza => {
      const dsa = {}; document.querySelectorAll('[data-dsa]').forEach(x => { if (x.checked) dsa[x.dataset.dsa] = true; });
      const liv = document.getElementById('livello').value, r = aspettoConsigliato(liv, dsa);
      const cur = (document.querySelector('input[name=tema]:checked') || {}).value;
      document.getElementById('cons').innerHTML = bloccoTema({ livello: liv, tema: (!forza && cur && temiPer(liv).includes(cur)) ? cur : r.tema });
      if (toccato && !forza) return;
      document.getElementById('colori').checked = !dsa.dislessia;
      const setv = (k, val) => { const e = document.querySelector('[data-pref="' + k + '"]'); if (e) e.value = val; };
      setv('font', r.font); setv('fs', r.fs); setv('lh', r.lh); setv('ls', r.ls); setv('ws', r.ws);
      anteprima();
    };
    document.querySelectorAll('[data-dsa]').forEach(x => x.onchange = () => { document.getElementById('info-' + x.dataset.dsa).hidden = !x.checked; consiglia(false); });
    document.getElementById('livello').onchange = () => consiglia(false);
    const bt = document.getElementById('btn-cons'); if (bt) bt.onclick = () => { toccato = false; consiglia(true); };
    if (!fEdit) consiglia(false);
  }
  if (v === 'setup' || v === 'aspetto') { anteprima(); riempiVoci(); }
  if (v === 'setup') document.getElementById('lingua-fig').addEventListener('change', riempiVoci);
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
  const pv = g('prov');
  if (pv === 'gemini' || pv === 'groq') return indovinaServizio({ provider: 'compat', key: g('chiave'), model: g('modello'), preset: pv, url: PRESET[pv].url });
  return indovinaServizio({ provider: pv, key: g('chiave'), model: g('modello'), preset: g('preset') || 'ollama', url: g('url') });
}
const AZ = {
  'prova-ai': async () => {
    const out = document.getElementById('esitoprova'); const a = leggiAi(); if (!a.key) { a.kc = FAM.ai.kc; a.key = FAM.ai.key; }
    if (a.provider === 'demo') { out.textContent = '–'; return; }
    out.textContent = '…';
    try { const r = await chiamaAI('Rispondi solo con la parola OK.', 'Rispondi OK.', [], a); out.textContent = t('esito_prova_ok') + ' ' + r.slice(0, 40); }
    catch (e) { out.textContent = e.message === 'NODEMO' ? t('chiave_api') + '?' : e.message; }
  },
  'home': () => { V.genVede = false; fermaVoce(); V.vista = S.profilo ? 'home' : 'scelta'; V.test = null; V.voce = false; V.lettura = null; },
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
    if (!S.materie.some(m => sameM(m, sel.value))) S.materie.push(sel.value);
    it.materia = sel.value; V.materia = sel.value; salva(); toast(t('spostato', { n: sel.value }));
  },
  'elimina-cap': el => { const it = S.capitoli.find(x => x.id === el.dataset.id); if (!it || !confirm(t('conferma', { n: it.titolo }))) return 'async'; S.capitoli = S.capitoli.filter(x => x.id !== it.id); pulisciRip(); salva(); V.materia = it.materia; V.vista = 'materia'; },
  'elimina-es': el => { const it = S.esercizi.find(x => x.id === el.dataset.id); if (!it || !confirm(t('conferma', { n: String(it.richiesta).slice(0, 40) }))) return 'async'; S.esercizi = S.esercizi.filter(x => x.id !== it.id); salva(); V.materia = it.materia; V.vista = 'materia'; },
  'su': el => { const i = +el.dataset.i; if (i > 0) [V.foto[i - 1], V.foto[i]] = [V.foto[i], V.foto[i - 1]]; },
  'giu': el => { const i = +el.dataset.i; if (i < V.foto.length - 1) [V.foto[i + 1], V.foto[i]] = [V.foto[i], V.foto[i + 1]]; },
  'del': el => { V.foto.splice(+el.dataset.i, 1); },
  'prepara-cap': () => { preparaCapitolo(); return 'async'; },
  'prepara-es': () => { preparaEsercizio(); return 'async'; },
  'apri-cap': el => { V.coAiuto = {}; V.mzFit = true; V.prFb = {}; V.prBozza = {}; V.mEdit = false; V.mSel = null; V.mundo = []; V.cap = el.dataset.id; V.genVede = false; V.tab = primoTab(); V.test = null; V.vista = 'capitolo'; },
  'apri-es': el => { V.es = el.dataset.id; V.fb = null; V.passoOk = false; V.mostra = {}; V.bozza = ''; V.vista = 'esercizio'; },
  'tab': el => { if (!tabsAttive().includes(el.dataset.t)) return; { const c0 = S.capitoli.find(x => x.id === V.cap); if (c0 && V.tab === 'pratica') salvaBozzePratica(c0); if (c0 && V.tab === 'costruisci') salvaBozzeCo(c0); if (V.or && V.or.fase === 'rivedi') V.or.trascr = ((document.getElementById('or-testo') || {}).value || V.or.trascr || ''); } V.tab = el.dataset.t; if (V.tab !== 'mappa') V.mEdit = false; else V.mzFit = true; },
  'ascolta': () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async';
    const tx = V.tab === 'riassunto' ? c.riassunto_breve.join('. ') + '. ' + c.riassunto_completo
      : V.tab === 'glossario' ? c.glossario.map(g => g.termine + ': ' + g.definizione).join('. ')
      : V.tab === 'spiegazioni' ? c.spiegazioni.map(x => x.concetto + '. ' + x.spiegazione + ' ' + x.esempio).join(' ')
      : V.tab === 'mappa' ? (haMappa(c) ? mappaElenco(c.mappa).join('. ') : c.titolo)
      : V.tab === 'orale' ? (V.or && V.or.cap === c.id && V.or.turni.length ? V.or.turni[V.or.turni.length - 1].testo : c.titolo)
      : V.tab === 'costruisci' ? mioDi(c).sez.filter(s => s.testo.trim()).map(s => s.t + '. ' + s.testo).join(' ') || c.titolo
      : V.tab === 'pratica' ? arr(c.pratica).map((e, i) => t('pr_n', { n: i + 1 }) + '. ' + e.testo).join(' ')
      : V.tab === 'schema' ? (c.schema.radice || c.titolo) + '. ' + arr(c.schema.rami).map(r => r.titolo + ': ' + arr(r.punti).join('. ')).join('. ')
      : c.titolo;
    leggiConEvidenza(tx); return 'async';
  },
  'stampa': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async'; document.getElementById('stampa').innerHTML = dispensaHTML(c); const t = document.title; document.title = c.titolo; try { window.print(); } catch (e) { toast('La stampa non è disponibile.'); } document.title = t; return 'async'; },
  'scarica': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async'; const b = new Blob(['\ufeff' + dispensaTesto(c)], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (c.titolo || 'capitolo').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) + '.txt'; document.body.appendChild(a); a.click(); a.remove(); return 'async'; },
  'stat-apri': el => { V.statF = el.dataset.id; V.vista = 'stat'; },
  'stat-indietro': () => { V.vista = 'genitori'; },
  'stat-stampa': () => {
    const f = DB.figli.find(x => x.id === V.statF); if (!f) return 'async';
    document.getElementById('stampa').innerHTML = '<section><h1>' + t('stat_di', { n: esc(f.profilo.nome) }) + '</h1><p class="meta">' + esc(new Date().toLocaleDateString(LINGUE_VOCE[LINGUA_CORRENTE])) + ' · AI.st.ain</p>' + statisticheCorpo(f, statisticheFiglio(f)) + '</section>';
    const tt = document.title; document.title = t('stat_di', { n: f.profilo.nome }); try { window.print(); } catch (e) { toast('La stampa non è disponibile.'); } document.title = tt; return 'async';
  },
  'mappa-full': () => { V.mFull = true; V.mzFit = true; try { const e = document.documentElement; if (e.requestFullscreen && !document.fullscreenElement) e.requestFullscreen().catch(() => {}); } catch (e) { /* senza schermo intero del dispositivo la pagina riempie comunque lo schermo */ } window.scrollTo(0, 0); },
  'mappa-chiudi-full': () => { V.mFull = false; V.mzFit = true; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* già fuori */ } },
  'mappa-modifica': () => {
    const c = mappaCorr(); if (!c) return 'async';
    V.mEdit = !V.mEdit; V.mundo = [];
    if (V.mEdit) { mappaNormalizza(c.mappa); salva(); V.mSel = c.mappa.nodi[0].id; }
    rinfresca(); return 'async';
  },
  'mappa-sel': el => { V.mSel = el.dataset.id; rinfresca(); const p = document.getElementById('mp-pannello'); if (p && p.scrollIntoView) p.scrollIntoView({ block: 'nearest' }); return 'async'; },
  'mappa-salva': () => {
    const c = mappaCorr(); if (!c) return 'async'; const m = c.mappa, n = m.nodi.find(x => x.id === V.mSel); if (!n) return 'async';
    const tx = vv('mp-testo').trim().slice(0, 120); if (!tx) { toast('Il testo del nodo non può essere vuoto.'); return 'async'; }
    mappaPrima(c); n.testo = tx;
    const gi = mpGenIdx(m, n.id); if (gi >= 0) m.relazioni[gi].etichetta = vv('mp-etich').trim().slice(0, 60);
    salva(); rinfresca(); return 'async';
  },
  'mappa-sposta': () => {
    const c = mappaCorr(); if (!c) return 'async'; const m = c.mappa, id = V.mSel, np = vv('mp-genitore');
    const gi = mpGenIdx(m, id); if (gi < 0 || !m.nodi.some(n => n.id === np) || np === id || mpDiscendenti(m, id).has(np)) return 'async';
    if (m.relazioni[gi].da === np) return 'async';
    mappaPrima(c); const e = m.relazioni.splice(gi, 1)[0]; e.da = np; m.relazioni.push(e);
    salva(); rinfresca(); return 'async';
  },
  'mappa-ordine': el => {
    const c = mappaCorr(); if (!c) return 'async'; const m = c.mappa, gi = mpGenIdx(m, V.mSel); if (gi < 0) return 'async';
    const fr = m.relazioni.map((r, i) => i).filter(i => !m.relazioni[i].x && m.relazioni[i].da === m.relazioni[gi].da), p = fr.indexOf(gi), q = p + parseInt(el.dataset.d, 10);
    if (q < 0 || q >= fr.length) return 'async';
    mappaPrima(c); const tmp = m.relazioni[fr[p]]; m.relazioni[fr[p]] = m.relazioni[fr[q]]; m.relazioni[fr[q]] = tmp;
    salva(); rinfresca(); return 'async';
  },
  'mappa-aggiungi': () => {
    const c = mappaCorr(); if (!c) return 'async'; const m = c.mappa;
    const tx = vv('mp-nuovo').trim().slice(0, 120); if (!tx) { toast('Scrivi il testo del nuovo nodo.'); return 'async'; }
    if (m.nodi.length >= 60) { toast('La mappa ha già 60 nodi: è il massimo.'); return 'async'; }
    mappaPrima(c); const id = nuovoIdNodo(m); m.nodi.push({ id, testo: tx }); m.relazioni.push({ da: V.mSel, a: id, etichetta: vv('mp-nuovo-et').trim().slice(0, 60), x: false });
    V.mSel = id; salva(); rinfresca(); return 'async';
  },
  'mappa-collega': () => {
    const c = mappaCorr(); if (!c) return 'async'; const m = c.mappa, verso = vv('mp-verso');
    if (!m.nodi.some(n => n.id === verso) || verso === V.mSel) return 'async';
    if (m.relazioni.some(r => r.da === V.mSel && r.a === verso)) { toast('Questi due nodi sono già collegati.'); return 'async'; }
    mappaPrima(c); m.relazioni.push({ da: V.mSel, a: verso, etichetta: vv('mp-verso-et').trim().slice(0, 60), x: true });
    salva(); rinfresca(); return 'async';
  },
  'mappa-del-x': el => {
    const c = mappaCorr(); if (!c) return 'async'; const i = parseInt(el.dataset.i, 10), m = c.mappa;
    if (!(i >= 0 && i < m.relazioni.length) || !m.relazioni[i].x) return 'async';
    mappaPrima(c); m.relazioni.splice(i, 1); salva(); rinfresca(); return 'async';
  },
  'mappa-elimina': () => {
    const c = mappaCorr(); if (!c) return 'async'; const m = c.mappa, id = V.mSel, gi = mpGenIdx(m, id); if (gi < 0 || id === m.nodi[0].id) return 'async';
    mappaPrima(c); const padre = m.relazioni[gi].da, via = mpDiscendenti(m, id); via.add(id);
    m.nodi = m.nodi.filter(n => !via.has(n.id)); m.relazioni = m.relazioni.filter(r => !via.has(r.da) && !via.has(r.a));
    V.mSel = padre; salva(); rinfresca(); return 'async';
  },
  'mappa-annulla': () => {
    const c = mappaCorr(); if (!c || !V.mundo || !V.mundo.length) return 'async';
    c.mappa = pulisciMappa(JSON.parse(V.mundo.pop())); salva(); rinfresca(); return 'async';
  },
  'mappa-zoom': el => {
    V.mz = Math.max(0.3, Math.min(3, (V.mz || 1) * parseFloat(el.dataset.d)));
    const sv = document.querySelector('.mappa-wrap svg');
    if (sv) { sv.setAttribute('width', Math.round(sv.dataset.w * V.mz)); sv.setAttribute('height', Math.round(sv.dataset.h * V.mz)); }
    return 'async';
  },
  'mappa-adatta': () => { fitMappa(); return 'async'; },
  'mappa-muovi': el => {
    const c = mappaCorr(); if (!c) return 'async'; const n = c.mappa.nodi.find(x => x.id === V.mSel); if (!n) return 'async';
    const L = mappaLayout(c.mappa), o = L.nodo[n.id]; mappaPrima(c);
    n.px = Math.max(10, Math.min(5000, Math.round(o.x + (+el.dataset.dx || 0)))); n.py = Math.max(10 + L.h / 2, Math.min(5000, Math.round(o.y + (+el.dataset.dy || 0))));
    salva(); rinfresca(); return 'async';
  },
  'mappa-riordina': () => {
    const c = mappaCorr(); if (!c) return 'async'; mappaPrima(c);
    c.mappa.nodi.forEach(n => { delete n.px; delete n.py; }); c.mappa.relazioni.forEach(r => { delete r.ldx; delete r.ldy; });
    salva(); V.mzFit = true; rinfresca(); return 'async';
  },
  'stampa-mappa': () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || !haMappa(c)) return 'async';
    document.getElementById('stampa').innerHTML = '<section class="mappa-pg"><h1>' + esc(c.titolo) + '</h1><p class="meta">' + esc(c.materia) + ' · ' + t('mappa') + '</p>' + mappaSVG(c.mappa, 0, c.titolo) + '</section>';
    const tt = document.title; document.title = c.titolo; try { window.print(); } catch (e) { toast('La stampa non è disponibile.'); } document.title = tt; return 'async';
  },
  'crea-mappa': async () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return;
    if (haMappa(c) && !confirm(t('mappa_sovrascrivi'))) return;
    V.mEdit = false; V.mundo = [];
    V.busy = true; render();
    try {
      let m;
      if (FAM.ai.provider === 'demo') m = mappaDaSchema(c);
      else m = pulisciMappa(await chiediJSON(SYS_MAPPA + '\n\n' + profiloTesto(), 'Titolo: ' + c.titolo + '\nMateria: ' + c.materia + '\nRiassunto breve:\n- ' + c.riassunto_breve.join('\n- ') + '\n\nRiassunto completo:\n' + c.riassunto_completo, [], SCHEMA_MAPPA));
      if (m.nodi.length < 4 || m.relazioni.length < 3) throw new Error('la mappa è venuta troppo piccola: riprova');
      c.mappa = m; V.mz = 1; V.mzFit = true; salva();
    } catch (e) { toast(e.message === 'NODEMO' ? 'Per usare l\'AI serve una chiave: la inserisci in Area genitori › Impostazioni.' : 'Non sono riuscito: ' + e.message); }
    V.busy = false; render();
  },
  'completa': async () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return;
    if (FAM.ai.provider === 'demo') { toast('In modalità demo non si può completare.'); return; }
    V.busy = true; render();
    try {
      const n = await chiediJSON(SYS_COMPLETA + '\n\n' + profiloTesto(), 'Titolo: ' + c.titolo + '\nMateria: ' + c.materia + '\nRiassunto breve:\n- ' + c.riassunto_breve.join('\n- ') + '\n\nRiassunto completo:\n' + c.riassunto_completo, [], SCHEMA_CAPITOLO);
      if (!arr(c.schema && c.schema.rami).length && n.schema) c.schema = n.schema;
      if (!arr(c.spiegazioni).length) c.spiegazioni = arr(n.spiegazioni);
      if (!arr(c.glossario).length) c.glossario = arr(n.glossario);
      if (!arr(c.test).length) { c.test = mescolaOpzioni(normDomande(arr(n.test), 1)); c.mesc = true; }
      if (!arr(c.pratica).length) c.pratica = normPratica(n.pratica);
      if (!arr(c.inventario).length) c.inventario = arr(n.inventario);
      salva(); toast(mancano(c) ? 'Alcune parti mancano ancora: riprova.' : 'Fatto: ora c\'è tutto.');
    } catch (e) { toast('Non sono riuscito: ' + e.message); }
    V.busy = false; render();
  },
  'stop': () => { fermaVoce(); V.lettura = null; },
  'prova-voce': () => {
    const sv = document.getElementById('voce-sel'), sl = document.getElementById('lingua-fig'), sp = document.querySelector('[data-pref="vel"]');
    const lg = (sl && sl.value) || (S.profilo && S.profilo.lingua) || 'it';
    fermaVoce(); parlaCb(I18N[lg].voce_frase, null, null, { voce: sv ? sv.value : '', lingua: lg, vel: sp ? parseFloat(sp.value) : 0 });
    return 'async';
  },
  'meglio': async el => { const c = S.capitoli.find(x => x.id === V.cap); const s = c.spiegazioni[+el.dataset.i]; const box = document.getElementById('m' + el.dataset.i); box.innerHTML = '<p><span class="spin"></span></p>';
    try { if (FAM.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 400)); box.innerHTML = '<div class="fb">In demo la spiegazione alternativa non è disponibile. Con la chiave AI, AI.st.ain la riscrive con parole e un esempio diversi.</div>'; }
      else { const t = await chiamaAI('Sei AI.st.ain, tutor di studio. Spiega in modo diverso, più semplice, con un nuovo esempio concreto. Massimo 6 frasi brevi, in italiano. Solo testo.\n\n' + profiloTesto(), 'Concetto: ' + s.concetto + '\nSpiegazione precedente: ' + s.spiegazione, []); box.innerHTML = '<div class="fb">' + md(t) + '</div>'; } }
    catch (e) { box.innerHTML = '<div class="fb warn">' + esc(e.message) + '</div>'; } return 'async'; },
  'inizia-voce': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return; const liv = c.lvl || 1, dom = campiona(idxLivello(c, liv), 25); if (!dom.length) return; V.voce = true; V.lettura = null; fermaVoce(); V.test = { cap: c.id, dom: dom, i: 0, punti: 0, errati: [], scelta: null, fine: false, liv: liv }; },
  'inizia-test': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return; const liv = c.lvl || 1, dom = campiona(idxLivello(c, liv), 25); if (!dom.length) return; V.voce = false; V.test = { cap: c.id, dom: dom, i: 0, punti: 0, errati: [], scelta: null, fine: false, liv: liv }; },
  'test-nuovi': async () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return 'async'; await nuoviTest(c, c.lvl || 1); return 'async'; },
  'test-livello': async el => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return 'async';
    const liv = Math.max(1, Math.min(LIV_TEST, (c.lvl || 1) + (+el.dataset.d || 0))); const dom = idxLivello(c, liv);
    if (dom.length >= 6) { c.lvl = liv; salva(); fermaVoce(); V.voce = false; V.test = { cap: c.id, dom: campiona(dom, 25), i: 0, punti: 0, errati: [], scelta: null, fine: false, liv: liv }; V.tab = 'test'; render(); return 'async'; }
    await nuoviTest(c, liv); return 'async';
  },
  'crea-pratica': async () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return 'async';
    salvaBozzePratica(c);
    if (FAM.ai.provider === 'demo') { c.pratica = normPratica(DEMO_PRATICA); salva(); render(); return 'async'; }
    V.busy = true; render();
    try {
      const gia = arr(c.pratica).map(e => '- ' + e.testo).join('\n');
      const r = await chiediJSON(SYS_PRATICA + '\n\n' + profiloTesto(), 'Titolo: ' + c.titolo + '\nMateria: ' + c.materia + '\n\nRiassunto completo:\n' + c.riassunto_completo + (gia ? '\n\nEsercizi già presenti (non ripeterli):\n' + gia : ''), [], SCHEMA_PRATICA);
      const nuovi = normPratica(r.pratica); if (nuovi.length < 3) throw new Error('Non sono riuscito a preparare esercizi validi: riprova.');
      c.pratica = arr(c.pratica).concat(nuovi).slice(-30); salva();
    } catch (e) { toast(e.message === 'NODEMO' ? t('serve_chiave_ai') : e.message); }
    V.busy = false; render(); return 'async';
  },
  'or-inizia': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return; orPronto(c, parseInt(vv('or-parte'), 10) >= 0 ? parseInt(vv('or-parte'), 10) : -1); },
  'or-parla': () => { if (V.or) { V.or.trascr = ((document.getElementById('or-testo') || {}).value || V.or.trascr || '').trim(); orAvviaRec(); } return 'async'; },
  'or-fine': () => { const o = V.or; if (!o) return 'async'; o.fermo = true; try { if (V.rec) V.rec.stop(); } catch (e) { /* già fermo */ } setTimeout(orChiudiAscolto, 1500); return 'async'; },
  'or-annulla': () => { const o = V.or; if (!o) return; o.fermo = true; try { if (V.rec) V.rec.abort(); } catch (e) { /* già fermo */ } V.rec = null; o.trascr = ''; o.fase = 'pronto'; },
  'or-scrivi': () => { if (V.or) { fermaVoce(); V.or.fase = 'rivedi'; } },
  'or-cancella': () => { if (V.or) { V.or.trascr = ''; V.or.fase = 'pronto'; } },
  'or-invia': () => { const c = S.capitoli.find(x => x.id === V.cap); if (c && V.or) orInvia(c); return 'async'; },
  'or-riascolta': () => { const o = V.or; if (!o) return 'async'; const u = o.turni[o.turni.length - 1]; if (u) parlaCb(plain(u.testo)); return 'async'; },
  'or-concludi': () => { const c = S.capitoli.find(x => x.id === V.cap); if (c && V.or) { fermaVoce(); orFinisci(c); } },
  'or-ancora': () => { V.or = null; },
  'or-voce': () => { if (V.or) { V.or.voce = !V.or.voce; if (!V.or.voce) fermaVoce(); } return 'async'; },
  'co-controlla': async el => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return 'async';
    salvaBozzeCo(c); const i = +el.dataset.i, s = mioDi(c).sez[i]; if (!s) return 'async';
    if (s.testo.trim().length < 12) { toast(t('co_scrivi')); return 'async'; }
    V.busy = true; render();
    try {
      let r;
      if (FAM.ai.provider === 'demo') r = coDemo(c, i, s);
      else r = await chiediJSON(SYS_CO + '\n\n' + profiloTesto(), 'Materia: ' + c.materia + '\nParagrafo: ' + s.t + '\n\nTesto di riferimento (RISERVATO):\n' + (testoSezione(c, i) || c.riassunto_completo) + '\n\nParole chiave dello studente: ' + (s.k || '(nessuna)') + '\n\nRiassunto dello studente:\n' + s.testo, [], SCHEMA_CO);
      s.n++; s.fb = normMio({ sez: [{ t: s.t, fb: r }] }).sez[0].fb;
      if (s.fb.esito === 'completo' && !s.ok) { s.ok = true; premi().xp += 5; const m = mioDi(c); if (m.sez.every(x => x.ok) && !premi().badge.includes('autore')) { premi().badge.push('autore'); toast('🏅 ' + t('nuovo_badge', { b: t('badge_autore') })); } }
      salva();
    } catch (e) { toast(e.message === 'NODEMO' ? t('serve_chiave_ai') : e.message); }
    V.busy = false; render(); return 'async';
  },
  'co-aiuto': el => { const c = S.capitoli.find(x => x.id === V.cap); if (c) salvaBozzeCo(c); V.coAiuto = V.coAiuto || {}; V.coAiuto[+el.dataset.i] = true; },
  'co-ok': el => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return; salvaBozzeCo(c); const s = mioDi(c).sez[+el.dataset.i]; if (s) { s.ok = true; const m = mioDi(c); if (m.sez.every(x => x.ok) && !premi().badge.includes('autore')) { premi().badge.push('autore'); toast('🏅 ' + t('nuovo_badge', { b: t('badge_autore') })); } salva(); } },
  'co-stampa': () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async'; salvaBozzeCo(c);
    document.getElementById('stampa').innerHTML = '<section><h1>' + esc(c.titolo) + '</h1><p class="meta">' + esc(c.materia) + ' · ' + t('co_finale') + '</p>' + mioDi(c).sez.filter(s => s.testo.trim()).map(s => '<h3>' + esc(s.t) + '</h3><p>' + esc(s.testo).replace(/\n/g, '<br>') + '</p>').join('') + '</section>';
    const tt = document.title; document.title = c.titolo; try { window.print(); } catch (e) { toast('La stampa non è disponibile.'); } document.title = tt; return 'async';
  },
  'pratica-indizio': el => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return; salvaBozzePratica(c); const e = arr(c.pratica)[+el.dataset.i]; if (e && e.ind < e.indizi.length) { e.ind++; salva(); } },
  'pratica-controlla': async el => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return 'async';
    const i = +el.dataset.i, e = arr(c.pratica)[i]; if (!e) return 'async'; salvaBozzePratica(c);
    const ris = (V.prBozza[i] || '').trim(); if (!ris) { toast(t('pr_scrivi')); return 'async'; }
    V.busy = true; render();
    try {
      let r;
      if (FAM.ai.provider === 'demo') r = ris.length > 12 ? { esito: 'giusto', feedback: 'Ben ragionato!' } : { esito: 'quasi', feedback: 'Ci sei vicino: prova a spiegare anche il perché.' };
      else r = await chiediJSON(SYS_VALUTA_PRATICA + '\n\n' + profiloTesto(), 'Esercizio: ' + e.testo + '\nSoluzione (riservata): ' + e.soluzione + '\nRisposta dello studente: ' + ris, [], SCHEMA_VALUTA);
      V.prFb = V.prFb || {}; e.tent++;
      if (r.esito === 'giusto') {
        if (!e.ok) { e.ok = true; const P = premi(); P.pratica++; P.xp += 3; if (P.pratica >= 5 && !P.badge.includes('allenato')) { P.badge.push('allenato'); toast('🏅 ' + t('nuovo_badge', { b: t('badge_allenato') })); } }
        V.prFb[i] = { tipo: 'ok', testo: r.feedback || 'Giusto!' };
      } else V.prFb[i] = { tipo: 'warn', testo: r.feedback || 'Quasi: riprova.' };
      salva();
    } catch (err) { toast(err.message); }
    V.busy = false; render(); return 'async';
  },
  'aspetto-consigliato': () => { if (V.vista !== 'aspetto' || !S.profilo) return 'async'; const p = S.profilo, r = aspettoConsigliato(p.livello, p.dsa); Object.assign(p, { font: r.font, fs: r.fs, lh: r.lh, ls: r.ls, ws: r.ws, tema: r.tema, auto: true }); salva(); },
  'rispondi': el => {
    const ts = V.test; if (!ts || ts.scelta != null) return;
    const c = capCorrente(); const ix = ts.dom[ts.i]; const q = c.test[ix]; const corr = q.tipo === 'vf' ? (q.corretta ? 0 : 1) : q.corretta;
    ts.scelta = +el.dataset.i; const ok = ts.scelta === corr; if (ok) ts.punti++; else ts.errati.push(ix);
    const mp = c._map ? c._map[ix] : [c.id, ix]; ripAggiorna(mp[0], mp[1], ok); salva();
  },
  'avanti': () => {
    const ts = V.test; if (!ts) return; const c = capCorrente(); ts.scelta = null; ts.i++;
    if (ts.i >= ts.dom.length) { ts.fine = true; assegnaPremi(c, ts); if (!ts.ripasso && c.id !== '__rip') { c.risultati.push({ data: new Date().toISOString(), punti: ts.punti, totale: ts.dom.length, errati: [...new Set(ts.errati.map(i => c.test[i].argomento).filter(Boolean))], come: Array.isArray(ts.come) ? ts.come.slice() : null }); salva(); } }
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
  'apri-cap-di': el => { if (attiva(el.dataset.f)) { V.cap = el.dataset.id; V.genVede = true; V.tab = 'riassunto'; V.vista = 'capitolo'; } },
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
  'priv-apri': () => { V.privBack = V.vista; if (V.vista === 'fam') { try { V.bozzaFam = Object.assign({}, V.bozzaFam || {}, { dsaAI: !!document.getElementById('dsa-ai').checked, lingua: document.getElementById('lingua-gen').value }); } catch (e) {} } V.vista = 'privacy'; },
  'priv-indietro': () => { V.vista = V.privBack || (FAM.pin ? 'genitori' : 'fam'); V.privBack = null; },
  'salva-fam': async () => {
    const pin = document.getElementById('pin').value.trim();
    if (!FAM.pin) { const ok = document.getElementById('priv-ok'); if (ok && !ok.checked) { toast(t('priv_obbl')); return 'async'; } }
    if (pin || !FAM.pin) {
      if (!/^\d{4,8}$/.test(pin)) { toast(t('pin_cifre')); return 'async'; }
      if (pinBanale(pin)) { toast(t('pin_debole')); return 'async'; }
    }
    const ai = leggiAi();
    if (ai.provider === 'compat' && !urlConsentito(ai.url)) { toast(t('url_no')); return 'async'; }
    if (ai.key) { ai.kc = await cifra(ai.key); ai.key = ''; }
    else { ai.kc = FAM.ai.kc || ''; ai.key = ''; if (FAM.ai.key) ai.kc = await cifra(FAM.ai.key); }
    FAM.ai = ai; FAM.dsaAI = !!document.getElementById('dsa-ai').checked; const l = document.getElementById('lingua-gen').value; FAM.lingua = LINGUE[l] ? l : 'it';
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
    const livello = LIVELLI.includes(document.getElementById('livello').value) ? document.getElementById('livello').value : 'superiori';
    const lg2 = document.getElementById('lingua-fig').value;
    const rm = document.getElementById('rmpin');
    const sezioni = {}; SEZ.forEach(k => { const e = document.querySelector('[data-sez="' + k + '"]'); sezioni[k] = e ? e.checked : true; });
    const metodo = {}; ['chiedi', 'confronto', 'esperimento'].forEach(k => { const e = document.getElementById('met-' + k); metodo[k] = e ? e.checked : true; });
    const prof = { nome: nome, sezioni: sezioni, metodo: metodo, livello: livello, lingua: LINGUE[lg2] ? lg2 : 'it', dsa: dsa, tema: temaValido({ livello: livello, tema: (document.querySelector('input[name=tema]:checked') || {}).value }), colori: document.getElementById('colori').checked, fs: num('fs', 1), font: g('font') || 'tema', lh: num('lh', 0), ls: num('ls', 0), ws: num('ws', 0), vel: num('vel', 0.9), voce: g('voce'), pin: pinf ? await hashPin(pinf) : (rm && rm.checked ? '' : (old.pin || '')) };
    { const rec = aspettoConsigliato(livello, dsa); prof.auto = prof.font === rec.font && Math.abs(prof.fs - rec.fs) < 0.01 && Math.abs(prof.lh - rec.lh) < 0.01 && Math.abs(prof.ls - rec.ls) < 0.005 && Math.abs(prof.ws - rec.ws) < 0.005; }
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
const SYS_CONTROLLO = `Sei AI.st.ain, un tutor che guida il ragionamento. Ricevi la foto dello svolgimento che uno studente ha scritto a mano (e, se c'è, il testo dell'esercizio).
Leggi con attenzione ogni passaggio. Per matematica e fisica rifai i calcoli per te stesso; per latino e greco controlla l'analisi (verbo, soggetto, casi, complementi, costruzione) senza tradurre al posto dello studente.
Regole IMPORTANTI:
- NON scrivere MAI il risultato corretto, la soluzione, il testo corretto o la traduzione. Non riscrivere i passaggi sbagliati nella forma giusta.
- Per ogni passaggio dello studente indica se è "ok", "da_controllare" o "errore". Se c'è un errore, di' DOVE si trova (quale passaggio o riga) e di che TIPO è (segno, regola applicata male, unità di misura, calcolo, concordanza, caso...) e scrivi un suggerimento sotto forma di domanda guida, per esempio "Che cosa succede al segno quando sposti il termine dall'altra parte?".
- Se tutto è giusto, dillo con calore e, se utile, suggerisci di verificare con un metodo diverso (per esempio la prova).
- Se la scrittura non si legge, dillo nel riepilogo e chiedi una foto più chiara: non inventare.
- "domanda_guida": una sola domanda che aiuti lo studente a trovare da solo il primo errore (vuota se non ci sono errori).
Tono incoraggiante, frasi brevi.`;
const SCHEMA_CONTROLLO = OBJ({ riepilogo: T, passi: { type: 'array', description: 'Un elemento per ogni passaggio scritto dallo studente, nell\'ordine', items: OBJ({ cosa_hai_fatto: T, esito: { type: 'string', enum: ['ok', 'da_controllare', 'errore'] }, suggerimento: T }) }, domanda_guida: T });
const DEMO_CONTROLLO = { riepilogo: 'Esempio: in modalità demo AI.st.ain non legge la tua foto. Con la chiave AI controlla davvero i tuoi passaggi, senza mai darti la soluzione.', passi: [{ cosa_hai_fatto: 'Passaggio 1 (esempio)', esito: 'ok', suggerimento: '' }, { cosa_hai_fatto: 'Passaggio 2 (esempio)', esito: 'errore', suggerimento: 'Guarda il segno: che cosa succede quando cambi lato?' }], domanda_guida: 'Che operazione devi fare su entrambi i lati per mantenere l\'uguaglianza?' };
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
    const txt = await chiamaAI('Sei AI.st.ain. Scrivi in ' + nome + ' un testo di 8-10 righe per un genitore che non conosce bene l\'italiano: di cosa parla il capitolo, i 5 concetti principali (con il termine italiano tra parentesi) e come aiutare il figlio a ripassare. Linguaggio semplice, solo testo, nessun titolo, nessun elenco numerato.', 'Titolo: ' + c.titolo + '\nMateria: ' + c.materia + '\nRiassunto breve:\n- ' + c.riassunto_breve.map(plain).join('\n- ') + '\n\nRiassunto completo:\n' + plain(c.riassunto_completo).slice(0, 7000), []);
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
    const k = el.dataset.pref; S.profilo[k] = (k === 'font' || k === 'tema' || k === 'voce') ? el.value : parseFloat(el.value);
    if (['font', 'fs', 'lh', 'ls', 'ws'].includes(k)) S.profilo.auto = false;
    salva(); applicaTema();
  }
  anteprima();
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'mp-sel') { V.mSel = e.target.value; rinfresca(); } });
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

/* ===== v0.23: tutorial guidato con frecce, questionario DSA, rifiniture grafiche ===== */
const TOUR_PASSI = {
  home: [['.bar .brand', 'tour_brand'], ['.bar [data-act=fs-]', 'tour_testo'], ['.bar [data-act=aspetto]', 'tour_aspetto'], ['.add-mat', 'tour_addmat'], ['.mat-grid .mat', 'tour_mat'], ['.bar [data-act=genitori]', 'tour_gen'], ['.bar [data-act=tour]', 'tour_ancora']],
  materia: [['[data-act=nuovo-cap]', 'tour_nuovocap'], ['[data-act=nuovo-es]', 'tour_nuovoes'], ['[data-act=nuovo-controllo]', 'tour_controllo'], ['.bar [data-act=tour]', 'tour_ancora']],
  capitolo: [['.tabs', 'tour_tabs'], ['[data-act=ascolta]', 'tour_ascolta'], ['.bar [data-act=tour]', 'tour_ancora']],
  genitori: [['[data-act=aggiungi-figlio]', 'tour_figlio'], ['[data-act=modifica-fam]', 'tour_fam'], ['[data-act=priv-apri]', 'tour_priv'], ['[data-act=esporta]', 'tour_backup'], ['.bar [data-act=tour]', 'tour_ancora']]
};
function tourChiave(k) { return (k === 'genitori' ? 'fam' : (S.id || 'x')) + ':' + k; }
function tourLetti() { try { return JSON.parse(localStorage.getItem('scio.tour') || '{}') || {}; } catch (e) { return {}; } }
function tourSegna(k) { try { const o = tourLetti(); o[tourChiave(k)] = 1; localStorage.setItem('scio.tour', JSON.stringify(o)); } catch (e) { /* senza memoria locale la guida si ripropone: nessun danno */ } }
function tourVistaCorrente() { return V.vista === 'home' ? 'home' : V.vista === 'materia' ? 'materia' : V.vista === 'capitolo' ? 'capitolo' : (V.vista === 'genitori' && V.genitoriOk && FAM.pin) ? 'genitori' : null; }
function tourAuto() {
  if (navigator.webdriver || V.mFull || document.getElementById('tour') || document.getElementById('dsaq') || V.busy) return;
  const k = tourVistaCorrente(); if (!k || tourLetti()[tourChiave(k)]) return;
  const vista = V.vista;
  setTimeout(() => { if (V.vista === vista && !V.busy && !document.getElementById('tour') && !document.getElementById('dsaq')) tourAvvia(k); }, 800);
}
function tourChiudi() {
  const o = document.getElementById('tour'); if (!o) return;
  window.removeEventListener('resize', o._ri); document.removeEventListener('keydown', o._kd, true);
  const f = o._focus; o.remove(); if (!document.getElementById('dsaq')) bloccaScroll(false); try { if (f && f.focus) f.focus(); } catch (e) { /* nulla */ }
}
function tourAvvia(k) {
  const passi = (TOUR_PASSI[k] || []).filter(p => document.querySelector(p[0]));
  if (!passi.length) return;
  tourSegna(k); tourChiudi();
  const ov = document.createElement('div'); ov.id = 'tour'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', t('tour_titolo'));
  ov._focus = document.activeElement;
  ov.innerHTML = '<div class="tour-spot"></div><svg class="tour-arrow" aria-hidden="true"><defs><marker id="tour-p" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#fff"/></marker></defs><path d="" marker-end="url(#tour-p)"/></svg>' +
    '<div class="tour-box" tabindex="-1" aria-live="polite"><div class="tour-n muted"></div><p class="tour-t"></p><div class="row tour-btns"><button class="btn sec small" data-tour="salta"></button><button class="btn sec small" data-tour="indietro"></button><button class="btn small" data-tour="avanti"></button></div></div>';
  document.body.appendChild(ov); bloccaScroll(true);
  ov.addEventListener('wheel', e => e.preventDefault(), { passive: false }); ov.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  let i = 0;
  const box = ov.querySelector('.tour-box'), spot = ov.querySelector('.tour-spot'), path = ov.querySelector('svg > path');
  const pos = (scroll) => {
    const el = document.querySelector(passi[i][0]); if (!el) { if (i < passi.length - 1) { i++; pos(true); } else tourChiudi(); return; }
    if (scroll) el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, pad = 6;
    Object.assign(spot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + 2 * pad) + 'px', height: (r.height + 2 * pad) + 'px' });
    ov.querySelector('.tour-n').textContent = t('tour_n', { i: i + 1, n: passi.length });
    ov.querySelector('.tour-t').textContent = t(passi[i][1]);
    ov.querySelector('[data-tour=salta]').textContent = t('tour_salta'); ov.querySelector('[data-tour=indietro]').textContent = t('tour_indietro'); ov.querySelector('[data-tour=indietro]').hidden = i === 0;
    ov.querySelector('[data-tour=avanti]').textContent = i === passi.length - 1 ? t('tour_fine') : t('tour_avanti');
    const bw = Math.min(340, vw - 24); box.style.width = bw + 'px';
    const bh = box.offsetHeight, sotto = vh - r.bottom, sopra = r.top, gap = 58;
    let top, dir;
    if (sotto >= bh + gap + 8) { top = r.bottom + pad + gap; dir = 'su'; } else if (sopra >= bh + gap + 8) { top = r.top - pad - gap - bh; dir = 'giu'; } else { top = vh - bh - 12; dir = r.top + r.height / 2 < vh / 2 ? 'su' : 'giu'; if (top < r.bottom && r.bottom > vh / 2) top = 12; }
    top = Math.max(8, Math.min(vh - bh - 8, top));
    const left = Math.max(12, Math.min(vw - bw - 12, r.left + r.width / 2 - bw / 2));
    box.style.left = left + 'px'; box.style.top = top + 'px';
    const bx = Math.max(left + 24, Math.min(left + bw - 24, r.left + r.width / 2)), by = dir === 'su' ? top : top + bh;
    const tx = Math.max(r.left + 4, Math.min(r.right - 4, r.left + r.width / 2)), ty = dir === 'su' ? r.bottom + pad + 3 : r.top - pad - 3;
    const cx = (bx + tx) / 2 + (bx < tx ? -34 : 34), cy = (by + ty) / 2;
    path.setAttribute('d', 'M' + bx + ' ' + by + ' Q' + cx + ' ' + cy + ' ' + tx + ' ' + ty);
  };
  ov._ri = () => pos(false); window.addEventListener('resize', ov._ri);
  const avanti = () => { if (i < passi.length - 1) { i++; pos(true); } else tourChiudi(); };
  ov._kd = e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key) || (e.key === ' ' && !(e.target && e.target.closest && e.target.closest('button')))) e.preventDefault();
    if (e.key === 'Escape') { e.stopPropagation(); tourChiudi(); } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target.dataset && e.target.dataset.tour))) { e.preventDefault(); avanti(); } else if (e.key === 'ArrowLeft' && i > 0) { i--; pos(true); } };
  document.addEventListener('keydown', ov._kd, true);
  ov.addEventListener('click', e => { const b = e.target.closest('[data-tour]'); if (!b) return; if (b.dataset.tour === 'salta') tourChiudi(); else if (b.dataset.tour === 'indietro') { if (i > 0) { i--; pos(true); } } else avanti(); });
  pos(true); const ab = ov.querySelector('[data-tour=avanti]'); if (ab) ab.focus({ preventScroll: true });
}
AZ['tour'] = () => { const k = tourVistaCorrente(); if (!k) { toast(t('tour_altrove')); return 'async'; } tourAvvia(k); return 'async'; };

/* ===== Questionario sui segnali di DSA (NON è una diagnosi; le risposte non vengono salvate né inviate) ===== */
const DSA_Q = [['dislessia', 6], ['disortografia', 6], ['disgrafia', 6], ['discalculia', 6]];
function dsaqChiudi() { const o = document.getElementById('dsaq'); if (!o) return; document.removeEventListener('keydown', o._kd, true); const f = o._focus; o.remove(); if (!document.getElementById('tour')) bloccaScroll(false); try { if (f && f.focus) f.focus(); } catch (e) { /* nulla */ } }
function dsaq() {
  dsaqChiudi(); tourChiudi();
  const ov = document.createElement('div'); ov.id = 'dsaq'; ov.className = 'dsaq'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', t('dsaq_titolo'));
  ov._focus = document.activeElement;
  const liv = (document.getElementById('livello') || {}).value || (S.profilo && S.profilo.livello) || '';
  const ris = {}; let p = -1;   /* -1 introduzione, 0..3 aree, 4 risultato */
  const box = document.createElement('div'); box.className = 'dsaq-box'; ov.appendChild(box); document.body.appendChild(ov); bloccaScroll(true);
  const punti = a => { let s = 0; for (let n = 1; n <= 6; n++) s += ris[a + n] || 0; return s; };
  const livello = s => s >= 8 ? 2 : s >= 5 ? 1 : 0;
  const disegna = () => {
    let h = '';
    if (p === -1) {
      h = '<h2>' + t('dsaq_titolo') + '</h2><div class="fb warn"><b>' + t('dsaq_non_diag') + '</b></div><p>' + t('dsaq_intro') + '</p><p class="muted">' + t('dsaq_priv') + '</p><div class="row"><button class="btn" data-q="avanti">' + t('dsaq_inizia') + '</button><button class="btn sec" data-q="chiudi">' + t('dsaq_chiudi') + '</button></div>';
    } else if (p < DSA_Q.length) {
      const a = DSA_Q[p][0];
      h = '<div class="dsaq-prog" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="' + p + '"><span style="width:' + (p * 25) + '%"></span></div><p class="muted">' + t('dsaq_pag', { i: p + 1, n: DSA_Q.length }) + '</p><h2>' + t(a) + '</h2><p class="muted">' + t('dsaq_scala') + '</p>';
      for (let n = 1; n <= 6; n++) {
        h += '<fieldset class="dq"><legend>' + t('dq_' + a + '_' + n) + '</legend><div class="opts">' + [[0, 'dsaq_mai'], [1, 'dsaq_volte'], [2, 'dsaq_spesso']].map(o => '<label><input type="radio" name="' + a + n + '" value="' + o[0] + '"' + (ris[a + n] === o[0] ? ' checked' : '') + '><span>' + t(o[1]) + '</span></label>').join('') + '</div></fieldset>';
      }
      h += '<p class="muted" id="dsaq-msg" role="status"></p><div class="row"><button class="btn sec" data-q="indietro">' + t('dsaq_indietro') + '</button><button class="btn" data-q="avanti">' + (p === DSA_Q.length - 1 ? t('dsaq_fine') : t('dsaq_avanti')) + '</button></div>';
    } else {
      const liste = DSA_Q.map(a => [a[0], livello(punti(a[0]))]), alcuni = liste.filter(x => x[1] > 0);
      h = '<h2>' + t('dsaq_risultato') + '</h2><div class="fb warn"><b>' + t('dsaq_non_diag') + '</b></div>' + liste.map(x => '<div class="card"><div class="row" style="justify-content:space-between"><b>' + t(x[0]) + '</b><span class="chip ' + (x[1] === 0 ? 'ok' : 'warn') + '">' + t('dsaq_res_' + x[1]) + '</span></div></div>').join('') +
        '<p>' + (alcuni.length ? t('dsaq_esito_si') : t('dsaq_esito_ok')) + '</p>' + (liv === 'elementari' && alcuni.length ? '<p class="muted">' + t('dsaq_piccoli') + '</p>' : '') + '<p class="muted">' + t('dsaq_altre_cause') + '</p>' +
        '<div class="row">' + (alcuni.length && document.querySelector('[data-dsa]') ? '<button class="btn" data-q="attiva">' + t('dsaq_attiva') + '</button>' : '') + '<button class="btn sec" data-q="chiudi">' + t('dsaq_chiudi') + '</button></div>';
      box._liste = alcuni.map(x => x[0]);
    }
    box.innerHTML = h; box.scrollTop = 0;
    const f = box.querySelector('button.btn:not(.sec)') || box.querySelector('button'); if (f) f.focus({ preventScroll: true }); box.scrollTop = 0;
  };
  const leggi = () => { box.querySelectorAll('input[type=radio]:checked').forEach(x => { ris[x.name] = +x.value; }); };
  box.addEventListener('change', leggi);
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return; const q = b.dataset.q;
    if (q === 'chiudi') dsaqChiudi();
    else if (q === 'indietro') { leggi(); p = Math.max(-1, p - 1); disegna(); }
    else if (q === 'avanti') {
      if (p >= 0) { leggi(); const a = DSA_Q[p][0]; if ([1, 2, 3, 4, 5, 6].some(n => ris[a + n] === undefined)) { const m = box.querySelector('#dsaq-msg'); if (m) m.textContent = t('dsaq_tutte'); return; } }
      p++; disegna();
    } else if (q === 'attiva') {
      (box._liste || []).forEach(k => { const c = document.querySelector('[data-dsa=' + k + ']'); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
      dsaqChiudi(); toast(t('dsaq_attivati'));
    }
  });
  ov._kd = e => { if (e.key === 'Escape') { e.stopPropagation(); dsaqChiudi(); } };
  document.addEventListener('keydown', ov._kd, true);
  disegna();
}
AZ['dsa-quiz'] = () => { dsaq(); return 'async'; };
function quizPromo(compatto) {
  return '<div class="card promo"><h2>' + t('dsaq_promo_t') + '</h2><p class="muted">' + t('dsaq_promo') + '</p><button class="btn' + (compatto ? ' sec' : '') + '" type="button" data-act="dsa-quiz">' + t('dsaq_promo_btn') + '</button></div>';
}

/* Icone delle materie e animazione d'ingresso delle pagine */
const EMOJI_MAT = { italiano: '📖', storia: '🏛️', geografia: '🌍', scienze: '🔬', matematica: '➗', fisica: '⚛️', chimica: '🧪', biologia: '🧬', inglese: '🔤', latino: '🏺', greco: '🦉', filosofia: '💭', 'scienze umane': '🧠', arte: '🎨', tecnologia: '⚙️', musica: '🎵', 'educazione civica': '⚖️', religione: '🕊️', altro: '📌' };
function iconaMateria(m) {
  const k = String(m || '').trim().toLowerCase(); let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360;
  return '<span class="mat-ico" style="--h:' + h + '" aria-hidden="true">' + (EMOJI_MAT[k] || '📘') + '</span>';
}
(function () {
  const render0 = render; let ultima = '';
  render = function () {
    render0();
    const chiave = V.vista + '|' + (V.cap || '') + '|' + (V.materia || '') + '|' + (S.id || '');
    const app = document.getElementById('app');
    if (chiave !== ultima && app) { ultima = chiave; app.classList.remove('entra'); void app.offsetWidth; app.classList.add('entra'); setTimeout(() => app.classList.remove('entra'), 700); }
    if (V.vista === 'capitolo' && !V.mFull && METODI_TAB.includes(V.tab)) segnaUso(S.capitoli.find(x => x.id === V.cap), V.tab);
    if (V.come && (V.vista !== 'capitolo' || V.tab !== 'test')) V.come = null;
    tourAuto();
  };
})();

document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && V.mFull) { V.mFull = false; V.mzFit = true; render(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && V.mFull && !document.getElementById('tour') && !document.getElementById('dsaq')) { V.mFull = false; V.mzFit = true; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (x) { /* nulla */ } render(); } });
window.addEventListener('resize', () => { if (V.mFull && document.querySelector('.mappa-wrap')) { fitMappa(); } });
/* ===== v0.26: aiuto (facoltativo) per trovare il proprio metodo di studio ===== */
const METODI_TAB = ['riassunto', 'schema', 'mappa', 'spiegazioni', 'glossario', 'costruisci', 'pratica', 'orale'];
const ucf = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
function metodoOn(k) { const m = S.profilo && S.profilo.metodo; return !m || m[k] !== false; }   /* k: chiedi | confronto | esperimento */
function metodoDispo(k) { return !METODI_TAB.includes(k) || tabsAttive().includes(k); }
function segnaUso(c, k) { if (!c) return; if (!c.uso) c.uso = {}; if (!c.uso[k]) { c.uso[k] = 1; salva(); } }
function cardCome() {
  const c = S.capitoli.find(x => x.id === V.come.cap) || { uso: {} };
  return '<div class="card promo"><h2>' + t('come_t') + '</h2><p class="muted">' + t('come_nota') + '</p>' +
    METODI.filter(metodoDispo).map(k => '<label class="chk"><input type="checkbox" data-come="' + k + '"' + (V.come.sel.includes(k) ? ' checked' : '') + '>' + esc(ucf(t('met_' + k))) + '</label>').join('') +
    '<div class="row"><button class="btn" data-act="come-ok">' + t('come_ok') + '</button><button class="btn sec" data-act="come-salta">' + t('come_salta') + '</button></div></div>';
}
function analisiMetodo() {
  const R = [];
  S.capitoli.forEach(c => arr(c.risultati).forEach(r => { if (Array.isArray(r.come)) R.push({ data: r.data, pct: r.punti / Math.max(1, r.totale), come: r.come }); }));
  R.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const media = l => l.length ? Math.round(100 * l.reduce((s, x) => s + x.pct, 0) / l.length) : null;
  const per = METODI.map(k => { const con = R.filter(r => r.come.includes(k)), senza = R.filter(r => !r.come.includes(k)); return { k, nc: con.length, ns: senza.length, mc: media(con), ms: media(senza) }; })
    .filter(x => x.nc >= 2 && x.ns >= 2).map(x => Object.assign(x, { d: x.mc - x.ms })).sort((a, b) => b.d - a.d);
  return { R, n: R.length, tot: media(R), per };
}
function proponiEsperimento(A) {
  const ultimi = A.R.slice(-2), ultimo = A.R.slice(-1);
  const usatoUltimo = k => ultimo.some(r => r.come.includes(k)), usatoDue = k => ultimi.some(r => r.come.includes(k));
  const buono = A.per.filter(x => x.d >= 8 && metodoDispo(x.k) && !usatoUltimo(x.k))[0];
  if (buono) return buono.k;
  return ['pratica', 'orale', 'costruisci', 'mappa', 'spiegazioni'].filter(k => metodoDispo(k) && !usatoDue(k))[0] || null;
}
function cardMetodo() {
  if (!metodoOn('confronto') && !metodoOn('esperimento')) return '';
  const A = analisiMetodo(); if (!A.n) return '';
  let h = '<div class="card"><h2>🧭 ' + t('met_titolo') + '</h2>';
  if (metodoOn('confronto')) {
    if (!A.per.length) h += '<p class="muted">' + t('met_pochi', { n: A.n }) + '</p>';
    else {
      const top = A.per.filter(x => x.d >= 8).slice(0, 3);
      h += top.length ? '<ul>' + top.map(x => '<li>' + esc(t('met_riga', { m: t('met_' + x.k), a: x.mc, na: x.nc, b: x.ms, nb: x.ns })) + '</li>').join('') + '</ul>' : '<p>' + t('met_nessuno') + '</p>';
      h += '<p class="muted">' + t('met_cautela') + '</p>';
    }
  }
  if (metodoOn('esperimento')) {
    if (S.esp) h += '<div class="fb">' + esc(t('esp_corso', { m: t('met_' + S.esp.m) })) + ' <button class="btn sec small" data-act="esp-annulla">' + t('esp_annulla') + '</button></div>';
    else if (A.n >= 2) { const m = proponiEsperimento(A); if (m) h += '<div class="fb"><b>' + t('esp_t') + '</b> ' + esc(t('esp_prop', { m: t('met_' + m) })) + '<p></p><button class="btn small" data-act="esp-accetta" data-m="' + m + '">' + t('esp_accetta') + '</button></div>'; }
  }
  return h + '</div>';
}
function espEsito(ts) {
  if (!S.esp || ts.espMsg) return;
  if (arr(ts.come).includes(S.esp.m)) { ts.espMsg = { m: S.esp.m, pct: Math.round(100 * ts.punti / Math.max(1, ts.dom.length)), base: S.esp.base }; S.esp = null; salva(); }
}
['inizia-test', 'inizia-voce'].forEach(a => {
  const orig = AZ[a];
  AZ[a] = el => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c) return orig(el);
    if (metodoOn('chiedi') && !V.comeOk) { V.come = { cap: c.id, az: a, sel: METODI.filter(k => c.uso && c.uso[k] && metodoDispo(k)) }; return; }
    const sel = V.comeOk ? V.comeSel : null; V.comeOk = false; V.comeSel = null; V.come = null;
    const r = orig(el); if (V.test && V.test.cap === c.id) V.test.come = sel; return r;
  };
});
{ const orig = AZ['test-livello']; AZ['test-livello'] = async el => { const prima = V.test && V.test.come; const r = await orig(el); if (V.test && !V.test.come) V.test.come = prima; return r; }; }
{ const orig = AZ.avanti; AZ.avanti = el => { const r = orig(el); const ts = V.test; if (ts && ts.fine && !ts.ripasso && ts.cap !== '__rip') { espEsito(ts); const c = S.capitoli.find(x => x.id === ts.cap); if (c && c.uso && Object.keys(c.uso).length && !ts.usoAzzerato) { ts.usoAzzerato = true; c.uso = {}; salva(); } } return r; }; }
{ const orig = AZ.ascolta; AZ.ascolta = el => { segnaUso(S.capitoli.find(x => x.id === V.cap), 'ascolto'); return orig(el); }; }
AZ['come-ok'] = () => { V.comeSel = [...document.querySelectorAll('[data-come]:checked')].map(x => x.dataset.come).filter(k => METODI.includes(k)); V.comeOk = true; return AZ[V.come.az](); };
AZ['come-salta'] = () => { V.comeSel = null; V.comeOk = true; return AZ[V.come.az](); };
AZ['esp-accetta'] = el => { const m = el.dataset.m; if (!METODI.includes(m)) return; const A = analisiMetodo(); S.esp = { m, dal: new Date().toISOString(), base: A.tot == null ? 0 : A.tot }; salva(); };
AZ['esp-annulla'] = () => { S.esp = null; salva(); };

/* Blocco dello scorrimento mentre la guida o il questionario sono aperti */
function bloccaScroll(on) { const r = document.documentElement; if (on) { r.style.scrollbarGutter = 'stable'; r.style.overflow = 'hidden'; } else { r.style.overflow = ''; r.style.scrollbarGutter = ''; } }
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
    r.addEventListener('updatefound', () => { const w = r.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nuova versione di AI.st.ain pronta: chiudi e riapri l\'app.'); }); });
  }).catch(() => {});
}
render();