# Privacy: dove vanno i dati e cosa sappiamo (e non) dell'AI

Verificato il 21/11/2026 su pagine Microsoft Learn raggiunte da ricerca web. **Non sostituisce una valutazione
legale/DPO dell'agenzia.** Dove le fonti non erano chiare è scritto.

## Che cosa fa l'app con i dati
| Dato | Cosa succede |
|---|---|
| **Audio** | Registrato sul telefono, inviato al server, trascritto **solo in memoria** (mai su disco, blob o database). Sul telefono viene cancellato appena il testo è salvato. Mai conservato. |
| **Testo trascritto** | Salvato nel **database Cosmos DB dell'azienda** (regione UE, nel tenant), per l'archivio "Note". Si può **eliminare** nota per nota (cancellazione definitiva). |
| **Impegni, contatti, calendario** | Letti/scritti solo su Outlook e To Do dell'utente, con i suoi permessi. Nessuna copia altrove salvo titoli/date nelle note. |
| **Log** | Solo codici e identificativi tecnici: mai testo, nomi, email, titoli (verificato dai test). |
| **Chiavi/segreti** | Nessuno nel codice; accesso con identità gestita. |

I servizi usati sono **tutti Azure nel tenant aziendale**: Speech (trascrizione), Azure OpenAI (estrazione),
Cosmos DB. Nessun servizio di terzi fuori da Azure. L'AI è **Azure OpenAI**, non altri fornitori.

## L'AI "divulga" o "archivia" i dati?
**Addestramento: no.** Microsoft dichiara che prompt e risposte di Azure OpenAI non sono usati per addestrare
o migliorare i modelli, né condivisi con OpenAI; per Speech, che i dati dei clienti non servono a migliorare i modelli.

**Archiviazione: dipende da un punto che le fonti non chiariscono del tutto.**
- **Azure OpenAI – monitoraggio abusi.** In passato Microsoft scriveva che prompt e risposte potevano essere
  conservati fino a 30 giorni per rilevare abusi, visibili solo a personale autorizzato se segnalati.
  Pagine più recenti sembrano aver cambiato il testo (revisione automatica con AI); da fonti non ufficiali la
  frase dei 30 giorni risulta rimossa, ma **non ho potuto confermarlo su una pagina ufficiale aggiornata**.
  Le aziende idonee possono chiedere il **"monitoraggio abusi modificato"**, con cui Microsoft non conserva
  prompt e risposte della sottoscrizione.
- **Speech.** Per la trascrizione in tempo reale Microsoft dice che l'audio è elaborato in memoria e non
  conservato. Per la **trascrizione "fast"** (quella che usiamo) le fonti che ho trovato non lo dicono in modo
  esplicito: da verificare sulla pagina Speech "Data and privacy".

## Cosa consiglio
1. **Prima dell'uso reale**, leggere queste pagine e decidere con il responsabile privacy dell'agenzia:
   - Azure OpenAI: https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy e
     https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring
   - Speech: https://learn.microsoft.com/legal/cognitive-services/speech-service/speech-to-text/data-privacy-security
2. Se serve **zero conservazione**, richiedere il monitoraggio abusi modificato per la sottoscrizione.
3. Il rapporto con Microsoft è regolato dal contratto/DPA già in essere per Azure e Microsoft 365: controllare
   che copra questo uso.
4. Fino ad allora, **non dettare dati particolarmente sensibili** (salute, dati giudiziari, credenziali, dati di
   clienti coperti da segreto): il testo passa comunque dal modello.
5. Tenere l'**eliminazione delle note** come abitudine per ciò che non serve conservare.
