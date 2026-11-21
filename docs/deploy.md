# Deploy dell'infrastruttura Azure

Prerequisiti: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) con Bicep,
una sottoscrizione Azure nel tenant aziendale, ruolo **Proprietario** o **Collaboratore + Amministratore accessi utente**
sulla sottoscrizione (servono le assegnazioni di ruolo).

```bash
az login --tenant <tenant-id>
az account set --subscription "<nome o id sottoscrizione>"

az group create --name rg-impegni --location westeurope

cp infra/parameters.example.json infra/parameters.json   # compila apiClientId
az deployment group what-if -g rg-impegni -f infra/main.bicep -p infra/parameters.json
az deployment group create  -g rg-impegni -f infra/main.bicep -p infra/parameters.json
```

Il comando restituisce `webUrl`, `apiUrl`, `identityClientId`, `identityPrincipalId`.
Usali per i passi 1 e 5 di `docs/registrazione-entra-id.md`.

## Cosa crea
Static Web Apps (Free), Functions (Flex Consumption), Cosmos DB (serverless), Azure AI Speech,
Azure OpenAI (modello piccolo, deployment `estrazione`), Key Vault, Application Insights,
una identità gestita con i soli ruoli necessari. Chiavi locali disattivate dove possibile
(Cosmos, Speech, OpenAI, Storage): si accede solo con identità.

## Da verificare prima del deploy
- **Modello OpenAI:** default `gpt-4o-mini` `2024-07-18`, deployment **Standard regionale** in `swedencentral`
  (o `northeurope`): i dati restano in UE. Dal listino prezzi Azure risulta che per questo modello non
  esiste un tier "Data Zone" e che in `westeurope` c'è solo quello globale (dati elaborabili fuori UE),
  quindi non vanno usati. Se il deploy rifiuta il modello (ritiro/versione), cambia
  `openAiModelName` / `openAiModelVersion` con un modello piccolo più recente disponibile nella regione.
- **Quote:** l'abilitazione di Azure OpenAI può richiedere una richiesta di accesso nella sottoscrizione.
- **Nomi:** `baseName` solo lettere minuscole e numeri.

## Frontend: pubblicazione
Dopo il deploy: GitHub Actions o `swa deploy` sulla risorsa `webName`
(build: `npm run build`, cartella `apps/web/dist`). Lo configureremo alla fase B/F.

## Costi
Con un utente, gran parte delle risorse è a consumo o gratuita. Stima dettagliata a fine progetto
in `docs/costi-stimati.md`.
