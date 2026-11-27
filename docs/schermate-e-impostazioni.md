# Schermate Oggi, Note e Impostazioni (fase F)

Quattro schede sempre visibili in basso: **Registra · Oggi · Note · Impostazioni**. Pulsanti grandi, testo grande,
massimo 3-4 azioni per schermata. Una registrazione in corso non si perde cambiando scheda.

## Oggi
Elenco di **oggi e domani**, letto da Outlook e To Do (`GET /api/today`, permessi già concessi:
`Calendars.ReadWrite`, `Tasks.ReadWrite`):
- eventi del calendario con orario, "Teams", luogo e numero di invitati; quelli annullati non compaiono;
  eventi di tutto il giorno e su più giorni gestiti;
- promemoria di To Do **non completati** con scadenza oggi o domani (con l'ora dell'avviso, se c'è).
Pulsante **Aggiorna**; si ricarica anche ogni volta che si apre la scheda.

## Note
Archivio dei vocali trascritti (`GET /api/notes`): dal più recente, 20 per volta (**Mostra altre**),
con **ricerca nel testo** (senza distinguere maiuscole). Sotto ogni nota, gli impegni che ne sono nati:
*Nel calendario*, *In To Do*, *Scartato*, *Confermato, da creare*, *Non confermato*. Ognuno vede solo le sue note.
**Elimina**: ogni nota ha il pulsante *Elimina* con richiesta di conferma ("Eliminare questa nota? Gli incontri e
i promemoria già creati restano nel calendario e in To Do"). Il server cancella **definitivamente** il documento
(`DELETE /api/notes/{id}`), solo se è dell'utente; mentre si sta creando un impegno la richiesta è rifiutata
(riprova tra qualche istante). Eliminata dall'archivio, la nota sparisce anche dalla scheda *Registra*. Gli eventi
e i promemoria già creati in Outlook / To Do **non** vengono toccati.

## Impostazioni (quattro, con scelte pronte)
| Impostazione | Scelte | Predefinito | Dove si usa |
|---|---|---|---|
| Durata di un incontro se non detta | 15, 30, 45, 60, 90, 120 min | 60 | estrazione (la conosce anche il modello) e creazione |
| Avviso prima di un incontro | all'ora, 5, 10, 15, 30 min, 1 ora, 1 giorno | 15 min | promemoria dell'evento in Outlook |
| Link Teams agli incontri | sì / no | sì | incontri senza luogo né modalità detta ricevono il link Teams |
| Elimina da sole le note dopo | 30, 60, 90, 180 giorni, 1 anno | 90 giorni | pulizia automatica notturna (non esiste "mai"); vale anche per le note già salvate; gli eventi e i promemoria già creati restano |

In fondo alle Impostazioni c'è la sezione **Privacy e intelligenza artificiale** (cosa fa l'AI, che può sbagliare, cosa si conserva, di non dettare dati sensibili). Anche la schermata *Registra* ricorda di non dettare dati sensibili e dopo quanti giorni le note si eliminano.

Salvate per utente (`GET/PUT /api/settings`); valori non ammessi rifiutati dal server; se la lettura fallisce
l'app usa i predefiniti. Cambiare un'impostazione vale per le note **successive**, non modifica impegni già creati.

## File principali
| Cosa | File |
|---|---|
| Schede e navigazione | `apps/web/src/App.tsx` |
| Schermate | `apps/web/src/screens/Today.tsx`, `Notes.tsx`, `Settings.tsx` |
| Formati in italiano | `apps/web/src/screens/format.ts` |
| Lettura calendario/To Do | `apps/api/src/services/graphRead.ts`, `handlers/today.ts` |
| Archivio note / impostazioni | `apps/api/src/handlers/notesList.ts`, `settings.ts`, `shared/src/settings.ts` |

## Da provare dopo il deploy
- Lettura reale del calendario: fusi orari (gli orari arrivano nel fuso italiano) ed eventi ricorrenti.
- Prestazioni della ricerca nelle note con molte note (query Cosmos su una sola partizione: dovrebbe essere ok).
