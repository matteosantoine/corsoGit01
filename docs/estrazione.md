# Estrazione degli impegni (fase C)

## Flusso
1. Il telefono invia l'audio → il server trascrive e salva **solo il testo** → conferma.
2. L'app chiama `POST /api/notes/{id}/extract`. Il server legge la nota **dell'utente** (altrimenti 404),
   chiede al modello gli impegni, **ricontrolla tutto in codice** e salva il risultato.
3. L'app fa le domande sui dati mancanti, una alla volta, con pulsanti grandi:
   *Per quando è?* (Oggi / Domani / Dopodomani / calendario) → *A che ora?* (orari rapidi / selettore) →
   *Chi deve esserci?* (nomi, oppure "Nessuno, solo io").

## Correggere il testo
Sotto "Il tuo vocale, scritto" c'è il pulsante **Correggi il testo**. Si modifica il testo, poi
**Salva e rifai gli impegni**: l'app salva la correzione (`PUT /api/notes/{id}/text`, max 4000 caratteri,
solo sulla propria nota) e rifà l'estrazione sul testo corretto. Gli impegni e le risposte date prima su
quella nota vengono scartati e le domande ripartono da zero. Il pulsante è disattivo finché il testo non
cambia o se è vuoto. Se il server rifiuta la correzione, l'errore si vede e si resta in modifica.

## Dove sta cosa
| Cosa | File |
|---|---|
| Prompt di sistema (italiano) | `apps/api/src/prompts/extraction.ts` |
| Chiamata a Azure OpenAI (structured outputs, temperatura 0) | `apps/api/src/services/extractor.ts` |
| Ricontrollo date/ore e calcolo dei dati mancanti | `packages/shared/src/normalize.ts` |
| Calendario dei prossimi giorni dato al modello | `packages/shared/src/dates.ts` |
| Domande e risposte nell'app | `apps/web/src/review/` |
| Correzione del testo (app / server) | `apps/web/src/components/TranscriptCard.tsx` / `apps/api/src/handlers/editText.ts` |
| Casi di prova con frasi italiane | `apps/api/src/eval/cases.ts` |

## Scelte importanti
- **Il modello non calcola i giorni.** Riceve oggi, l'ora e una tabella dei prossimi 35 giorni
  ("giovedì 2026-11-26 (settimana prossima)") e deve solo leggerla. Così "giovedì prossimo" non dipende
  dalla sua aritmetica.
- **Non si fida del modello.** Date inesistenti o già passate e ore impossibili diventano "da chiedere";
  l'elenco dei dati mancanti lo calcola il codice, non il modello.
- **Evento = c'è qualcun altro; promemoria = solo per l'utente.** Se risponde "Nessuno, solo io",
  l'evento diventa promemoria (serve solo la data; l'ora è facoltativa).
- **Il testo trascritto è un dato, non un comando**: il prompt lo dice e la trascrizione è racchiusa
  tra delimitatori (c'è un caso di prova con un tentativo di "ignora le istruzioni").
- Dati mancanti → il modello lascia `null`; non indovina.

## Interpretazione di "giovedì prossimo"
Regola fissata: "`<giorno>` prossimo" = quel giorno nella **settimana successiva** (lun–dom).
Un semplice "giovedì" = la prima occorrenza da domani in poi. Anche se interpretato male, l'utente vede
la data nel riepilogo prima di confermare (fase D).

## Prove
- **Automatiche (senza modello):** `npm test` — normalizzazione, calendario, prompt, client del modello
  con risposte simulate, gestione errori e log senza dati personali.
- **Con il modello vero (dopo il deploy):**
  ```bash
  az login
  OPENAI_ENDPOINT=https://<openai>.openai.azure.com OPENAI_DEPLOYMENT=estrazione npm run eval -w apps/api
  ```
  Esegue 9 frasi italiane (data "finta" fissata a sabato 21/11/2026) e dice quali campi non coincidono.

## Non ancora fatto
- Risposta **vocale** alle domande (ora solo pulsanti e tastiera).
- Ricerca dei contatti per nome (fase D), conferma/modifica/scarta (fase D), creazione in Outlook/To Do (fase E).
- Gli impegni completati dall'utente non sono ancora salvati: restano nell'app finché non si chiude (fase D/E).
