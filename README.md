# Scio v0.6 — app di studio installabile (PWA)

Aiuto allo studio per ragazzi, con adattamenti per i DSA. Funziona nel browser, si installa come app su telefono, tablet e PC, e dopo la prima apertura parte anche senza rete (le funzioni AI richiedono comunque internet, o Ollama sul PC di casa).

Nessun server, nessun account, nessun tracciamento: **i dati restano sul dispositivo**.

## Pubblicare su GitHub Pages
1. Su github.com, in alto a destra **+ › New repository**. Nome: `scio`. Visibilità: **Public** (Pages gratuito richiede un repository pubblico). Non aggiungere README.
2. **uploading an existing file** › trascina **dentro la pagina tutto il contenuto della cartella** (non la cartella stessa; includi `fonts`, `icons` e il file `.nojekyll`) › **Commit changes**.
3. **Settings › Pages › Build and deployment › Source: Deploy from a branch › Branch `main` / `(root)` › Save.**
4. Dopo circa un minuto l'indirizzo è `https://toskurim.github.io/scio/`.
5. Aprilo da Chrome/Edge: menu › **Installa app** (su iPhone: Condividi › Aggiungi a Home).

**Nel repository non va mai messa nessuna chiave API.** La chiave si inserisce solo dentro l'app, sul dispositivo.

## Sicurezza (cosa è stato fatto)
- Politica di sicurezza della pagina (CSP) molto restrittiva: nessuno script esterno, nessun inline, collegamenti consentiti solo ad Anthropic, OpenRouter, Gemini, Groq e al PC locale. Font inclusi nel sito, nessuna risorsa esterna.
- Chiave API cifrata (AES-GCM) con una chiave del dispositivo non esportabile; mai in chiaro nel browser.
- PIN genitori salvato solo come impronta (PBKDF2, 150.000 giri, sale casuale), 4-8 cifre, PIN banali rifiutati, blocco crescente dopo 3 errori.
- Copia dei dati senza chiave né PIN; il ripristino ricostruisce ogni campo con controlli di tipo e lunghezza, quindi un file manomesso non può inserire codice. Dopo il ripristino si sceglie un nuovo PIN e si reinserisce la chiave.
- Indirizzi AI personalizzati ammessi solo se sul PC locale, Gemini o Groq.
- La pagina non si lascia incorniciare in altri siti; il service worker non memorizza mai le chiamate AI.
- Il file `_headers` aggiunge intestazioni HTTP complete (incluso `frame-ancestors`) se in futuro userai Netlify o Cloudflare Pages; GitHub Pages le ignora.

### Limiti onesti
- Il PIN protegge dai figli curiosi, non da chi ha il dispositivo sbloccato e conoscenze tecniche: i dati sono comunque nel browser.
- Con GitHub Pages non si possono impostare intestazioni HTTP: la protezione anti-incorniciamento è affidata allo script.
- Proteggi l'account GitHub con la verifica in due passaggi e un'email sicura: chi lo controlla potrebbe cambiare il codice.
- Sul tuo account imposta in Console Anthropic un tetto di spesa mensile (già fatto: 10 $).

## Collegare l'AI
Area genitori › Impostazioni. Claude/OpenRouter con chiave; Gemini e Groq con chiave; Ollama o LM Studio **solo sul PC dove girano** (imposta `OLLAMA_ORIGINS=https://toskurim.github.io`). Da telefono usa una chiave online.

Licenze font: cartella `fonts` (SIL OFL).
