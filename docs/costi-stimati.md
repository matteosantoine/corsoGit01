# Servizi necessari e costi stimati (un solo utente)

Data della verifica: 21/11/2026. Prezzi di listino (retail), IVA esclusa, in EUR.

## 1. Risposta breve

**Circa 1-3 € al mese** con un uso normale. Quasi tutto è gratuito o a consumo; l'unica voce che
si nota è la trascrizione audio. Non servono licenze aggiuntive oltre a quelle che l'agenzia ha già.

## 2. Già incluso nelle licenze Microsoft 365 Business Premium (costo aggiuntivo: 0)

| Servizio | Per cosa |
|---|---|
| Outlook / Calendario | eventi e inviti ai partecipanti |
| Microsoft To Do | promemoria |
| Teams | link riunione negli eventi |
| Microsoft Entra ID (piano P1) + Accesso condizionale | login aziendale e MFA obbligatoria |
| Microsoft Graph API | accesso a calendario, To Do, contatti (nessun costo per chiamata) |

Copilot **non serve** e non è incluso: l'estrazione degli impegni la fa Azure OpenAI.

## 3. Servizi Azure da creare (sottoscrizione pay-as-you-go già esistente)

| Servizio | Tipo di costo | Stima mensile |
|---|---|---|
| **Azure AI Speech** (trascrizione "fast", italiano) | **0,3232 €/ora di audio** (West Europe) | vedi tabella sotto |
| **Azure OpenAI** `gpt-4o-mini` (estrazione) | a token, circa 0,00015 € / 1.000 token in ingresso e 0,0006 € / 1.000 in uscita | < 0,20 € |
| **Azure Functions** (Flex Consumption) | a consumo; franchigia mensile gratuita di 250.000 esecuzioni e 100.000 GB-s | 0 € |
| **Static Web Apps** (piano Free) | gratuito | 0 € |
| **Cosmos DB** (serverless) | a richieste (circa 0,25 € per milione di unità) + 0,25 €/GB | < 0,05 € |
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

## 4. Cosa ho verificato e cosa no

**Verificato sul listino ufficiale Azure** (Retail Prices API, valuta EUR):
- Speech "Fast Transcription" in West Europe: 0,3232 €/ora.
- `gpt-4o-mini` esiste come tier **globale** (anche in West Europe) e **regionale** (es. Sweden Central,
  North Europe). **Non risulta un tier "Data Zone"** e **in West Europe non c'è il regionale**.

**Da fonti Microsoft ma senza cifra esatta** (le pagine prezzi mostrano segnaposto):
Cosmos DB, Functions, Key Vault, Log Analytics. Ordini di grandezza e franchigie sono quelli pubblici
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
