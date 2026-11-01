# Scio v0.8 — app di studio installabile (PWA)

Aiuto allo studio per ragazzi, con adattamenti per i DSA. Funziona nel browser, si installa come app su telefono, tablet e PC e, dopo la prima apertura, parte anche senza rete (le funzioni AI richiedono comunque internet, oppure Ollama sul PC di casa).

Nessun server, nessun account, nessun tracciamento: **i dati restano sul dispositivo**.

## Novità della v0.8
- Lettura ad alta voce: Scio sceglie da solo la voce migliore del dispositivo (quelle “naturali” o di rete prima di quelle metalliche) e, in "Aspetto", si può scegliere una voce a mano e provarla. Se una voce online non risponde, ripiega su una del dispositivo.

## Novità della v0.7
- Un profilo per ogni figlio (PIN personale facoltativo) e un'unica area genitori con PIN.
- Lingue: area genitori e studio del ragazzo possono avere lingue diverse (italiano, inglese, tedesco, francese, spagnolo, rumeno, albanese, arabo con scrittura da destra a sinistra, cinese). Le traduzioni dell'interfaccia non sono state controllate da madrelingua: si correggono in `i18n.js`.
- Ripasso dilazionato delle domande sbagliate (dopo 1, 3, 7, 16, 35 giorni).
- Quiz a voce, lettura ad alta voce con la parola evidenziata, carattere/spaziatura/dimensione personalizzabili.
- Calendario delle verifiche con piano di ripasso.
- "Controlla il mio svolgimento": foto del proprio lavoro, indica dove controllare senza mai scrivere la soluzione.
- I test hanno da 20 a 30 domande.
- Chi aggiorna dalla v0.6 ritrova tutto: i dati vengono convertiti da soli al primo avvio.

## Aggiornare il sito su GitHub (da v0.7 a v0.8)
1. Dalla v0.7 cambiano solo quattro file: `app.js`, `i18n.js`, `sw.js` e `README.md`.
2. Nel repository su github.com: **Add file › Upload files** e trascina quei quattro file (stessi nomi: vengono sostituiti).
3. **Commit changes**. Dopo circa un minuto l'indirizzo è aggiornato.
4. Sui dispositivi, chiudi e riapri l'app: compare "Nuova versione di Scio pronta".

## Sicurezza
- Politica di sicurezza della pagina (CSP) restrittiva: nessuno script esterno, nessun inline; collegamenti solo ad Anthropic, OpenRouter, Gemini, Groq e al PC locale.
- Chiave API cifrata (AES-GCM) con chiave del dispositivo non esportabile.
- PIN genitori e PIN dei figli salvati solo come impronta (PBKDF2, sale casuale), 4-8 cifre, PIN banali rifiutati, blocco crescente dopo 3 errori.
- Copia dei dati senza chiave né PIN; il ripristino ricostruisce ogni campo con controlli di tipo e lunghezza.
- Quiz a voce: il riconoscimento vocale è del browser, che può inviare l'audio al proprio fornitore.

### Limiti onesti
- I PIN tengono lontani i curiosi, non chi ha il dispositivo sbloccato e competenze tecniche.
- GitHub Pages non permette intestazioni HTTP: la protezione anti-incorniciamento è affidata allo script.
- Proteggi l'account GitHub con la verifica in due passaggi.
- La stampa e il file di testo restano in italiano nei titoli; i contenuti seguono la lingua del ragazzo.

Licenze font: cartella `fonts` (SIL OFL).
