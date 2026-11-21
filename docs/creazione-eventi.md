# Creazione in Outlook e To Do (fase E)

Dopo **Conferma → Fine** l'app chiama `POST /api/notes/{id}/commit`. Il server crea, per conto dell'utente
(Microsoft Graph, permessi delegati `Calendars.ReadWrite` e `Tasks.ReadWrite`), solo gli impegni che l'utente
ha confermato e che risultano salvati nel database.

## Cosa viene creato
| Tipo | Dove | Dettagli |
|---|---|---|
| Incontro | Calendario Outlook (`POST /me/events`) | titolo, inizio e fine (durata scelta, 60 min di default), invitati come invito Outlook standard (funziona con qualsiasi provider), link Teams se richiesto, luogo, importanza, avviso 15 minuti prima |
| Promemoria | Microsoft To Do, lista predefinita | titolo, scadenza nel giorno indicato, avviso all'ora detta o alle 9:00 (non si crea un avviso nel passato) |

Il fuso orario è quello italiano ("W. Europe Standard Time"). Un evento serale che finisce dopo mezzanotte
ha la data di fine corretta.

## Protezioni contro doppioni ed errori
- **Prenotazione atomica**: prima di creare, il server marca l'impegno "in creazione" con una scrittura
  condizionata (ETag in Cosmos). Due richieste contemporanee (doppio tocco, rete instabile): una sola crea.
- **Evento con `transactionId`** (`<nota>-<posizione>`): se un tentativo si ripete, Outlook non crea un secondo evento.
- **Riprovabile**: se Microsoft non risponde, l'impegno torna "confermato" e il pulsante **Riprova** lo ricrea.
  Quelli già creati restano "creati" e non si toccano; un errore su uno non blocca gli altri.
- **Creazione interrotta** (es. il server si ferma a metà): dopo 10 minuti l'impegno si può riprovare.
  Per un promemoria in To Do questo può, in rarissimi casi, produrre un doppione (To Do non ha un
  identificativo anti-doppione come gli eventi).
- **Ricontrollo finale**: prima di creare, il server riverifica data, ora e invitati (es. la data è diventata passata).
- **Scartati e non confermati non vengono mai toccati.** Il telefono non può impostare lo stato "creato".
- Dopo la creazione il **testo della nota non si può più correggere** (evitare doppioni): l'app mostra il motivo.

## Messaggi all'utente
Permessi mancanti → "L'app non ha il permesso… chiedi all'amministratore". Servizio non disponibile → "Riprova
tra poco". Dati rifiutati → "Controlla i dati con Modifica". Nessuna schermata mostra codici tecnici.

## Da provare dopo il deploy (non verificabile qui)
- La creazione vera su Graph: serve il consenso amministratore ai permessi e la credenziale federata
  (guida Entra ID). Qui Graph è simulato e i contenuti inviati sono controllati dai test.
- Che il fuso `W. Europe Standard Time` dia gli orari attesi nel calendario reale (dovrebbe), e che
  il link Teams venga generato (`isOnlineMeeting` + `teamsForBusiness`).
- Il comportamento con inviti a indirizzi di altri provider (Google, ecc.): dovrebbe essere un invito standard.
