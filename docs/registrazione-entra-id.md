# Registrare l'app in Microsoft Entra ID

Serve un account **amministratore del tenant**. Una sola volta.
Portale: https://entra.microsoft.com → *Identità* → *Applicazioni* → *Registrazioni app*.

## 1. Registra l'app
1. **Nuova registrazione**. Nome: `Impegni`.
2. Tipi di account supportati: **Solo account in questa directory organizzativa (tenant singolo)**.
3. URI di reindirizzamento: piattaforma **Applicazione a pagina singola (SPA)**:
   - `http://localhost:5173` (sviluppo)
   - `https://<webUrl>` (l'indirizzo che il deploy Bicep restituisce come `webUrl`)
4. Crea. Annota **ID applicazione (client)** e **ID directory (tenant)**.

## 2. Esponi l'API (serve dalla fase B)
1. *Esporre un'API* → imposta l'URI ID applicazione: `api://<client-id>`.
2. Aggiungi uno scope: nome `access`, chi può dare il consenso: *Amministratori e utenti*,
   nome visualizzato "Usa Impegni".
3. *Manifest* → `requestedAccessTokenVersion` = `2`.

## 3. Permessi Microsoft Graph (delegati)
*Autorizzazioni API* → *Aggiungi* → *Microsoft Graph* → **Autorizzazioni delegate**:

| Permesso | Per cosa |
|---|---|
| `User.Read` | nome dell'utente |
| `Calendars.ReadWrite` | creare eventi e inviare inviti, leggere "Oggi" |
| `Tasks.ReadWrite` | promemoria in Microsoft To Do |
| `Contacts.Read` | cercare indirizzi email nei contatti |
| `People.Read` | persone con cui scrive più spesso |

Poi **"Concedi il consenso amministratore per <azienda>"**. Senza questo passaggio
l'utente può vedere una richiesta di approvazione.

## 4. Limita l'accesso a chi serve
*Entra ID* → *Applicazioni aziendali* → `Impegni` → *Proprietà*:
- **Assegnazione utente richiesta?** → **Sì**
- *Utenti e gruppi* → assegna solo tuo padre (e te, per i test).

La **MFA** è già obbligatoria nel tenant (Conditional Access): vale automaticamente anche per questa app.
Verifica in *Protezione* → *Accesso condizionale* che la policy copra "Tutte le app cloud".

## 5. Credenziale per il backend (flusso On-Behalf-Of, senza segreti)
Il backend scambia il token dell'utente con un token Graph. Invece di un segreto
si usa l'identità gestita creata dal Bicep:

1. Esegui il deploy (vedi `docs/deploy.md`) e annota `identityClientId`.
2. App `Impegni` → *Certificati e segreti* → *Credenziali federate* → **Aggiungi credenziale**:
   - Scenario: **Altro emittente**
   - Emittente: `https://login.microsoftonline.com/<tenant-id>/v2.0`
   - Identificatore soggetto: l'**Object (principal) ID** dell'identità gestita (`identityPrincipalId`)
   - Pubblico: `api://AzureADTokenExchange`
   - Nome: `managed-identity`

Nessun segreto da conservare né da far scadere.

## 6. Variabili del frontend
Copia `apps/web/.env.example` in `apps/web/.env` e compila:
```
VITE_ENTRA_CLIENT_ID=<client-id>
VITE_ENTRA_TENANT_ID=<tenant-id>
```
