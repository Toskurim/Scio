# Scio v0.12.1 — app di studio installabile (PWA)

Aiuto allo studio per ragazzi, con adattamenti per i DSA. Funziona nel browser, si installa come app su telefono, tablet e PC e, dopo la prima apertura, parte anche senza rete (le funzioni AI richiedono comunque internet, oppure Ollama sul PC di casa).

Nessun server, nessun account, nessun tracciamento: **i dati restano sul dispositivo**.

Indirizzo dell'app: https://toskurim.github.io/Scio/ (attenzione: la S di Scio è maiuscola).

## Novità della v0.12.1
- **Privacy**: il nome del ragazzo non viene più inviato al servizio AI. Alle richieste vanno solo il livello scolastico, gli adattamenti DSA scelti (servono per adattare i contenuti) e le foto o i testi del capitolo. Attenzione: se sulle foto compare il nome scritto sul quaderno, quello viaggia con la foto.

## Novità della v0.12
- **Statistiche per i genitori**: nell'Area genitori, sulla scheda di ogni ragazzo, c'è il pulsante "Statistiche" con: capitoli, test e media; giorni con attività negli ultimi 7 e 30 giorni (grafico a colonne degli ultimi 14); risultati degli ultimi 20 test con la linea del 70%; tabella per materia con media e andamento (in salita, stabile, in calo); argomenti sbagliati più spesso; stato del ripasso dilazionato; verifiche dei prossimi 30 giorni con l'ultimo risultato di quella materia; esercizi guidati e indizi usati. Si può stampare o salvare in PDF.
- I dati vengono solo dal dispositivo e restano visibili solo con il PIN dei genitori. Le statistiche contano giorni di attività, non il tempo passato sull'app.

## Novità della v0.11
- **Modifica a mano della mappa concettuale**: in "Mappa concettuale" il pulsante "Modifica la mappa" permette di toccare un nodo (o sceglierlo dall'elenco) e: cambiare il testo e la frase del collegamento, spostarlo sotto un altro nodo, cambiarne l'ordine (Su/Giù), aggiungere un nodo figlio, creare o togliere collegamenti tratteggiati tra rami diversi, eliminare un nodo con i suoi sotto-nodi. "Annulla ultima modifica" riporta indietro fino a 30 passi. Le modifiche si salvano da sole e finiscono anche nella stampa e nella copia dei dati.
- "Rifai la mappa" ora chiede conferma, perché cancella le modifiche fatte a mano.

## Novità della v0.10.1
- Correzione: la nuova versione richiede anche `style.css` (colori della mappa concettuale). Quando aggiorni carica sempre tutti i file della cartella.

## Novità della v0.10
- **Mappa concettuale**: in ogni capitolo c'è la nuova scheda "Mappa concettuale". Un pulsante la crea dal riassunto del capitolo: concetti collegati da frasi brevi ("comprende", "causa"...), con ingrandimento, adattamento allo schermo, lettura ad alta voce, stampa (pagina orizzontale) e file di testo. Per chi usa lo screen reader c'è anche l'elenco dei collegamenti in forma di testo. Senza chiave AI (modalità demo) la mappa viene ricavata dallo Schema.
- Funziona anche per i capitoli già fatti: basta aprirli e premere "Crea la mappa concettuale".

## Novità della v0.9
- Quattro livelli scolastici per ogni profilo: **elementari (6-10)**, media (11-13), superiori (14-18) e **università (19+)**. Alle elementari Scio usa frasi corte, parole semplici, test da 10 a 15 domande e il tema "Gioco" consigliato; all'università usa un registro tecnico e rigoroso e domande di ragionamento. I profili esistenti restano invariati.

## Novità della v0.8.1
- Correzione dell'aggiornamento automatico: l'app scarica sempre i file nuovi e non resta più sulla versione vecchia.

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
- Al servizio AI non va il nome del ragazzo, ma vanno il livello, i DSA scelti e le foto del capitolo: scegli un servizio di cui ti fidi.
- Quiz a voce: il riconoscimento vocale è del browser, che può inviare l'audio al proprio fornitore.

### Limiti onesti
- I PIN tengono lontani i curiosi, non chi ha il dispositivo sbloccato e competenze tecniche.
- GitHub Pages non permette intestazioni HTTP: la protezione anti-incorniciamento è affidata allo script.
- Proteggi l'account GitHub con la verifica in due passaggi.
- La stampa e il file di testo restano in italiano nei titoli; i contenuti seguono la lingua del ragazzo.

Licenze font: cartella `fonts` (SIL OFL).
