# AI.st.ain v0.30 — app di studio installabile (PWA)

**AI.st.ain** = *Aiuto Intelligente per lo STudio, l'Autonomia e l'INclusione* (un omaggio, nel nome, ad Albert Einstein).
Prima si chiamava Scio: il repository e l'indirizzo restano gli stessi e i dati già salvati si ritrovano.

Aiuto allo studio per ragazzi, con adattamenti per i DSA. Funziona nel browser, si installa come app su telefono, tablet e PC e, dopo la prima apertura, parte anche senza rete (le funzioni AI richiedono comunque internet, oppure Ollama sul PC di casa).

Nessun server, nessun account, nessun tracciamento: **i dati restano sul dispositivo**.

Indirizzo dell'app: https://toskurim.github.io/Scio/ (attenzione: la S di AI.st.ain è maiuscola).

- Pagina di presentazione pubblica: `presentazione.html` (https://toskurim.github.io/Scio/presentazione.html), da mandare a chi vuole conoscere l'app.

## Novità della v0.30
- Campo Modello: toccandolo si vede l'elenco completo dei modelli suggeriti (prima il menu mostrava solo i nomi simili a quello già scritto). Se non scegli nulla, il valore precedente resta.

## Novità della v0.29
- Gemini: se il servizio è occupato (errore 503/429) o il modello non esiste più (404), l'app riprova da sola con `gemini-3.6-flash` e poi `gemini-3.5-flash-lite`.
- Il campo Modello suggerisce i modelli più usati (tocca il campo per vedere l'elenco).

## Novità della v0.28 (e 0.27)
- **Gemini e Groq ora hanno una voce propria** nel menu "Servizio" (prima erano nascosti sotto "PC di casa"). "PC di casa" resta solo per Ollama e LM Studio. Le impostazioni già salvate continuano a funzionare.
- Gemini: il modello predefinito è ora `gemini-3.8-flash` (il 2.5 non è più disponibile per i nuovi utenti).

## Novità della v0.26
- **Aiuto per trovare il proprio metodo di studio (facoltativo)**, in tre parti che il genitore può spegnere separatamente per ogni profilo (modifica profilo › "Aiuto per trovare il proprio metodo di studio"):
  1. prima di un test chiede «Come hai studiato?» (le schede usate sono già spuntate; si può saltare);
  2. mostra quali modi di studiare danno risultati migliori, con avviso che i dati sono pochi;
  3. propone piccoli esperimenti ("prima del prossimo test prova l'allenamento") e a fine test confronta il risultato.
  Tutto resta sul dispositivo.
- **Tutorial**: mentre la guida (o il questionario DSA) è aperta la pagina non scorre più, così l'area evidenziata non si perde.

## Novità della v0.25
- **Mappa a tutto schermo**: nella scheda Mappa il pulsante "Schermo intero" apre la mappa in una pagina che occupa tutto lo schermo (e, dove il dispositivo lo permette, nasconde anche la barra del browser). Restano tutte le funzioni: zoom, adatta, rifai, stampa, modifica con trascinamento dei riquadri e delle etichette, pannello per aggiungere, collegare ed eliminare, annulla. Si esce con "Chiudi" o con il tasto Esc.

## Novità della v0.24
- Passando dal profilo di un ragazzo alla scelta del profilo o all'area genitori il tema (per esempio Notte) non cambia più da solo: resta l'ultimo usato.

## Novità della v0.23
- **Grafica più curata**: barra in alto fissa con icona e comandi con simboli, schermata iniziale con saluto e icona, materie con icone colorate, ombre morbide, passaggi animati tra le pagine (fermi se il dispositivo chiede meno animazioni). I temi per livello e l'aspetto automatico per i DSA restano invariati.
- **Guida con frecce**: la prima volta, la pagina iniziale, una materia, un capitolo e l'area genitori mostrano una guida a passi con frecce che indicano menu e comandi. Si rivede in ogni momento dal tasto ❓ nella barra. Si può saltare.
- **Questionario sui segnali di DSA** (24 domande, 4 aree, circa 3 minuti): proposto quando si crea un nuovo profilo e disponibile nel profilo. Chiarisce che NON è una diagnosi, indica di rivolgersi a pediatra/scuola e a un'équipe specializzata, e può attivare in prova gli aiuti corrispondenti. Le risposte non vengono salvate né inviate. Testi in italiano e inglese; le altre lingue ripiegano sull'inglese (traduzioni da rivedere).

## Novità della v0.22
- **Test meno prevedibili**: la risposta giusta non è più quasi sempre la A o la B. Le opzioni vengono mescolate dall'app in modo uniforme (anche nei test già salvati, una sola volta) e all'AI è chiesto di fare opzioni di lunghezza simile, con sbagliate plausibili, e circa metà di affermazioni false nei vero/falso.

## Novità della v0.21
- **Capitoli lunghi (anche 100 pagine)**: se carichi più di 8 foto, AI.st.ain le legge a blocchi di 8, mostra l'avanzamento ("16 pagine su 40") e unisce tutto in un solo capitolo (riassunto, schema, spiegazioni, glossario, esercizi e test; il test iniziale è limitato a 30 domande, poi si possono chiederne altre). Se un blocco è ancora troppo lungo viene dimezzato da solo; se un blocco fallisce, il capitolo viene creato con il resto e un avviso indica quali foto ricaricare.

## Novità della v0.20
- **"Sbagliata la materia?"**: la tendina ora propone tutte le materie (anche quelle non ancora create, che si aggiungono da sole), non più solo quelle già presenti nel profilo.

## Novità della v0.19
- Durante le attese ("AI.st.ain sta leggendo e preparando tutto…") compare l'omino di AI.st.ain che dondola e "pensa" con i fumetti, al posto del cerchio che gira (fermo se il dispositivo chiede meno animazioni).

## Novità della v0.18
- Tolta la vecchia dicitura "Primaria e università arriveranno dopo" dalla scheda del profilo (i due livelli ci sono già).

## Novità della v0.17
- **Informativa privacy dentro l'app** (in 9 lingue): cosa resta sul dispositivo, cosa va al servizio AI scelto, cosa va al produttore del browser se si usa la voce, cosa va a GitHub. Si apre dall'area genitori e dalle impostazioni famiglia; alla prima configurazione serve spuntare "Ho letto l'informativa". Avviso anche accanto al caricamento delle foto.
- **Interruttore "Invia all'AI i DSA"** (impostazioni famiglia, attivo di default): se disattivato, il servizio AI non riceve nessuna informazione sui DSA (font e spaziatura si adattano comunque sul dispositivo). Il nome del ragazzo non viene mai inviato.
- Traduzioni delle nuove frasi non ancora riviste da madrelingua.

## Novità della v0.16
- **Interrogazione orale a turni**: nuova scheda "Interrogazione". Il ragazzo sceglie il capitolo o un paragrafo, l'AI fa da insegnante ("Raccontami…"), il ragazzo parla e preme **"Ho finito"** quando ha terminato (la registrazione non si chiude da sola alle pause). Vede la trascrizione e può correggerla o scrivere al posto di parlare. L'AI valuta solo i contenuti (non la pronuncia): cosa è detto bene, cosa è sbagliato con la correzione, cosa manca (come domande guida), poi fa una domanda di approfondimento e risponde anche a voce. Fino a 5 risposte; a fine interrogazione c'è il risultato, un elenco di cosa ripassare, i punti e la medaglia "Oratore".
- Il riconoscimento vocale è quello del browser: ascolta in italiano e può inviare l'audio al produttore del browser (Google o Microsoft). Il genitore può nascondere la scheda dal profilo.

## Novità della v0.15
- **Il mio riassunto**: nuova sezione in ogni capitolo dove il ragazzo costruisce il riassunto da solo, un paragrafo alla volta (metodo in 4 passi: leggo, sottolineo le parole chiave, scrivo con parole mie, controllo). L'AI dice cosa è stato colto e fa domande guida su ciò che manca, senza mai scrivere il riassunto al posto suo. Il riassunto automatico resta com'è: se il genitore lo nasconde, il ragazzo vede solo questo strumento. A fine capitolo il riassunto si stampa e si guadagna la medaglia "Autore del riassunto".

## Novità della v0.14
- **Nuovo nome e nuova icona**: AI.st.ain, con un omino dai capelli bianchi scarmigliati.
- **Temi per livello**: "Gioco" solo alle elementari; dalle medie in su "Calmo" e "Notte".
- **Aspetto automatico**: se il genitore sceglie un DSA, carattere, dimensione, interlinea e spaziatura di lettere e parole si adattano da soli (dislessia, disortografia, discalculia, disgrafia). Senza DSA restano carattere e spaziatura standard. Si può cambiare a mano; "Ripristina le impostazioni consigliate" riporta tutto com'era.
- **Mappa concettuale**: si adatta da sola allo schermo; in modifica si trascinano con dito o mouse i riquadri e le etichette dei collegamenti (oppure frecce e "Riordina da solo"); stampa su un foglio orizzontale adattata al foglio, anche da sola ("Stampa la mappa").
- **Stampa**: meno pagine vuote, sezioni di seguito, esercizi con lo spazio per rispondere.
- **Test corretti**: l'AI non deve più fare domande sull'esercizio in sé ("è vero che nell'esercizio devi..."); un filtro nell'app scarta anche quelle rimaste, nei test nuovi e in quelli già salvati. Gli esercizi del libro servono solo da spunto.
- **Nuova sezione "Allenamento"**: esercizi di pratica sugli stessi argomenti, con controllo della risposta e 3 indizi; la soluzione non viene mai data. Si può nascondere dal profilo come le altre sezioni.
- **Altri test e difficoltà**: a fine test si chiedono altre domande o si sale (o si scende) di livello: Base, Medio, Avanzato, Esperto, Maestro.
- **Punti, gradi e traguardi**: punti per ogni risposta giusta, gradi (Curioso, Studioso, Scienziato, Genio, Einstain) e medaglie, nella schermata iniziale di ogni ragazzo.

## Novità della v0.13
- Il genitore sceglie, per ciascun figlio, quali sezioni sono disponibili: riassunto, schema, mappa concettuale, spiegazioni, glossario (Area genitori › Modifica profilo). Il test è sempre disponibile.
- Le sezioni nascoste non compaiono nel capitolo, non si ascoltano, non si stampano né si scaricano; il genitore le vede sempre da "Contenuti". Chi aggiorna trova tutto attivo.
- Nota: l'AI prepara comunque tutte le parti (servono per i test); la scelta riguarda ciò che il ragazzo vede.

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
- Quattro livelli scolastici per ogni profilo: **elementari (6-10)**, media (11-13), superiori (14-18) e **università (19+)**. Alle elementari AI.st.ain usa frasi corte, parole semplici, test da 10 a 15 domande e il tema "Gioco" consigliato; all'università usa un registro tecnico e rigoroso e domande di ragionamento. I profili esistenti restano invariati.

## Novità della v0.8.1
- Correzione dell'aggiornamento automatico: l'app scarica sempre i file nuovi e non resta più sulla versione vecchia.

## Novità della v0.8
- Lettura ad alta voce: AI.st.ain sceglie da solo la voce migliore del dispositivo (quelle “naturali” o di rete prima di quelle metalliche) e, in "Aspetto", si può scegliere una voce a mano e provarla. Se una voce online non risponde, ripiega su una del dispositivo.

## Novità della v0.7
- Un profilo per ogni figlio (PIN personale facoltativo) e un'unica area genitori con PIN.
- Lingue: area genitori e studio del ragazzo possono avere lingue diverse (italiano, inglese, tedesco, francese, spagnolo, rumeno, albanese, arabo con scrittura da destra a sinistra, cinese). Le traduzioni dell'interfaccia non sono state controllate da madrelingua: si correggono in `i18n.js`.
- Ripasso dilazionato delle domande sbagliate (dopo 1, 3, 7, 16, 35 giorni).
- Quiz a voce, lettura ad alta voce con la parola evidenziata, carattere/spaziatura/dimensione personalizzabili.
- Calendario delle verifiche con piano di ripasso.
- "Controlla il mio svolgimento": foto del proprio lavoro, indica dove controllare senza mai scrivere la soluzione.
- I test hanno da 20 a 30 domande.
- Chi aggiorna dalla v0.6 ritrova tutto: i dati vengono convertiti da soli al primo avvio.

## Aggiornare il sito su GitHub (da v0.25 a v0.26)
1. Dalla v0.18 cambiano `style.css`, solo `app.js`, `i18n.js`, `sw.js` e `README.md`.
2. Nel repository su github.com: **Add file › Upload files** e trascina quei quattro file (stessi nomi: vengono sostituiti).
3. **Commit changes**. Dopo circa un minuto l'indirizzo è aggiornato.
4. Sui dispositivi, chiudi e riapri l'app: compare "Nuova versione pronta".

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
