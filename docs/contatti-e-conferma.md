# Contatti e conferma (fase D)

## Flusso
Domande sui dati mancanti → **scelta dei contatti** → **conferma** → (fase E) creazione in Outlook / To Do.

### Scelta dei contatti ("Chi è Mario?")
Per ogni nome citato in un incontro l'app cerca l'indirizzo email (`GET /api/people?q=Mario`):
| Risultato | Cosa vede l'utente |
|---|---|
| 1 persona | "È questa?" con nome ed email → **Sì** / **No, è un'altra persona** |
| più persone | un pulsante per ognuna (nome + email) + "Un'altra persona" |
| nessuna | "Non trovo Mario nei tuoi contatti. Scrivi l'indirizzo email." |
| ricerca non disponibile | avviso e inserimento manuale dell'email (non blocca) |

Gli invitati possono essere di **qualsiasi azienda o provider**: l'indirizzo è una normale email e
l'invito sarà un invito Outlook standard (fase E).

### Come si cerca
Microsoft Graph `GET /me/people?$search="nome"` con permesso delegato **People.Read**, per conto dell'utente
(flusso On-Behalf-Of con l'identità gestita, nessun segreto). L'elenco "persone" di Graph comprende i
contatti della casella Outlook e le persone con cui l'utente comunica più spesso, anche esterne. Si scarta
chi non ha un'email valida, si tolgono i doppioni, si tiene l'indirizzo più rilevante, massimo 5 risultati.
Il nome cercato è ripulito (virgolette e controlli) e codificato nell'URL, quindi non può alterare la richiesta.

### Conferma ("Vanno bene così?")
Ogni impegno ha **Conferma / Modifica / Scarta**. Il pulsante **Fine** si attiva solo quando tutti hanno
una scelta. **Modifica** permette di cambiare titolo, giorno, ora, durata, link Teams, luogo e invitati
(togliere o aggiungere una persona per email). Un impegno incompleto (senza data, ora o invitati
con email valida) non si può confermare.

### Dove viene garantito "nessun invito senza conferma"
Nel **server** (`POST /api/notes/{id}/confirm`): salva `confermato` / `scartato` per ogni impegno, rifiuta la
conferma di impegni incompleti o con data passata, e rifiuta le richieste con numero di impegni diverso da
quello salvato. La creazione in Outlook (fase E) leggerà **dal database** solo gli impegni `confermato`,
mai dati inviati dal telefono nel momento della creazione.

## Regole di protezione
- Un impegno già `creato` non si può scartare né cambiare, e il testo della nota non si può più correggere
  (evita doppioni).
- Log senza nomi, email, titoli o testo.

## File principali
| Cosa | File |
|---|---|
| Regole di conferma e invitati | `packages/shared/src/confirm.ts` |
| Ricerca contatti (Graph) | `apps/api/src/services/people.ts`, `handlers/people.ts` |
| Salvataggio scelte | `apps/api/src/handlers/confirm.ts` |
| Schermate | `apps/web/src/review/ResolveStep.tsx`, `ConfirmStep.tsx`, `EditItem.tsx` |

## Da provare dopo il deploy (non verificabile qui)
- La ricerca vera su Graph: il flusso On-Behalf-Of richiede la credenziale federata (passo 5 di
  `docs/registrazione-entra-id.md`) e il consenso amministratore ai permessi.
- Quanto bene `/me/people` trova i contatti reali di tuo padre. Se non basta, si aggiunge `/me/contacts`
  (permesso `Contacts.Read` già previsto).
