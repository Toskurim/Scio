/* AI.st.ain — voce naturale (Piper, licenza MIT, voce italiana "Paola"): gira tutta sul dispositivo, offline, senza invio di dati. */
importScripts('piper_phonemize.js', 'ort.wasm.min.js');
ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmPaths = new URL('./', self.location.href).href;
let cfg = null, sess = null, tok = 0;
function fonemi(testo) {
  return new Promise(async (ok, ko) => {
    try {
      const m = await createPiperPhonemize({
        print: d => { try { ok(JSON.parse(d).phoneme_ids); } catch (e) { ko(e); } },
        printErr: () => {},
        locateFile: u => u.endsWith('.wasm') ? 'piper_phonemize.wasm' : u.endsWith('.data') ? 'piper_phonemize.data' : u
      });
      m.callMain(['-l', cfg.espeak.voice, '--input', JSON.stringify([{ text: testo }]), '--espeak_data', '/espeak-ng-data']);
    } catch (e) { ko(e); }
  });
}
async function carica() {
  if (sess) return;
  cfg = await (await fetch('it_IT-paola-medium.onnx.json')).json();
  const buf = await (await fetch('it_IT-paola-medium.onnx')).arrayBuffer();
  sess = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
}
async function sintetizza(testo, vel) {
  const ids = await fonemi(testo);
  const inf = cfg.inference;
  const feeds = {
    input: new ort.Tensor('int64', ids, [1, ids.length]),
    input_lengths: new ort.Tensor('int64', [ids.length]),
    scales: new ort.Tensor('float32', [inf.noise_scale, inf.length_scale / vel, inf.noise_w])
  };
  const r = await sess.run(feeds);
  return r.output.data;
}
self.onmessage = async ev => {
  const m = ev.data;
  try {
    if (m.tipo === 'carica') { await carica(); self.postMessage({ tipo: 'pronto', sr: cfg.audio.sample_rate }); }
    else if (m.tipo === 'ferma') { tok++; }
    else if (m.tipo === 'di') {
      const mio = ++tok; await carica();
      const ps = m.pezzi;
      for (let i = 0; i < ps.length; i++) {
        if (mio !== tok) return;
        const t0 = Date.now(); const pcm = await sintetizza(ps[i].t, m.vel || 1);
        if (mio !== tok) return;
        self.postMessage({ tipo: 'pezzo', id: m.id, i: i, n: ps.length, off: ps[i].off, testo: ps[i].t, pcm: pcm, sr: cfg.audio.sample_rate, ms: Date.now() - t0 }, [pcm.buffer]);
      }
      if (mio === tok) self.postMessage({ tipo: 'fine', id: m.id });
    }
  } catch (e) { self.postMessage({ tipo: 'errore', id: m.id, msg: String(e && e.message || e) }); }
};
