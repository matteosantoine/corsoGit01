# AI Act e privacy: documento per il responsabile privacy

Data: 27/11/2026. Documento **tecnico**, preparato da chi ha sviluppato l'app, da far valutare al responsabile
privacy (DPO) o a un consulente. **Non è un parere legale.** Le fonti sono in fondo; dove non ho potuto
verificare è scritto "da verificare".

## 1. Che cosa fa l'app
Un'agenda vocale: l'utente registra un vocale; l'app lo trascrive, ne ricava impegni (data, ora, partecipanti) e,
**solo dopo la sua conferma**, crea eventi in Outlook (con invito) e promemoria in Microsoft To Do.

## 2. Dove e come si usa l'intelligenza artificiale
| Componente | Servizio | Cosa fa | Cosa NON fa |
|---|---|---|---|
| Trascrizione | Azure AI Speech (UE) | trasforma la voce in testo italiano | non identifica chi parla, non analizza emozioni, non conserva l'audio |
| Estrazione | Azure OpenAI, modello piccolo (Sweden Central, UE) | dal testo ricava titolo, data, ora, nomi, priorità | non scrive messaggi, non vede i contatti né gli indirizzi email, non ha strumenti, non agisce da solo |

Controlli sull'AI: testo trattato come dato (non come istruzioni), risposta in formato rigido ricontrollato dal
codice, date e ore verificate, **conferma obbligatoria dell'utente** prima di creare qualsiasi cosa, indirizzi email
scelti dall'utente (non dal modello), nessun addestramento sui dati (dichiarazione Microsoft).
Nessuna decisione automatizzata su persone (art. 22 GDPR non applicabile).

## 3. Dati trattati e dove stanno
| Dato | Dove | Quanto resta |
|---|---|---|
| Audio (voce) | memoria del telefono/PC fino all'invio; memoria del server solo durante la trascrizione | cancellato subito dopo l'invio; mai salvato dal server |
| Testo della nota (può contenere nomi e informazioni di lavoro) | Cosmos DB aziendale (UE) | **eliminazione automatica** dopo 30–365 giorni (predefinito 90) o subito su richiesta dell'utente |
| Impegni, nomi e **email degli invitati** (terzi) | Cosmos DB, dentro la nota | come la nota |
| Eventi e promemoria | Outlook / To Do dell'utente (Microsoft 365) | secondo le regole di Microsoft 365 dell'azienda |
| Impostazioni | Cosmos DB | finché l'utente esiste |
| Registri tecnici | Application Insights | solo codici e identificativi tecnici, mai contenuti; 30 giorni |

Persone interessate: l'utente (dipendente/collaboratore) e **terzi** citati nelle note o invitati.

## 4. AI Act (Regolamento UE 2024/1689)
Lettura proposta, **da far confermare**:

| Tema | Valutazione |
|---|---|
| Pratiche vietate (art. 5) | Non pertinenti: nessuna manipolazione, punteggio sociale, riconoscimento delle emozioni, categorizzazione biometrica. |
| Alto rischio (art. 6, all. III) | Probabilmente **no**: un'agenda vocale non rientra negli ambiti elencati (selezione e gestione del personale, istruzione, servizi essenziali, ecc.). **Attenzione:** se l'azienda usasse l'app per **sorvegliare o valutare** i lavoratori (es. leggere le note altrui), l'uso rientrerebbe nell'ambito "lavoro" e cambierebbe tutto. L'app non lo prevede: ognuno vede solo le sue note. |
| Trasparenza (art. 50, in vigore dal 2/8/2026) | Probabilmente **non applicabile**: non è un chatbot verso persone e non pubblica contenuti generati. L'obbligo di marcatura (art. 50(2)) è per i sistemi che generano contenuti sintetici: qui l'AI produce dati strutturati che l'utente verifica. **Da verificare** con le linee guida della Commissione. |
| Alfabetizzazione in materia di AI (art. 4) | **Applicabile** all'azienda che usa il sistema: garantire una conoscenza adeguata del personale. La Commissione precisa che non serve misurarla. Misura adottata: spiegazione nell'app (Impostazioni → *Privacy e intelligenza artificiale*) e conferma obbligatoria. Consigliata una breve nota interna. |
| Ruoli | **Deployer** (utilizzatore): l'azienda. **Fornitore del sistema** ("provider"): chi sviluppa e mette in uso l'app, anche per uso interno. Gli obblighi sul modello di base sono di Microsoft/OpenAI. |
| Calendario | Le scadenze per i sistemi ad alto rischio sono state rinviate (accordo politico del 2026: 2/12/2027). **Da verificare** che il rinvio sia stato adottato in via definitiva. |

## 5. GDPR: punti da valutare
- **Ruoli:** l'azienda è titolare; Microsoft è responsabile del trattamento (Azure, Microsoft 365) secondo il contratto/DPA già in essere → **verificare che copra Azure OpenAI e Speech**. Chi sviluppa/gestisce l'app, se esterno, è sub-responsabile o responsabile: serve atto di nomina (art. 28).
- **Base giuridica:** esecuzione del rapporto/legittimo interesse dell'azienda a strumenti di organizzazione del lavoro; da definire col DPO.
- **Minimizzazione e limitazione della conservazione (art. 5):** audio mai conservato; testo eliminato in automatico; l'app avverte di **non dettare dati sensibili**.
- **Categorie particolari (art. 9):** la voce è dato personale ma non biometrico (non si usa per identificare). Se nel dettato finissero dati sulla salute ecc., il trattamento sarebbe più delicato: avviso in app e istruzione agli utenti.
- **Terzi citati:** nomi ed email di invitati e di persone citate; trattamento tipico dell'attività d'ufficio; verificare che l'informativa aziendale lo copra.
- **Trasferimenti:** servizi in UE (West Europe, Sweden Central). Verificare il contratto Microsoft (EU Data Boundary).
- **Monitoraggio abusi di Azure OpenAI:** Microsoft potrebbe conservare per un periodo prompt e risposte per rilevare abusi; **non confermato** su una pagina ufficiale aggiornata. Opzione: richiedere il monitoraggio modificato (nessuna conservazione). Dettagli in `docs/privacy-dati.md`.
- **Diritti degli interessati:** l'utente può eliminare le sue note in qualsiasi momento; per richieste di terzi (accesso/cancellazione) l'azienda può cancellare le note dell'utente (documento = nota; cancellazione definitiva). Manca una funzione di esportazione dei dati: se serve, si aggiunge.
- **Sicurezza (art. 32):** vedere `docs/sicurezza.md` (MFA, identità gestita, cifratura, registri senza contenuti, rete in UE, test di sicurezza).
- **Valutazione d'impatto (DPIA):** verosimilmente **non obbligatoria** (non c'è monitoraggio sistematico né larga scala né dati particolari come finalità); consiglio di documentare una **valutazione preliminare** che lo motivi, tenendo conto che si usa una tecnologia innovativa.
- **Registro dei trattamenti (art. 30):** aggiungere una voce "agenda vocale". **Violazioni dei dati:** includere l'app nella procedura aziendale.

## 6. Italia: lavoro e AI
- **Legge 132/2025** (in vigore dal 10/10/2025), art. 11: il datore di lavoro informa i lavoratori dell'uso dell'AI **nella gestione del rapporto di lavoro**. L'app non gestisce, sorveglia né valuta il lavoratore, quindi verosimilmente **non scatta**; **da verificare** se l'utente è un dipendente (le fonti consultate sono commenti, non il testo ufficiale; il rinvio al decreto Trasparenza è citato in modo diverso).
- **Statuto dei lavoratori, art. 4** (strumenti di controllo a distanza): l'app non permette al datore di vedere le note degli utenti; **da verificare** con un consulente del lavoro se serve accordo sindacale/autorizzazione.

## 7. Misure già in atto
Audio non conservato · eliminazione automatica e manuale delle note · dati in UE · MFA · accesso con identità gestita · registri senza contenuti · conferma obbligatoria · limiti anti-abuso · avviso sui dati sensibili e spiegazione dell'AI nell'app · controllo di sicurezza del codice.

## 8. Azioni consigliate (lista di controllo)
- [ ] Il DPO valuta questo documento e decide base giuridica e DPIA preliminare.
- [ ] Verificare che il contratto/DPA Microsoft copra Azure OpenAI e Speech; decidere se chiedere il monitoraggio abusi modificato.
- [ ] Aggiornare registro dei trattamenti e informativa privacy.
- [ ] Nota interna di formazione (art. 4 AI Act): cosa fa l'AI, può sbagliare, non dettare dati sensibili.
- [ ] Confermare con un consulente l'applicabilità di art. 50 AI Act, legge 132/2025 art. 11 e Statuto art. 4.
- [ ] Impostare un budget Azure e rivedere il periodo di conservazione (predefinito 90 giorni).
- [ ] Atto di nomina del responsabile/sub-responsabile, se lo sviluppo è esterno.

## Fonti
- AI Act, tempi e modifiche ("Digital Omnibus"): [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-), [Euronews](https://www.euronews.com/2025/11/19/european-commission-delays-full-implementation-of-ai-act-to-2027)
- Art. 4 (alfabetizzazione): [FAQ della Commissione](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers)
- Art. 50 (trasparenza): [linee guida](https://digital-strategy.ec.europa.eu/policies/guidelines-transparency-ai-generated-content), [FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- Legge 132/2025 e lavoro: [ItaliaOggi](https://www.italiaoggi.it/diritto-e-fisco/lavoro-e-previdenza/intelligenza-artificiale-cosa-cambia-per-datori-e-professionisti-df8msud3), [Agenda Digitale](https://www.agendadigitale.eu/industry-4-0/ia-e-sicurezza-sul-lavoro-cosa-cambia-con-la-legge-132-2025/)
- Dati e privacy dei servizi Microsoft: [Azure OpenAI](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy), [monitoraggio abusi](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring), [Speech](https://learn.microsoft.com/legal/cognitive-services/speech-service/speech-to-text/data-privacy-security)
