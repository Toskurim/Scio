'use strict';
/* ===== Scio v0.6 — app web installabile (PWA) ===== */
/* Anti-clickjacking: Scio non si lascia incorniciare in altre pagine. */
if (window.top !== window.self) { document.documentElement.textContent = ''; throw new Error('Scio non può essere aperto dentro un\'altra pagina.'); }
const VERSIONE = '0.6';
const LS = 'scio.v0.2';
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
function lucchetto() { try { return JSON.parse(localStorage.getItem('scio.lock')) || { n: 0, fino: 0 }; } catch (e) { return { n: 0, fino: 0 }; } }
function lucchettoSalva(l) { try { localStorage.setItem('scio.lock', JSON.stringify(l)); } catch (e) {} }
/* Indirizzi AI consentiti: gli stessi ammessi dalla politica di sicurezza della pagina. */
function urlConsentito(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'http:') return x.hostname === 'localhost' || x.hostname === '127.0.0.1';
    return x.protocol === 'https:' && ['generativelanguage.googleapis.com', 'api.groq.com'].includes(x.hostname);
  } catch (e) { return false; }
}
/* Copia dei dati: mai chiave API né PIN dentro il file. */
function datiEsportabili() {
  const c = JSON.parse(JSON.stringify(S));
  if (c.profilo) { c.profilo.pin = ''; if (c.profilo.ai) { delete c.profilo.ai.key; delete c.profilo.ai.kc; } }
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
    if (typeof x === 'object') { const r = {}; Object.keys(x).slice(0, 120).forEach(k => { if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') r[k] = rip(x[k], d + 1); }); return r; }
    return null;
  };
  const p = rip(o, 0);
  if (!p || typeof p !== 'object' || !p.profilo || typeof p.profilo !== 'object') throw new Error('non valido');
  const A = x => Array.isArray(x) ? x : [];
  const T = (x, m) => (typeof x === 'string' ? x : x == null || typeof x === 'object' ? '' : String(x)).slice(0, m || MAXS);
  const N = x => (typeof x === 'number' && isFinite(x) ? x : 0);
  const ID = x => T(x, 40).replace(/[^A-Za-z0-9_-]/g, '') || uid();
  const L = (x, m) => A(x).map(v => T(v, m));
  const pr = p.profilo;
  const profilo = { nome: T(pr.nome, 60), livello: pr.livello === 'media' ? 'media' : 'superiori', dsa: {}, tema: TEMI[pr.tema] ? pr.tema : 'calmo', fs: (typeof pr.fs === 'number' && pr.fs >= 0.8 && pr.fs <= 2) ? pr.fs : 1, colori: !!pr.colori, pin: '', ai: { provider: 'demo', key: '', kc: '', model: '', preset: 'ollama', url: '' } };
  Object.keys(DSA).forEach(k => { if (pr.dsa && pr.dsa[k] === true) profilo.dsa[k] = true; });
  const capitoli = A(p.capitoli).filter(c => c && typeof c === 'object').slice(0, 500).map(c => ({
    id: ID(c.id), data: T(c.data, 40), materia: T(c.materia, 60), focus: T(c.focus, 300), titolo: T(c.titolo, 300), inventario: L(c.inventario, 500), avvisi: L(c.avvisi, 800),
    riassunto_breve: L(c.riassunto_breve, 1500), riassunto_completo: T(c.riassunto_completo),
    schema: { radice: T(c.schema && c.schema.radice, 300), rami: A(c.schema && c.schema.rami).filter(r => r && typeof r === 'object').map(r => ({ titolo: T(r.titolo, 300), punti: L(r.punti, 800) })) },
    spiegazioni: A(c.spiegazioni).filter(x => x && typeof x === 'object').map(x => ({ concetto: T(x.concetto, 300), spiegazione: T(x.spiegazione), esempio: T(x.esempio) })),
    glossario: A(c.glossario).filter(x => x && typeof x === 'object').map(x => ({ termine: T(x.termine, 300), definizione: T(x.definizione, 3000) })),
    test: A(c.test).filter(x => x && typeof x === 'object').map(x => ({ tipo: x.tipo === 'vf' ? 'vf' : 'scelta', argomento: T(x.argomento, 300), domanda: T(x.domanda, 2000), opzioni: L(x.opzioni, 800), corretta: typeof x.corretta === 'boolean' ? x.corretta : N(x.corretta), spiegazione: T(x.spiegazione, 3000) })),
    risultati: A(c.risultati).filter(x => x && typeof x === 'object').map(x => ({ data: T(x.data, 40), punti: N(x.punti), totale: N(x.totale) || 1, errati: L(x.errati, 300) }))
  }));
  const esercizi = A(p.esercizi).filter(e => e && typeof e === 'object').slice(0, 500).map(e => ({
    id: ID(e.id), data: T(e.data, 40), materia: T(e.materia, 60), richiesta: T(e.richiesta, 5000),
    passi: A(e.passi).filter(x => x && typeof x === 'object').map(x => ({ titolo: T(x.titolo, 300), domanda: T(x.domanda, 3000), obiettivo: T(x.obiettivo, 3000), indizi: L(x.indizi, 3000), esempio_simile: T(x.esempio_simile, 3000) })),
    i: N(e.i), indizi: N(e.indizi), indiziTotali: N(e.indiziTotali), fatti: A(e.fatti).filter(x => x && typeof x === 'object').map(x => ({ i: N(x.i), risposta: T(x.risposta, 3000) })), finito: !!e.finito
  }));
  return { profilo, capitoli, esercizi, materie: L(p.materie, 60).filter(m => m.trim()), ultimoBackup: T(p.ultimoBackup, 40) };
}

let S = caricaStato();
let V = { vista: S.profilo ? 'home' : 'setup', tab: 'riassunto', foto: [], busy: false, errore: '', test: null, es: null, bozza: '', cap: null, genitoriOk: false };

function caricaStato() {
  try { const r = JSON.parse(localStorage.getItem(LS) || localStorage.getItem(LS_VECCHIO)); if (r && typeof r === 'object') return Object.assign({ profilo: null, capitoli: [], esercizi: [] }, r); } catch (e) {}
  return { profilo: null, capitoli: [], esercizi: [] };
}
function salva() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { toast('Non riesco a salvare: lo spazio è pieno.'); } }
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
function applicaTema() {
  const p = S.profilo;
  document.body.setAttribute('data-tema', p && TEMI[p.tema] ? p.tema : 'calmo');
  document.documentElement.style.setProperty('--fs', p && p.fs ? p.fs : 1);
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
    '\nUsa un linguaggio adatto all\'età, sempre incoraggiante, mai giudicante.';
}
async function chiamaAI(system, testo, immagini, cfg, json) {
  const a = cfg || S.profilo.ai || {};
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
  test: { type: 'array', description: 'Esattamente 8 domande: 6 con tipo "scelta" (4 opzioni) e 2 con tipo "vf"', items: OBJ({ tipo: { type: 'string', enum: ['scelta', 'vf'] }, argomento: T, domanda: T, opzioni: Object.assign({ description: 'Solo per tipo scelta: 4 opzioni' }, LS_), corretta: { description: 'Per scelta: indice 0-3 dell\'opzione giusta. Per vf: true o false' }, spiegazione: T }, ['tipo', 'argomento', 'domanda', 'corretta', 'spiegazione']) }
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
const SYS_COMPLETA = `Sei Scio, un tutor di studio per ragazzi italiani. Ti viene dato il riassunto di un capitolo. Prepara le parti mancanti SOLO a partire da quel testo, senza inventare nulla che non sia nel riassunto: schema, spiegazioni, glossario e test, con le stesse regole del materiale di studio (italiano semplice, parole chiave con **doppio asterisco**, test di 8 domande: 6 a scelta e 2 vero/falso). Nei campi titolo, riassunto_breve e riassunto_completo ripeti il testo ricevuto.`;
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
(function () { let m = false; (S.capitoli || []).forEach(c => { if (riparaCapitolo(c)) m = true; }); if (m) salva(); })();
/* ===== Materie ===== */
function pl(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
function sameM(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }
function migraMaterie() {
  S.materie = arr(S.materie).filter(x => typeof x === 'string' && x.trim());
  arr(S.capitoli).concat(arr(S.esercizi)).forEach(x => { if (x.materia && !S.materie.some(m => sameM(m, x.materia))) S.materie.push(x.materia); });
}
function elementiMateria(m) { return { cap: S.capitoli.filter(c => sameM(c.materia, m)), es: S.esercizi.filter(e => sameM(e.materia, m)) }; }
migraMaterie();
(function () { const p = S.profilo; if (p && p.colori === undefined) { p.colori = !(p.dsa && p.dsa.dislessia); salva(); } })();
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
- Il test ha 8 domande: 6 a scelta multipla (4 opzioni, "corretta" è l'indice 0-3, varia la posizione) e 2 vero/falso. Le domande verificano la comprensione, non la memoria di dettagli. Le spiegazioni sono gentili e spiegano il perché.`;

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
  if (!V.foto.length && S.profilo.ai.provider !== 'demo') { toast('Aggiungi almeno una foto.'); return; }
  V.busy = true; V.errore = ''; render();
  try {
    let c;
    if (S.profilo.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 900)); c = JSON.parse(JSON.stringify(DEMO_CAP)); }
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
  if (!V.foto.length && S.profilo.ai.provider !== 'demo') { toast('Aggiungi la foto dell\'esercizio.'); return; }
  V.busy = true; V.errore = ''; render();
  try {
    let c;
    if (S.profilo.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 700)); c = JSON.parse(JSON.stringify(DEMO_ES)); }
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
    if (S.profilo.ai.provider === 'demo') { await new Promise(x => setTimeout(x, 500)); r = ris.length > 14 ? { esito: 'giusto', feedback: 'Ben ragionato! Passiamo al passo successivo.' } : { esito: 'quasi', feedback: 'Ci sei vicino. Prova a spiegarlo con una frase intera: cosa succede e perché?' }; }
    else { r = await chiediJSON(SYS_VALUTA + '\n\n' + profiloTesto(), 'Esercizio: ' + es.richiesta + '\nPasso: ' + p.titolo + '\nDomanda: ' + p.domanda + '\nObiettivo (riservato): ' + p.obiettivo + '\nRisposta dello studente: ' + ris, [], SCHEMA_VALUTA); }
    V.busy = false;
    if (r.esito === 'giusto') { es.fatti.push({ i: es.i, risposta: ris }); V.fb = { tipo: 'ok', testo: r.feedback || 'Giusto!' }; V.passoOk = true; }
    else { V.fb = { tipo: 'warn', testo: r.feedback || 'Quasi: riprova.' }; V.passoOk = false; }
    salva(); render();
  } catch (e) { V.busy = false; V.errore = e.message; render(); }
}

/* ===== Viste ===== */
function barra() {
  const p = S.profilo;
  return '<div class="bar">' + (p ? '<button class="brand" data-act="home" aria-label="Torna alla home di Scio">Scio<small>v' + VERSIONE + '</small></button>' : '<div class="brand">Scio<small>v' + VERSIONE + '</small></div>') + '<div class="row">' +
    (p ? '<button class="btn sec small" data-act="home">Studio</button><button class="btn sec small" data-act="fs-" aria-label="Testo più piccolo">A−</button><button class="btn sec small" data-act="fs+" aria-label="Testo più grande">A+</button><button class="btn sec small" data-act="genitori">Genitori</button>' : '') + '</div></div>';
}
function cardCap(c) {
  const ult = c.risultati[c.risultati.length - 1];
  return '<div class="card"><div class="row" style="justify-content:space-between"><div><b>' + esc(c.titolo) + '</b><div class="muted">' + esc(c.materia) + (c.focus ? ' · focus: ' + esc(c.focus) : '') + '</div></div>' +
    (ult ? '<span class="chip ' + (ult.punti / ult.totale >= .7 ? 'ok' : 'warn') + '">Test ' + ult.punti + '/' + ult.totale + '</span>' : '<span class="chip">Test da fare</span>') + '</div><p></p><button class="btn sec small" data-act="apri-cap" data-id="' + c.id + '">Apri</button></div>';
}
function cardEs(e) {
  return '<div class="card"><b>' + esc(e.materia) + '</b><div class="muted">' + esc(e.richiesta).slice(0, 90) + '</div><p></p><span class="chip ' + (e.finito ? 'ok' : '') + '">' + (e.finito ? 'Completato' : 'Passo ' + (e.i + 1) + ' di ' + e.passi.length) + '</span> <button class="btn sec small" data-act="apri-es" data-id="' + e.id + '">Apri</button></div>';
}
function boxSposta(item, tipo) {
  const altre = S.materie.filter(m => !sameM(m, item.materia));
  return '<div class="card"><h3>Sbagliata la materia?</h3>' + (altre.length ? '<div class="row"><select id="spostaM" aria-label="Materia di destinazione">' + altre.map(m => '<option>' + esc(m) + '</option>').join('') + '</select><button class="btn sec small" data-act="sposta" data-k="' + tipo + '" data-id="' + item.id + '">Sposta in questa materia</button></div>' : '<p class="muted">Crea prima un\'altra materia dalla home, poi potrai spostare qui il lavoro.</p>') +
    '<p></p><button class="btn sec small" data-act="elimina-' + tipo + '" data-id="' + item.id + '">Elimina questo lavoro</button></div>';
}
function vMateria() {
  const m = V.materia; if (!S.materie.some(x => sameM(x, m))) return vHome();
  const e = elementiMateria(m);
  return barra() + '<div class="card"><button class="btn sec small" data-act="home">‹ Tutte le materie</button><p></p><h1>' + esc(m) + '</h1></div>' +
    '<div class="row" style="margin-bottom:12px"><button class="btn" style="flex:1" data-act="nuovo-cap">Fotografa un capitolo</button><button class="btn sec" style="flex:1" data-act="nuovo-es">Ho un esercizio</button></div>' +
    '<h2>Capitoli</h2>' + (e.cap.length ? e.cap.map(cardCap).join('') : '<div class="card muted">Ancora nessun capitolo in questa materia.</div>') +
    (e.es.length ? '<h2>Esercizi</h2>' + e.es.map(cardEs).join('') : '') +
    '<div class="card"><button class="btn sec small" data-act="elimina-materia">Elimina questa materia</button></div>';
}
const DSA_INFO = {
  dislessia: ['Testi con frasi brevi (al massimo 15 parole), una sola idea per frase, parole semplici ed elenchi puntati.', 'Poche parole chiave evidenziate, con un solo colore.', 'Schema come formato principale, riassunto "in breve" prima di quello completo.', 'Lettura ad alta voce (pulsante Ascolta), testo ingrandibile (A− e A+) e caratteri ad alta leggibilità.'],
  disortografia: ['Nei test gli errori di scrittura non vengono penalizzati.', 'Se serve, Scio spiega la regola ortografica con un esempio, senza giudicare.', 'Evita domande che chiedono di scrivere parole difficili.'],
  disgrafia: ['Nei test preferisce risposte a scelta o molto brevi.', 'Poche domande a risposta scritta.'],
  discalculia: ['Spiegazioni di numeri e calcoli passo passo, un passaggio per volta, con esempi concreti prima delle formule.', 'Numeri piccoli negli esempi.', 'Nei test e negli esercizi conta il ragionamento, non la velocità né il calcolo a mente.', 'Negli esercizi Scio guida con domande e indizi a livelli, senza mai dare la soluzione.']
};
function infoDsa(k) { return '<b>Come lavorerà Scio</b><ul>' + DSA_INFO[k].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'; }
function vSetup() {
  const p = S.profilo || { nome: '', livello: 'superiori', dsa: {}, tema: 'calmo', fs: 1, ai: { provider: 'demo', key: '', model: '' }, pin: '' };
  const cons = consigliato(p.livello, p.dsa);
  return barra() + '<div class="card"><h1>Benvenuto in Scio</h1><p class="muted">Un aiuto per studiare: da foto di pagine a riassunti, schemi, spiegazioni e test. Prima di iniziare, serve un genitore.</p></div>' +
    '<div class="card"><h2>1. Chi studia?</h2><label class="f">Nome<input type="text" id="nome" value="' + esc(p.nome) + '" autocomplete="off"></label>' +
    '<label class="f">Livello<select id="livello"><option value="media"' + (p.livello === 'media' ? ' selected' : '') + '>Scuola media (11–13)</option><option value="superiori"' + (p.livello === 'superiori' ? ' selected' : '') + '>Scuola superiore (14–18)</option></select></label>' +
    '<p class="muted">Primaria e università arriveranno dopo.</p></div>' +
    '<div class="card"><h2>2. Come studia meglio</h2><p class="muted">Puoi scegliere più profili insieme.</p>' +
    Object.keys(DSA).map(k => '<label class="chk"><input type="checkbox" data-dsa="' + k + '"' + (p.dsa && p.dsa[k] ? ' checked' : '') + '>' + k.charAt(0).toUpperCase() + k.slice(1) + '</label><div class="dsainfo" id="info-' + k + '"' + (p.dsa && p.dsa[k] ? '' : ' hidden') + '>' + infoDsa(k) + '</div>').join('') +
    '<p class="muted">Sono istruzioni date all\'intelligenza artificiale: conviene controllare insieme al ragazzo se funzionano e, se possibile, con uno specialista. Scio non dà mai la soluzione degli esercizi.</p>' +
    '<label class="chk"><input type="checkbox" id="colori"' + (p.colori === undefined ? (p.dsa && p.dsa.dislessia ? '' : ' checked') : (p.colori ? ' checked' : '')) + '>Evidenzia con colori diversi nel riassunto (concetti, date e numeri, nomi)</label>' +
    '<p class="muted" id="notacolori">Con la dislessia il suggerimento è di tenere un solo colore, per non affaticare la lettura: per questo parte spento. Si può cambiare quando vuoi.</p></div>' +
    '<div class="card"><h2>3. Aspetto</h2><p class="muted" id="cons">Consigliato in base alle scelte: <b>' + TEMI[cons] + '</b>. Si può cambiare quando vuoi.</p>' +
    Object.keys(TEMI).map(k => '<label class="chk"><input type="radio" name="tema" value="' + k + '"' + (p.tema === k ? ' checked' : '') + '>' + TEMI[k] + '</label>').join('') + '</div>' +
    '<div class="card"><h2>4. Collegamento all\'AI</h2><label class="f">Servizio<select id="prov">' +
      [['demo', 'Modalità demo (nessuna chiave, esempi fissi)'], ['compat', 'PC di casa, Gemini o altro servizio compatibile OpenAI'], ['openrouter', 'OpenRouter (anche modelli gratuiti)'], ['anthropic', 'Claude (chiave Anthropic)']].map(o => '<option value="' + o[0] + '"' + (p.ai.provider === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
    '<div id="boxcompat"' + (p.ai.provider === 'compat' ? '' : ' hidden') + '><label class="f">Quale?<select id="preset">' + Object.keys(PRESET).map(k => '<option value="' + k + '"' + ((p.ai.preset || 'ollama') === k ? ' selected' : '') + '>' + PRESET[k].nome + '</option>').join('') + '</select></label>' +
    '<label class="f">Indirizzo del servizio (solo PC di casa, Gemini o Groq)<input type="text" id="url" value="' + esc(p.ai.url || PRESET.ollama.url) + '" autocomplete="off"></label></div>' +
    '<label class="f">Chiave API (se il servizio la richiede)<input type="password" id="chiave" value="" placeholder="' + (haChiave(p.ai) ? 'Chiave già salvata e cifrata: scrivi qui solo per cambiarla' : '') + '" autocomplete="off"></label>' + (haChiave(p.ai) ? '<button class="btn sec small" type="button" data-act="rimuovi-chiave">Rimuovi la chiave salvata</button>' : '') +
    '<label class="f">Modello (opzionale)<input type="text" id="modello" value="' + esc(p.ai.model) + '" placeholder="OpenRouter: google/gemini-2.5-flash · Claude: claude-haiku-5-5 · Ollama: gemma4:26b"></label>' +
    '<button class="btn sec" type="button" data-act="prova-ai">Prova il collegamento</button><p class="muted" id="esitoprova" role="status"></p>' +
    '<p class="muted">Il modello deve saper leggere le immagini. La chiave resta solo su questo dispositivo. Con il PC di casa le foto non escono dalla tua rete.</p>' +
    '<details><summary>Guida: usare il PC di casa</summary><p class="muted"><b>Ollama</b>: installalo, poi da terminale <code>ollama pull gemma4:26b</code> (serve una scheda video da circa 16 GB; con meno memoria prova un modello più piccolo). Per consentire a questa pagina di parlare con Ollama imposta la variabile <code>OLLAMA_ORIGINS=' + esc(location.origin.startsWith('http') ? location.origin : 'https://toskurim.github.io') + '</code> e riavvia Ollama. <b>LM Studio</b>: scarica un modello con visione, apri la scheda Developer, attiva il server e abilita CORS.<br>Questa strada funziona solo sul PC su cui gira Ollama o LM Studio: dal telefono o dal tablet usa una chiave online.</p></details></div>' +
    '<div class="card"><h2>5. PIN dei genitori</h2><label class="f">' + (p.pin ? 'Nuovo PIN (lascia vuoto per tenere quello attuale)' : 'Scegli un PIN di 4-8 cifre') + '<input type="password" id="pin" inputmode="numeric" maxlength="8" value="" autocomplete="off"></label><p class="muted">Il PIN non è salvato in chiaro. Evita numeri facili come 1234 o 0000.</p></div>' +
    '<button class="btn full" data-act="salva-setup">Salva e inizia</button>' + (S.profilo && S.profilo.pin ? '<p></p><button class="btn sec full" data-act="genitori">Annulla</button>' : '');
}
function vHome() {
  const p = S.profilo;
  const ultimi = S.capitoli.slice(0, 3);
  const mancanti = MATERIE.filter(m => m !== 'Altro' && !S.materie.some(x => sameM(x, m)));
  return barra() + (p.ai && p.ai.provider === 'demo' ? '<div class="fb warn" role="status"><b>Modalità demo.</b> Le foto non vengono lette: compaiono sempre gli stessi esempi. Per usare l\'AI vera: Genitori › Impostazioni › Collegamento all\'AI, scegli il servizio, incolla la chiave e premi "Salva e inizia".</div>' : '') +
    '<div class="card"><h1>Ciao ' + esc(p.nome) + '</h1><p class="muted">Scegli la materia da cui partire.</p></div>' +
    '<h2>Le tue materie</h2>' + (S.materie.length ? '<div class="mat-grid">' + S.materie.map(m => { const e = elementiMateria(m); return '<button class="mat" data-act="apri-materia" data-m="' + esc(m) + '"><b>' + esc(m) + '</b><span class="muted">' + pl(e.cap.length, 'capitolo', 'capitoli') + ' · ' + pl(e.es.length, 'esercizio', 'esercizi') + '</span></button>'; }).join('') + '</div>' : '<div class="card muted">Non c\'è ancora nessuna materia: aggiungine una qui sotto.</div>') +
    '<div class="card"><h3>Aggiungi una materia</h3>' + (mancanti.length ? '<div class="row" style="margin-bottom:8px">' + mancanti.map(m => '<button class="btn sec small" data-act="aggiungi-materia" data-m="' + esc(m) + '">+ ' + esc(m) + '</button>').join('') + '</div>' : '') +
    '<label class="f">Un\'altra materia<input type="text" id="nuovaM" maxlength="40" placeholder="Per esempio: Educazione civica" autocomplete="off"></label><button class="btn sec small" data-act="aggiungi-materia">Aggiungi</button></div>' +
    (ultimi.length ? '<h2>Continua da dove eri</h2>' + ultimi.map(cardCap).join('') : '');
}
function vNuovo(tipo) {
  const demo = S.profilo.ai.provider === 'demo';
  return barra() + '<div class="card"><h1>' + (tipo === 'cap' ? 'Nuovo capitolo' : 'Nuovo esercizio') + '</h1>' +
    (demo ? '<div class="fb">Sei in <b>modalità demo</b>: senza foto, Scio usa un esempio fisso per farti vedere come funziona.</div>' : '') +
    '<p><span class="muted">Materia:</span> <b>' + esc(V.materia) + '</b> <button class="btn sec small" data-act="home">Cambia materia</button></p>' +
    (tipo === 'cap' ? '<label class="f">Focus (facoltativo)<input type="text" id="focus" placeholder="Per esempio: paragrafo 2 e 3, oppure la scrittura"></label><p class="muted">Se lo scrivi, Scio prepara tutto solo su quegli argomenti.</p>' : '') +
    '<div class="row"><label class="btn sec">Scatta foto<input type="file" accept="image/*" capture="environment" id="f1" hidden></label><label class="btn sec">Scegli le foto (anche tutte insieme)<input type="file" accept="image/*" multiple id="f2" hidden></label></div>' +
    '<p class="muted">Dal PC: nella finestra selezioni più foto con Ctrl+A, oppure le trascini qui, oppure le incolli con Ctrl+V. Le pagine vengono messe in ordine di nome.</p>' +
    '<div class="thumbs">' + V.foto.map((u, i) => '<div class="th"><img src="' + u + '" alt="Pagina ' + (i + 1) + '"><div class="row"><button data-act="su" data-i="' + i + '" aria-label="Sposta prima">↑</button><button data-act="giu" data-i="' + i + '" aria-label="Sposta dopo">↓</button><button data-act="del" data-i="' + i + '" aria-label="Togli">✕</button></div></div>').join('') + '</div>' +
    (V.errore ? '<div class="fb warn" role="alert">' + esc(V.errore) + '</div>' : '') +
    (V.busy ? '<p><span class="spin"></span> Scio sta leggendo e preparando tutto…</p>' : '<button class="btn full" data-act="' + (tipo === 'cap' ? 'prepara-cap' : 'prepara-es') + '">' + (tipo === 'cap' ? 'Prepara il mio studio' : 'Guidami nell\'esercizio') + '</button>') +
    '<p class="muted">Le foto non vengono salvate: restano solo i contenuti preparati.</p></div>';
}
function mancano(c) {
  const m = [];
  if (!arr(c.schema && c.schema.rami).length) m.push('schema');
  if (!arr(c.spiegazioni).length) m.push('spiegazioni');
  if (!arr(c.glossario).length) m.push('glossario');
  if (!arr(c.test).length) m.push('test');
  return m.join(', ');
}
function vCapitolo() {
  const c = S.capitoli.find(x => x.id === V.cap); if (!c) return vHome();
  const T = [['riassunto', 'Riassunto'], ['schema', 'Schema'], ['spiegazioni', 'Spiegazioni'], ['glossario', 'Glossario'], ['test', 'Test']];
  let corpo = '';
  if (V.tab === 'riassunto') corpo = legendaColori() + '<div class="card"><h2>In breve</h2><ul>' + c.riassunto_breve.map(x => '<li>' + md(x) + '</li>').join('') + '</ul></div><div class="card"><h2>Riassunto completo</h2>' + md(c.riassunto_completo) + '</div>' + (arr(c.inventario).length ? '<details class="card"><summary><b>Cosa ho trovato nelle pagine</b> (' + c.inventario.length + ' voci)</summary><ul>' + c.inventario.map(x => '<li>' + md(x) + '</li>').join('') + '</ul><p class="muted">Se manca qualcosa che per te è importante, scrivilo nel campo Focus e rigenera.</p></details>' : '');
  else if (V.tab === 'schema') corpo = '<div class="card"><h2>' + esc(c.schema.radice || c.titolo) + '</h2>' + arr(c.schema.rami).map(r => '<div class="tree"><h3>' + md(r.titolo) + '</h3><ul>' + arr(r.punti).map(p => '<li>' + md(p) + '</li>').join('') + '</ul></div>').join('') + '</div>';
  else if (V.tab === 'spiegazioni') corpo = c.spiegazioni.map((s, i) => '<div class="card"><h3>' + md(s.concetto) + '</h3><p>' + md(s.spiegazione) + '</p><div class="fb"><b>Esempio:</b> ' + md(s.esempio) + '</div><button class="btn sec small" data-act="meglio" data-i="' + i + '">Spiegamelo meglio</button><div id="m' + i + '"></div></div>').join('') || '<div class="card muted">Nessuna spiegazione.</div>';
  else if (V.tab === 'glossario') corpo = '<div class="card">' + c.glossario.map(g => '<p><b>' + esc(g.termine) + '</b>: ' + md(g.definizione) + '</p>').join('') + '</div>';
  else corpo = vTestPartenza(c);
  return barra() + '<div class="card"><div class="muted">' + esc(c.materia) + '</div><h1>' + esc(c.titolo) + '</h1>' + (c.avvisi.length ? '<div class="fb warn">' + c.avvisi.map(esc).join('<br>') + '</div>' : '') +
    (mancano(c) ? '<div class="fb warn" role="alert"><b>Mancano alcune parti</b> (' + mancano(c) + '). <button class="btn small" data-act="completa"' + (V.busy ? ' disabled' : '') + '>' + (V.busy ? 'Un momento…' : 'Prepara le parti mancanti') + '</button></div>' : '') +
    '<div class="row" style="margin-top:8px"><button class="btn sec small" data-act="apri-materia" data-m="' + esc(c.materia) + '">‹ ' + esc(c.materia) + '</button><button class="btn small" data-act="ascolta">Ascolta</button><button class="btn sec small" data-act="stop">Ferma</button><button class="btn sec small" data-act="stampa">Stampa o salva PDF</button><button class="btn sec small" data-act="scarica">Scarica testo</button></div></div>' +
    '<div class="tabs" role="tablist">' + T.map(t => '<button class="tab' + (V.tab === t[0] ? ' on' : '') + '" role="tab" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' + corpo + boxSposta(c, 'cap');
}
function vTestPartenza(c) {
  if (V.test && V.test.cap === c.id) return vTest(c);
  const ult = c.risultati[c.risultati.length - 1];
  return '<div class="card"><h2>Test finale</h2><p>' + c.test.length + ' domande per capire se è tutto chiaro. Nessun tempo limite.</p>' + (ult ? '<p class="muted">Ultimo risultato: ' + ult.punti + ' su ' + ult.totale + '.</p>' : '') + '<button class="btn" data-act="inizia-test">' + (ult ? 'Rifai il test' : 'Inizia il test') + '</button></div>';
}
function vTest(c) {
  const t = V.test;
  if (t.fine) {
    const errati = [...new Set(t.errati.map(i => c.test[i].argomento).filter(Boolean))];
    return '<div class="card"><h2>Hai finito!</h2><p><b>' + t.punti + ' su ' + t.dom.length + '</b></p>' +
      (errati.length ? '<div class="fb warn"><b>Da ripassare:</b> ' + errati.map(esc).join(', ') + '</div>' : '<div class="fb ok">Tutto chiaro, bravo!</div>') +
      '<div class="row">' + (t.errati.length ? '<button class="btn" data-act="solo-errori">Ripeti solo gli errori</button>' : '') + '<button class="btn sec" data-act="chiudi-test">Chiudi</button></div></div>';
  }
  const q = c.test[t.dom[t.i]]; const opz = q.tipo === 'vf' ? ['Vero', 'Falso'] : arr(q.opzioni);
  const corr = q.tipo === 'vf' ? (q.corretta ? 0 : 1) : q.corretta;
  return '<div class="card"><div class="muted">Domanda ' + (t.i + 1) + ' di ' + t.dom.length + '</div><h2>' + md(q.domanda) + '</h2>' +
    opz.map((o, i) => { let cl = 'opt'; if (t.scelta != null) { if (i === corr) cl += ' good'; else if (i === t.scelta) cl += ' bad'; } return '<button class="' + cl + '" data-act="rispondi" data-i="' + i + '"' + (t.scelta != null ? ' disabled' : '') + '>' + md(o) + (t.scelta != null && i === corr ? ' ✓' : '') + '</button>'; }).join('') +
    (t.scelta != null ? '<div class="fb ' + (t.scelta === corr ? 'ok' : 'warn') + '"><b>' + (t.scelta === corr ? 'Giusto!' : 'Quasi!') + '</b> ' + md(q.spiegazione) + '</div><button class="btn" data-act="avanti">' + (t.i + 1 >= t.dom.length ? 'Vedi il risultato' : 'Avanti') + '</button>' : '') + '</div>';
}
function vEsercizio() {
  const es = S.esercizi.find(x => x.id === V.es); if (!es) return vHome();
  let h = barra() + '<div class="card"><div class="muted">' + esc(es.materia) + ' · esercizio guidato</div><h2>' + md(es.richiesta) + '</h2></div>';
  es.passi.forEach((p, i) => {
    if (i < es.i || es.finito) h += '<div class="card"><div class="step"><span class="num done">✓</span><div><b>' + esc(p.titolo) + '</b><div class="muted">Hai scritto: ' + esc((es.fatti.find(f => f.i === i) || {}).risposta || '') + '</div></div></div></div>';
    else if (i === es.i) {
      const sh = V.mostra || {};
      h += '<div class="card" style="border-color:var(--accent)"><div class="step"><span class="num">' + (i + 1) + '</span><div style="flex:1"><h2>' + esc(p.titolo) + '</h2><p>' + md(p.domanda) + '</p>' +
        (V.passoOk ? '<div class="fb ok">' + md(V.fb.testo) + '</div><button class="btn" data-act="passo-avanti">' + (i + 1 >= es.passi.length ? 'Concludi' : 'Passo successivo') + '</button>' :
          '<label class="f">La tua idea<textarea id="idea" placeholder="Scrivi qui cosa pensi, anche se non sei sicuro">' + esc(V.bozza || '') + '</textarea></label>' +
          (V.fb ? '<div class="fb warn">' + md(V.fb.testo) + '</div>' : '') +
          arr(p.indizi).slice(0, sh.n || 0).map((x, k) => '<div class="fb"><b>Indizio ' + (k + 1) + ':</b> ' + md(x) + '</div>').join('') +
          (sh.es ? '<div class="fb"><b>Esempio simile:</b> ' + md(p.esempio_simile) + '</div>' : '') +
          (V.errore ? '<div class="fb warn" role="alert">' + esc(V.errore) + '</div>' : '') +
          (V.busy ? '<p><span class="spin"></span> Scio sta pensando…</p>' : '<div class="row"><button class="btn" data-act="controlla">Controlla la mia idea</button><button class="btn sec" data-act="indizio"' + ((sh.n || 0) >= arr(p.indizi).length ? ' disabled' : '') + '>Dammi un indizio (' + (sh.n || 0) + ' di ' + arr(p.indizi).length + ')</button><button class="btn sec" data-act="esempio">Esempio simile</button></div>')) +
        '</div></div></div>';
    } else h += '<div class="card muted"><b>' + (i + 1) + '. ' + esc(p.titolo) + '</b> · si sblocca dopo il passo precedente</div>';
  });
  if (es.finito) h += '<div class="card"><div class="fb ok"><b>Esercizio completato!</b> Ci sei arrivato con il tuo ragionamento. Indizi usati: ' + es.indiziTotali + '.</div><button class="btn" data-act="home">Torna allo studio</button></div>';
  return h + '<div class="row" style="margin-bottom:12px"><button class="btn sec small" data-act="apri-materia" data-m="' + esc(es.materia) + '">‹ ' + esc(es.materia) + '</button></div>' + boxSposta(es, 'es') + '<p class="muted" style="text-align:center">Scio non ti dà la soluzione: ti aiuta a trovarla.</p>';
}
function vGenitori() {
  if (!V.genitoriOk) return barra() + '<div class="card"><h1>Area genitori</h1><label class="f">PIN<input type="password" id="pinin" inputmode="numeric" maxlength="8" autocomplete="off"></label><button class="btn" data-act="pin-ok">Entra</button></div>';
  const rr = []; S.capitoli.forEach(c => c.risultati.forEach(r => rr.push({ c, r })));
  return barra() + '<div class="card"><h1>Area genitori</h1><div class="row"><span class="chip">' + S.capitoli.length + ' capitoli</span><span class="chip">' + rr.length + ' test fatti</span><span class="chip">' + S.esercizi.length + ' esercizi</span></div></div>' +
    '<div class="card"><h2>Test e argomenti da rinforzare</h2>' + (rr.length ? rr.sort((a, b) => b.r.data.localeCompare(a.r.data)).slice(0, 10).map(x => '<p><b>' + esc(x.c.titolo) + '</b> · ' + x.r.punti + '/' + x.r.totale + ' · ' + new Date(x.r.data).toLocaleDateString('it-IT') + (x.r.errati.length ? '<br><span class="muted">Da ripassare: ' + esc(x.r.errati.join(', ')) + '</span>' : '') + '</p>').join('') : '<p class="muted">Ancora nessun test.</p>') + '</div>' +
    '<div class="card"><h2>Contenuti</h2>' + (S.capitoli.length ? S.capitoli.map(c => '<p><b>' + esc(c.titolo) + '</b> <span class="muted">(' + esc(c.materia) + ')</span> <button class="btn sec small" data-act="apri-cap" data-id="' + c.id + '">Vedi</button></p>').join('') : '<p class="muted">Nessun capitolo.</p>') +
    S.esercizi.map(e => '<p><b>' + esc(e.materia) + '</b>: ' + esc(e.richiesta).slice(0, 70) + ' <span class="chip">' + e.indiziTotali + ' indizi</span> <span class="chip ' + (e.finito ? 'ok' : 'warn') + '">' + (e.finito ? 'completato' : 'in corso') + '</span></p>').join('') + '</div>' +
    '<div class="card"><h2>Dati e sicurezza</h2><p class="muted">I dati restano solo su questo dispositivo. ' + (S.ultimoBackup ? 'Ultima copia: ' + new Date(S.ultimoBackup).toLocaleDateString('it-IT') + (Date.now() - new Date(S.ultimoBackup).getTime() > 30 * 86400000 ? ' — è passato più di un mese, conviene farne una nuova.' : '.') : '<b>Non hai ancora fatto nessuna copia dei dati:</b> se il browser viene pulito o il dispositivo si rompe, i capitoli andrebbero persi.') + ' La copia non contiene la chiave API né il PIN.</p><div class="row"><button class="btn sec" data-act="esporta">Salva una copia dei dati</button><button class="btn sec" id="installa" data-act="installa"' + (promptInstalla ? '' : ' hidden') + '>Installa Scio come app</button></div></div>' +
    '<div class="card"><h2>Impostazioni</h2><div class="row"><button class="btn sec" data-act="modifica">Profilo, DSA, aspetto, AI, PIN</button><button class="btn sec" data-act="esporta">Salva una copia dei dati</button><label class="btn sec">Ripristina copia<input type="file" accept="application/json" id="imp" hidden></label><button class="btn sec" data-act="azzera">Cancella tutto</button></div></div>';
}
function render() {
  applicaTema();
  const v = V.vista; let h = '';
  if (v === 'setup') h = vSetup(); else if (v === 'home') h = vHome(); else if (v === 'nuovo-cap') h = vNuovo('cap'); else if (v === 'nuovo-es') h = vNuovo('es');
  else if (v === 'materia') h = vMateria(); else if (v === 'capitolo') h = vCapitolo(); else if (v === 'esercizio') h = vEsercizio(); else if (v === 'genitori') h = vGenitori(); else h = vHome();
  document.getElementById('app').innerHTML = h;
  const f1 = document.getElementById('f1'), f2 = document.getElementById('f2');
  if (f1) f1.onchange = e => aggiungiFoto([...e.target.files]);
  if (f2) f2.onchange = e => aggiungiFoto([...e.target.files]);
  const imp = document.getElementById('imp');
  if (imp) imp.onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { if (t.length > 30000000) throw 0; const o = pulisciDati(JSON.parse(t)); S = o; migraMaterie(); salva(); lucchettoSalva({ n: 0, fino: 0 }); V.vista = 'setup'; V.genitoriOk = false; render(); toast('Copia ripristinata. Scegli un nuovo PIN e inserisci di nuovo la chiave API.'); } catch (x) { toast('File non valido.'); } }); };
  if (v === 'setup') {
    const agg = () => { const dsa = {}; document.querySelectorAll('[data-dsa]').forEach(x => dsa[x.dataset.dsa] = x.checked); const c = consigliato(document.getElementById('livello').value, dsa); document.getElementById('cons').innerHTML = 'Consigliato in base alle scelte: <b>' + TEMI[c] + '</b>. Si può cambiare quando vuoi.'; };
    let coloriToccato = false;
    document.getElementById('colori').onchange = () => { coloriToccato = true; };
    document.querySelectorAll('[data-dsa]').forEach(x => x.onchange = () => {
      agg(); document.getElementById('info-' + x.dataset.dsa).hidden = !x.checked;
      if (!coloriToccato) document.getElementById('colori').checked = !document.querySelector('[data-dsa=dislessia]').checked;
    }); document.getElementById('livello').onchange = agg;
    const prov = document.getElementById('prov'), preset = document.getElementById('preset');
    document.getElementById('chiave').oninput = () => { const a = leggiAi(); if (a.provider !== prov.value) { prov.value = a.provider; prov.onchange(); toast('Ho riconosciuto la chiave: servizio impostato su ' + prov.options[prov.selectedIndex].text + '.'); } };
    prov.onchange = () => { document.getElementById('boxcompat').hidden = prov.value !== 'compat'; };
    preset.onchange = () => { const x = PRESET[preset.value]; document.getElementById('url').value = x.url; if (x.modello) document.getElementById('modello').value = x.modello; };
  }
}

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
    const out = document.getElementById('esitoprova'); const a = leggiAi(); if (!a.key && S.profilo && S.profilo.ai) { a.kc = S.profilo.ai.kc; a.key = S.profilo.ai.key; }
    if (a.provider === 'demo') { out.textContent = 'In modalità demo non serve nessun collegamento.'; return; }
    out.textContent = 'Provo…';
    try { const t = await chiamaAI('Rispondi solo con la parola OK.', 'Rispondi OK.', [], a); out.textContent = 'Collegamento riuscito. Risposta: ' + t.slice(0, 40); }
    catch (e) { out.textContent = e.message === 'NODEMO' ? 'Manca la chiave API.' : e.message; }
  },
  'home': () => { V.vista = 'home'; V.test = null; },
  'genitori': () => { V.vista = 'genitori'; if (!S.profilo.pin) V.genitoriOk = true; },
  'fs+': () => { S.profilo.fs = Math.min(1.5, (S.profilo.fs || 1) + .1); salva(); },
  'fs-': () => { S.profilo.fs = Math.max(.9, (S.profilo.fs || 1) - .1); salva(); },
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
    const m = V.materia, e = elementiMateria(m), n = e.cap.length + e.es.length;
    const msg = n ? 'Eliminare la materia "' + m + '" insieme a ' + pl(e.cap.length, 'capitolo', 'capitoli') + ' e ' + pl(e.es.length, 'esercizio', 'esercizi') + '? Non si può annullare. Per tenerli, spostali prima in un\'altra materia.' : 'Eliminare la materia "' + m + '"?';
    if (!confirm(msg)) return 'async';
    S.materie = S.materie.filter(x => !sameM(x, m)); S.capitoli = S.capitoli.filter(c => !sameM(c.materia, m)); S.esercizi = S.esercizi.filter(x => !sameM(x.materia, m));
    salva(); V.vista = 'home'; V.materia = '';
  },
  'sposta': el => {
    const sel = document.getElementById('spostaM'); if (!sel || !sel.value) return 'async';
    const lista = el.dataset.k === 'es' ? S.esercizi : S.capitoli; const it = lista.find(x => x.id === el.dataset.id); if (!it) return 'async';
    it.materia = sel.value; V.materia = sel.value; salva(); toast('Spostato in ' + sel.value + '.');
  },
  'elimina-cap': el => { const it = S.capitoli.find(x => x.id === el.dataset.id); if (!it || !confirm('Eliminare il capitolo "' + it.titolo + '"? Non si può annullare.')) return 'async'; S.capitoli = S.capitoli.filter(x => x.id !== it.id); salva(); V.materia = it.materia; V.vista = 'materia'; },
  'elimina-es': el => { const it = S.esercizi.find(x => x.id === el.dataset.id); if (!it || !confirm('Eliminare questo esercizio? Non si può annullare.')) return 'async'; S.esercizi = S.esercizi.filter(x => x.id !== it.id); salva(); V.materia = it.materia; V.vista = 'materia'; },
  'su': el => { const i = +el.dataset.i; if (i > 0) [V.foto[i - 1], V.foto[i]] = [V.foto[i], V.foto[i - 1]]; },
  'giu': el => { const i = +el.dataset.i; if (i < V.foto.length - 1) [V.foto[i + 1], V.foto[i]] = [V.foto[i], V.foto[i + 1]]; },
  'del': el => { V.foto.splice(+el.dataset.i, 1); },
  'prepara-cap': () => { preparaCapitolo(); return 'async'; },
  'prepara-es': () => { preparaEsercizio(); return 'async'; },
  'apri-cap': el => { V.cap = el.dataset.id; V.tab = 'riassunto'; V.test = null; V.vista = 'capitolo'; },
  'apri-es': el => { V.es = el.dataset.id; V.fb = null; V.passoOk = false; V.mostra = {}; V.bozza = ''; V.vista = 'esercizio'; },
  'tab': el => { V.tab = el.dataset.t; },
  'ascolta': () => { const c = S.capitoli.find(x => x.id === V.cap); const t = V.tab === 'riassunto' ? c.riassunto_breve.join(' ') + ' ' + c.riassunto_completo : V.tab === 'glossario' ? c.glossario.map(g => g.termine + ': ' + g.definizione).join('. ') : V.tab === 'spiegazioni' ? c.spiegazioni.map(s => s.concetto + '. ' + s.spiegazione + ' ' + s.esempio).join(' ') : c.titolo; parla(t); return 'async'; },
  'stampa': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async'; document.getElementById('stampa').innerHTML = dispensaHTML(c); const t = document.title; document.title = c.titolo; try { window.print(); } catch (e) { toast('La stampa non è disponibile.'); } document.title = t; return 'async'; },
  'scarica': () => { const c = S.capitoli.find(x => x.id === V.cap); if (!c) return 'async'; const b = new Blob(['\ufeff' + dispensaTesto(c)], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (c.titolo || 'capitolo').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) + '.txt'; document.body.appendChild(a); a.click(); a.remove(); return 'async'; },
  'completa': async () => {
    const c = S.capitoli.find(x => x.id === V.cap); if (!c || V.busy) return;
    if (S.profilo.ai.provider === 'demo') { toast('In modalità demo non si può completare.'); return; }
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
  'stop': () => { try { speechSynthesis.cancel(); } catch (e) {} return 'async'; },
  'meglio': async el => { const c = S.capitoli.find(x => x.id === V.cap); const s = c.spiegazioni[+el.dataset.i]; const box = document.getElementById('m' + el.dataset.i); box.innerHTML = '<p><span class="spin"></span></p>';
    try { if (S.profilo.ai.provider === 'demo') { await new Promise(r => setTimeout(r, 400)); box.innerHTML = '<div class="fb">In demo la spiegazione alternativa non è disponibile. Con la chiave AI, Scio la riscrive con parole e un esempio diversi.</div>'; }
      else { const t = await chiamaAI('Sei Scio, tutor di studio. Spiega in modo diverso, più semplice, con un nuovo esempio concreto. Massimo 6 frasi brevi, in italiano. Solo testo.\n\n' + profiloTesto(), 'Concetto: ' + s.concetto + '\nSpiegazione precedente: ' + s.spiegazione, []); box.innerHTML = '<div class="fb">' + md(t) + '</div>'; } }
    catch (e) { box.innerHTML = '<div class="fb warn">' + esc(e.message) + '</div>'; } return 'async'; },
  'inizia-test': () => { const c = S.capitoli.find(x => x.id === V.cap); V.test = { cap: c.id, dom: c.test.map((_, i) => i), i: 0, punti: 0, errati: [], scelta: null, fine: false }; },
  'rispondi': el => { const t = V.test; if (t.scelta != null) return; const c = S.capitoli.find(x => x.id === V.cap); const q = c.test[t.dom[t.i]]; const corr = q.tipo === 'vf' ? (q.corretta ? 0 : 1) : q.corretta; t.scelta = +el.dataset.i; if (t.scelta === corr) t.punti++; else t.errati.push(t.dom[t.i]); },
  'avanti': () => { const t = V.test; const c = S.capitoli.find(x => x.id === V.cap); t.scelta = null; t.i++; if (t.i >= t.dom.length) { t.fine = true; if (!t.ripasso) { c.risultati.push({ data: new Date().toISOString(), punti: t.punti, totale: t.dom.length, errati: [...new Set(t.errati.map(i => c.test[i].argomento).filter(Boolean))] }); salva(); } } },
  'solo-errori': () => { const t = V.test; V.test = { cap: t.cap, dom: [...new Set(t.errati)], i: 0, punti: 0, errati: [], scelta: null, fine: false, ripasso: true }; },
  'chiudi-test': () => { V.test = null; },
  'indizio': () => { const es = S.esercizi.find(x => x.id === V.es); const m = V.mostra = V.mostra || {}; m.n = (m.n || 0) + 1; es.indiziTotali++; salva(); V.bozza = (document.getElementById('idea') || {}).value || ''; },
  'esempio': () => { V.mostra = V.mostra || {}; V.mostra.es = true; V.bozza = (document.getElementById('idea') || {}).value || ''; },
  'controlla': () => { controllaIdea(); return 'async'; },
  'passo-avanti': () => { const es = S.esercizi.find(x => x.id === V.es); es.i++; if (es.i >= es.passi.length) { es.finito = true; es.i = es.passi.length - 1; } V.fb = null; V.passoOk = false; V.mostra = {}; V.bozza = ''; salva(); },
  'pin-ok': async () => {
    const l = lucchetto(), ora = Date.now();
    if (l.fino > ora) { toast('Troppi tentativi. Riprova tra ' + Math.ceil((l.fino - ora) / 1000) + ' secondi.'); return 'async'; }
    const ok = await verificaPin(document.getElementById('pinin').value.trim(), S.profilo.pin);
    if (ok) {
      lucchettoSalva({ n: 0, fino: 0 }); V.genitoriOk = true;
      if (!String(S.profilo.pin).startsWith('p1.')) { S.profilo.pin = await hashPin(document.getElementById('pinin').value.trim()); salva(); }
    } else {
      const n = l.n + 1; lucchettoSalva({ n, fino: n >= 3 ? ora + Math.min(900, 15 * Math.pow(2, n - 3)) * 1000 : 0 });
      toast(n >= 3 ? 'PIN sbagliato. Attesa prima del prossimo tentativo.' : 'PIN non corretto.');
    }
    render();
    return 'async';
  },
  'modifica': () => { V.vista = 'setup'; },
  'esporta': () => { const b = new Blob([JSON.stringify(datiEsportabili())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'scio-copia-dati-v' + VERSIONE + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); S.ultimoBackup = new Date().toISOString(); salva(); toast('Copia salvata. Non contiene chiave API né PIN.'); },
  'azzera': () => { if (confirm('Cancellare tutti i dati di Scio su questo dispositivo?')) { localStorage.removeItem(LS); localStorage.removeItem('scio.lock'); try { indexedDB.deleteDatabase('scio-sec'); } catch (e) {} S = { profilo: null, capitoli: [], esercizi: [] }; V.vista = 'setup'; V.genitoriOk = false; } },
  'installa': async () => { if (promptInstalla) { promptInstalla.prompt(); try { await promptInstalla.userChoice; } catch (e) {} promptInstalla = null; } render(); return 'async'; },
  'rimuovi-chiave': () => { if (S.profilo && S.profilo.ai) { delete S.profilo.ai.key; delete S.profilo.ai.kc; if (S.profilo.ai.provider !== 'compat') S.profilo.ai.provider = 'demo'; salva(); toast('Chiave rimossa da questo dispositivo.'); } },
  'salva-setup': async () => {
    const nome = document.getElementById('nome').value.trim(); const pin = document.getElementById('pin').value.trim();
    const old = S.profilo || {};
    if (!nome) { toast('Scrivi il nome.'); return 'async'; }
    if (pin || !old.pin) {
      if (!/^\d{4,8}$/.test(pin)) { toast('Il PIN deve avere da 4 a 8 cifre.'); return 'async'; }
      if (pinBanale(pin)) { toast('PIN troppo facile da indovinare: scegline un altro.'); return 'async'; }
    }
    const dsa = {}; document.querySelectorAll('[data-dsa]').forEach(x => dsa[x.dataset.dsa] = x.checked);
    const tema = (document.querySelector('input[name=tema]:checked') || {}).value || 'calmo';
    const ai = leggiAi();
    if (ai.provider === 'compat' && !urlConsentito(ai.url)) { toast('Indirizzo non consentito: usa uno dei servizi dell\'elenco.'); return 'async'; }
    const vecchioAi = old.ai || {};
    if (ai.key) { ai.kc = await cifra(ai.key); ai.key = ''; }
    else { ai.kc = vecchioAi.kc || ''; ai.key = vecchioAi.key || ''; if (ai.key) { ai.kc = await cifra(ai.key); ai.key = ''; } }
    S.profilo = { nome, livello: document.getElementById('livello').value, dsa, tema, fs: old.fs || 1, pin: pin ? await hashPin(pin) : old.pin, ai, colori: document.getElementById('colori').checked };
    salva(); V.vista = 'home'; V.genitoriOk = false; render();
    return 'async';
  }
};
function parla(t) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t).replace(/\*\*/g, '')); u.lang = 'it-IT'; speechSynthesis.speak(u); } catch (e) { toast('La lettura ad alta voce non è disponibile.'); } }
function inFotoView() { return V.vista === 'nuovo-cap' || V.vista === 'nuovo-es'; }
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

/* Migrazione: chiave in chiaro di versioni precedenti → cifrata */
(async () => {
  try {
    const a = S.profilo && S.profilo.ai;
    if (a && a.key) { a.kc = await cifra(a.key); a.key = ''; salva(); }
    if (S.profilo && S.profilo.pin && !String(S.profilo.pin).startsWith('p1.') && /^\d{4,8}$/.test(S.profilo.pin)) { S.profilo.pin = await hashPin(S.profilo.pin); salva(); }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) {}
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