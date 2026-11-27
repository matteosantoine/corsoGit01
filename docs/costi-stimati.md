# Servizi necessari e costi stimati (un solo utente)

Data della verifica: 21/11/2026. Prezzi di listino (retail), IVA esclusa, in EUR.

## 1. Risposta breve

**Circa 1-3 € al mese** con un uso normale. Quasi tutto è gratuito o a consumo; l'unica voce che
si nota è la trascrizione audio. Non servono licenze aggiuntive oltre a quelle che l'agenzia ha già.

## 2. Già incluso nella licenza Microsoft 365 Business Basic (costo aggiuntivo: 0)

| Servizio | Per cosa |
|---|---|
| Outlook / Calendario (web e mobile) | eventi e inviti ai partecipanti |
| Microsoft To Do | promemoria |
| Teams | link riunione negli eventi |
| Microsoft Entra ID (livello gratuito) | login aziendale e registrazione dell'app |
| MFA tramite "Impostazioni predefinite di sicurezza" | MFA obbligatoria (già attiva nel tenant). L'Accesso condizionale richiede Entra ID P1, non incluso in Basic e non necessario per l'app |
| Microsoft Graph API | accesso a calendario, To Do, contatti (nessun costo per chiamata) |

Copilot **non serve** e non è incluso (né in Basic né in Premium): l'estrazione degli impegni la fa Azure OpenAI.

## 3. Servizi Azure da creare (sottoscrizione pay-as-you-go già esistente)

| Servizio | Tipo di costo | Stima mensile |
|---|---|---|
| **Azure AI Speech** (trascrizione "fast", italiano) | **0,3232 €/ora di audio** (West Europe) | vedi tabella sotto |
| **Azure OpenAI** `gpt-4o-mini` (estrazione) | a token, circa 0,00015 € / 1.000 token in ingresso e 0,0006 € / 1.000 in uscita | < 0,20 € |
| **Azure Functions** (Flex Consumption) | a consumo; franchigia mensile gratuita di 250.000 esecuzioni e 100.000 GB-s | 0 € |
| **Static Web Apps** (piano Free) | gratuito | 0 € |
| **Cosmos DB** (serverless): archivio note e impostazioni | **0,2738 € per milione di operazioni + 0,2244 € per GB al mese** (listino West Europe) | **< 0,03 €** (vedi sezione sul database) |
| **Storage** (solo per il deploy delle Functions) | pochi centesimi | ~0,02 € |
| **Application Insights / Log Analytics** | primi 5 GB/mese gratuiti, i log non hanno contenuti | 0 € |
| **Key Vault** | circa 0,03 € ogni 10.000 operazioni (oggi quasi non usato) | ~0 € |
| **Identità gestita**, ruoli, rete | gratuiti | 0 € |

### Trascrizione: l'unica voce che conta

Ipotesi: nota media di 1 minuto.

| Uso | Note/mese | Ore di audio | Speech | Totale Azure circa |
|---|---|---|---|---|
| Leggero (~3 al giorno lavorativo) | 60 | 1,0 h | 0,32 € | **~0,4 €** |
| Normale (~7 al giorno lavorativo) | 150 | 2,5 h | 0,81 € | **~1,0 €** |
| Intenso (~20 al giorno lavorativo) | 400 | 6,7 h | 2,15 € | **~2,5 €** |

Nota: il listino mostra anche una tariffa "Fast Transcription Promo" a 0,0898 €/ora. Non la conto
perché è promozionale e può scadere.

### Estrazione AI

Circa 1.500 token in ingresso (istruzioni + testo) e 300 in uscita per nota: ≈ 0,0004 € a nota.
Anche con domande di chiarimento (doppio delle chiamate) restiamo sotto i 0,35 € per 400 note.

## 3 bis. Il database nel dettaglio (dove stanno le note)

**Dove sono salvate le note:** nel database Cosmos DB dell'azienda, in UE, **non sul telefono**. Per questo le stesse
note si vedono da Android, da Windows e da qualsiasi browser dopo l'accesso. Sul dispositivo restano solo l'audio non
ancora inviato (cancellato appena inviato) e l'accesso.

**Cosa pesa:** ogni nota occupa circa 3 KB (testo, impegni, invitati); contando gli indici del database, circa 6 KB.
**Cosa si paga:** lo spazio occupato e le operazioni (circa 140 "unità" per nota tra lettura, scrittura, conferma,
creazione e visualizzazioni; stima mia: la verificherete in *Cost Management* dopo un mese).
Prezzi (listino ufficiale, EUR, West Europe): **0,2738 € ogni milione di unità; 0,2244 € per GB al mese.**

| Uso | Note/mese | Note conservate (90 gg) | Spazio | Costo mensile (90 gg) | Con conservazione 1 anno |
|---|---|---|---|---|---|
| Leggero | 60 | 180 | ~1 MB | **~0,003 €** | ~0,004 € |
| Normale | 150 | 450 | ~3 MB | **~0,007 €** | ~0,008 € |
| Intenso | 400 | 1.200 | ~7 MB | **~0,017 €** | ~0,022 € |

**Quindi meno di 3 centesimi al mese in ogni caso:** per un solo utente il database costa praticamente nulla.
Non c'è un costo minimo (modalità *serverless*) e l'eliminazione automatica mantiene lo spazio sempre piccolo.
Le copie di sicurezza periodiche hanno costi a parte per gli eventuali extra (circa 0,10 €/GB al mese): irrilevanti a questi volumi.
Se un giorno gli utenti diventassero decine, il costo cresce in proporzione ma resta nell'ordine di pochi euro.

## 4. Cosa ho verificato e cosa no

**Verificato sul listino ufficiale Azure** (Retail Prices API, valuta EUR):
- Speech "Fast Transcription" in West Europe: 0,3232 €/ora.
- `gpt-4o-mini` esiste come tier **globale** (anche in West Europe) e **regionale** (es. Sweden Central,
  North Europe). **Non risulta un tier "Data Zone"** e **in West Europe non c'è il regionale**.

**Dal listino ufficiale (aggiornato il 27/11/2026):** anche Cosmos DB serverless (0,2738 €/M unità; 0,2244 €/GB-mese).

**Da fonti Microsoft ma senza cifra esatta** (le pagine prezzi mostrano segnaposto):
Functions, Key Vault, Log Analytics. Ordini di grandezza e franchigie sono quelli pubblici
di Microsoft; con questi volumi la somma resta comunque nell'ordine dei centesimi.

**Non verificato:** la disponibilità attuale della versione `2024-07-18` di `gpt-4o-mini` per nuovi
deployment. Se fosse ritirata, si cambia modello con un parametro del Bicep e il costo resta trascurabile.

## 5. Decisione presa per rispettare "dati in UE"

Il Bicep usava `DataZoneStandard` in West Europe: per questo modello **non esiste**. Ho cambiato il default a
**Azure OpenAI in Sweden Central, deployment Standard regionale** (dati elaborati nella regione UE scelta).
Il tier globale va evitato: i dati potrebbero essere elaborati fuori dall'UE.

## 6. Come tenere i costi sotto controllo
- In Azure: *Cost Management* → **Budget** da 5 €/mese con avviso via email all'80%.
- Il limite di 5 minuti per nota (già implementato) evita registrazioni lunghe per errore.
- Se il costo sale, la causa è quasi sempre la trascrizione: si guarda il numero di ore di audio.

## Fonti
- Azure Retail Prices API (listino ufficiale, EUR): https://prices.azure.com/api/retail/prices
- Prezzi Azure AI Speech: https://azure.microsoft.com/pricing/details/speech/
- Prezzi Azure OpenAI: https://azure.microsoft.com/pricing/details/azure-openai/
- Prezzi Cosmos DB serverless: https://azure.microsoft.com/pricing/details/cosmos-db/serverless/
- Prezzi Azure Functions: https://azure.microsoft.com/pricing/details/functions/
