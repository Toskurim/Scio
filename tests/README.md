# Test automatici di AI.st.ain

Controllano nel browser (Chromium via Playwright) le funzioni principali: avvio, aspetto, metodo di studio, voce, costi, guida a fasi.
Le chiamate all'AI sono simulate: nessun costo, nessuna chiave.

## Come eseguirli
1. Installa Node.js, poi: `npm i -g playwright` e `npx playwright install chromium`.
2. Dalla cartella del progetto: `bash tests/run.sh`.
3. Ogni riga che inizia con `FALLITO` o `Error` è un problema da guardare; `TUTTO OK` o nessun `FALLITO` significa che è andata bene.

I test si aspettano il sito su `http://localhost:8766` (lo avvia `run.sh`).
`t14` è la prova generale; gli altri riguardano le singole novità (metodo di studio, costi, guida a fasi). Aggiungere un test nuovo per ogni funzione nuova è una buona abitudine.
