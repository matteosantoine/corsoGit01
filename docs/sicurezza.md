# Controllo di sicurezza del codice

Data: 27/11/2026. **Metodo:** lettura del codice di tutta l'applicazione (app, server, infrastruttura), ricerca di
schemi pericolosi, analisi delle dipendenze (`npm audit`), prove automatiche con dati ostili e prova dell'app in un
browser vero sotto regole di sicurezza severe. **Non è un penetration test** né sostituisce uno: l'ambiente Azure
non esiste ancora, quindi alcune verifiche si completano dopo il deploy (ultima sezione).

Legenda: ✅ a posto · 🔧 corretto in questo controllo · ⚠️ rischio accettato/da sapere · ⏳ da verificare dopo il deploy

## 1. Iniezioni

| Tema | Esito | Dettaglio |
|---|---|---|
| **Iniezione nel database** (SQL/NoSQL) | ✅ | Il database (Cosmos DB) usa interrogazioni simili a SQL. Tutto ciò che scrive l'utente (testo di ricerca, cursore, identificativi) entra **solo come parametro**, mai incollato nella query. Il limite di risultati è un numero forzato tra 1 e 100. 🔧 Un limite non numerico (`NaN`) non veniva normalizzato: corretto. 5 prove con stringhe ostili (`' OR 1=1 --`, `DROP`, `UNION`…). |
| **Iniezione di istruzioni nell'AI** (*prompt injection*) | ✅ 🔧 | Il testo dettato è un **dato**: racchiuso tra delimitatori, con l'istruzione esplicita di ignorare i comandi al suo interno, e il modello **non ha strumenti** né può compiere azioni. 🔧 Una trascrizione con tre virgolette poteva "chiudere" il blocco e farsi passare per istruzioni: ora vengono neutralizzate (con prova). L'uscita del modello è validata (schema rigido) e **ricontrollata in codice**. **Il modello non può aggiungere destinatari**: produce solo nomi; gli indirizzi email li sceglie l'utente. Anche un'iniezione riuscita può al massimo produrre una proposta sbagliata, che l'utente deve confermare. |
| **Iniezione negli indirizzi di Microsoft Graph** | ✅ | La ricerca contatti ripulisce il nome (virgolette, caratteri di controllo, lunghezza) e lo codifica nell'indirizzo; gli identificativi nei percorsi sono codificati. Prova: un nome con `&$top=999` non aggiunge parametri. |
| **XSS** (script iniettati nelle pagine) | ✅ | Nessun `innerHTML`, `dangerouslySetInnerHTML`, `eval` o `document.write`. React tratta tutto come testo. In più, regole di sicurezza del sito (CSP) senza script o stili in linea e senza `eval`: **0 violazioni** con l'app completa e con la build di produzione. 🔧 La libreria `zod` provava a usare `eval` (bloccato dalla CSP): ora non lo fa. |
| **Iniezione di email/intestazioni** | ✅ | Gli indirizzi sono validati (formato, niente spazi, max 254 caratteri), il testo degli inviti è *testo semplice*, mai HTML. |

## 2. Accesso e autorizzazioni

| Tema | Esito | Dettaglio |
|---|---|---|
| Verifica del token Microsoft | ✅ 🔧 | Emittente, destinatario, tenant, scadenza, permesso `access`. 🔧 Aggiunti: **algoritmo fisso RS256** (rifiutati token non firmati `none` e a chiave condivisa `HS256`), claim obbligatori (scadenza, utente), e controllo dell'**app richiedente** (`azp`). 11 prove di rifiuto. |
| Accesso ai dati altrui (IDOR) | ✅ | Ogni lettura/scrittura usa l'utente **del token** e il suo spazio nel database. Ogni funzione ha una prova: nota di un altro utente → "non trovata", mai modificata. |
| Scorciatoia di sviluppo (`DEV_AUTH_BYPASS_USER`) | 🔧 | Prima, se impostata per errore in Azure, avrebbe dato accesso a chiunque. Ora l'app **non parte** se è impostata fuori dallo sviluppo locale o dentro Azure. 4 prove. |
| Scrittura solo di ciò che è confermato | ✅ | Il server crea in Outlook/To Do solo impegni confermati e salvati; il telefono non può impostare lo stato "creato". |
| CSRF | ✅ non applicabile | Si usa un'intestazione `Authorization`, non cookie. |
| Permessi Microsoft Graph | ✅ | Solo delegati e minimi (calendario, To Do, contatti, persone, profilo), per conto dell'utente, senza segreti (identità gestita). |

## 3. Abusi e costi

| Tema | Esito | Dettaglio |
|---|---|---|
| Uso eccessivo di servizi a pagamento | 🔧 | Aggiunto un **limite di richieste per utente** (es. 30 trascrizioni e 40 richieste AI ogni 10 minuti): oltre, risposta 429 **prima** di spendere. ⚠️ È in memoria per ogni istanza del server: contiene l'abuso, non è una barriera assoluta. Consiglio un **budget Azure con avviso** (vedi costi). |
| Corpi enormi | 🔧 | Rifiuto immediato se la dimensione dichiarata supera il massimo (audio 13 MB, conferma 256 KB, testo 32 KB, impostazioni 4 KB) + limite dell'host Azure (13 MB) + audio massimo 12 MB. |
| Contenuti enormi nei campi | 🔧 | Titolo ≤ 200, descrizione ≤ 2000, luogo ≤ 200, nomi ≤ 100, **≤ 20 invitati**, ≤ 20 impegni per nota, durata ≤ 24 ore. L'output del modello viene accorciato, non rifiutato. Evita raffiche di inviti. |
| Memoria esaurita da dati enormi | 🔧 | `zod` (alta gravità, difetto noto) aggiornato alla versione corretta. |

## 4. Dati, segreti, registri

| Tema | Esito | Dettaglio |
|---|---|---|
| Segreti nel codice | ✅ | Ricerca nel repository: nessuna chiave o password. Accesso ai servizi con identità gestita; chiavi disattivate su Cosmos, Speech, OpenAI e Storage; Key Vault con protezione dalla cancellazione. 🔧 Cosmos: anche le chiavi non possono più modificare la struttura. |
| Registri senza dati personali | ✅ | Elenco chiuso di campi ammessi; prove su ogni funzione che testi, nomi, email e titoli non compaiano. |
| Conservazione | 🔧 | **Eliminazione automatica** delle note (30–365 giorni, predefinito 90): pulizia notturna, per utente, anche sulle note già salvate. |
| Audio | ✅ | Mai conservato dal server. |
| Errori | ✅ | Messaggi generici all'utente, nessun dettaglio tecnico o traccia. |
| Intestazioni delle risposte del server | 🔧 | `Cache-Control: no-store` e `nosniff` su ogni risposta. |
| Cifratura e trasporto | ✅ | Solo HTTPS, TLS 1.2, FTP disattivato, dati cifrati a riposo (impostazione predefinita Azure). |
| CORS | 🔧 | Solo l'indirizzo del sito. 🔧 `localhost` ora è escluso dalla produzione (parametro `allowLocalhost`, falso per impostazione predefinita). |

## 5. Dipendenze (`npm audit`)

Prima: **11 vulnerabilità** (2 critiche, 2 alte). Dopo gli aggiornamenti: **4 moderate**.
- **Produzione:** l'unica, `zod` (alta), è **corretta**.
- **Strumenti di sviluppo** (test, compilazione: `vitest`, `vite`, `esbuild`): aggiornati; non finiscono nell'app.
- **Restano 4 moderate** (`glob`/`minimatch` dentro `workbox-build`, usato solo in compilazione): difetto che richiede espressioni di ricerca costruite ad arte; qui sono fisse. ⚠️ Accettate.
- Il backend ora usa **Node 22** (richiesto dagli strumenti aggiornati); ⏳ verificare che Flex Consumption lo offra nella regione al deploy.
- Consiglio: attivare **Dependabot** e un `npm audit` automatico a ogni modifica.

## 6. Parte "client" (app sul telefono e sul PC)

L'app è una **PWA**: gira nel browser (Chrome/Edge) con le sue protezioni, senza codice nativo.

| Tema | Esito | Dettaglio |
|---|---|---|
| Regole di sicurezza del sito | 🔧 | `staticwebapp.config.json`: CSP rigorosa (script e stili solo del sito, niente `eval`, niente incorporamento), HSTS, `nosniff`, nessun referrer, microfono solo per il sito. Provata nel browser. |
| Chi può incorporare l'app | ✅ | Non incorporabile in altre pagine (anti *clickjacking*). |
| Accesso condiviso (PC in comune) | 🔧 | **Problema trovato:** una registrazione non ancora inviata sarebbe stata inviata dall'account della persona successiva. Ora ogni registrazione appartiene a un account; un altro account **non la vede e la elimina**. 5 prove. |
| Token di accesso nel browser | ⚠️ | MSAL li tiene nello spazio locale del sito, così l'accesso resta dopo aver chiuso l'app. Chi riuscisse a eseguire script nel sito potrebbe leggerli; la CSP rigorosa e l'assenza di script di terzi riducono il rischio. Alternativa (token solo in memoria) obbligherebbe ad accedere a ogni apertura. Accettato. |
| Audio sul dispositivo | ⚠️ | Finché non è inviato, l'audio sta nel database locale del browser, non cifrato dall'app (solo dal telefono/PC). Si cancella appena inviato. Serve blocco schermo e cifratura del dispositivo. |
| Servizio in background (*service worker*) | ✅ | Memorizza solo file statici dell'app, mai dati o risposte del server. |
| Reindirizzamenti | ✅ | Indirizzo di ritorno fisso al sito: nessun reindirizzamento aperto. |
| Script di terzi | ✅ | Nessuno (niente CDN, niente statistiche). |

**Android** (Chrome): l'app ha le stesse protezioni di un sito, nel suo spazio isolato; si disinstalla o si svuota da Impostazioni → App. Richiesto: blocco schermo e cifratura (predefinita dal 2019 sui telefoni recenti), aggiornamenti attivi, niente telefoni "rootati".
**Windows** (Edge): l'app vive nel profilo del browser; su PC condivisi usare **Esci** e profili separati; consigliata la cifratura del disco (BitLocker). ⚠️ Con Microsoft 365 Business Basic non è possibile imporre dispositivi conformi (serve Entra ID P1): accettato.

## 7. Infrastruttura

⚠️ Cosmos DB, Storage e Key Vault hanno la rete pubblica attiva, protetti da identità, ruoli minimi e TLS. Gli "endpoint privati" avrebbero un costo e una complessità sproporzionati per un utente. Accettato.

## 8. Da verificare dopo il deploy ⏳
1. **CSP**: oggi `connect-src` ammette `*.azurewebsites.net`; sostituire con l'indirizzo esatto del backend.
2. Che il backend parta su **Node 22** e che l'impostazione `FUNCTIONS_REQUEST_BODY_SIZE_LIMIT` sia accettata.
3. Consenso amministratore ai permessi Graph e credenziale federata (guida Entra ID).
4. **MFA** attiva per l'utente; nessun'altra persona assegnata all'app.
5. Budget Azure con avviso; prova del limite di richieste.
6. Un controllo esterno (penetration test) prima di un uso con dati realmente riservati, se la politica dell'azienda lo richiede.
