# corsoGit01

Memoria del progetto.

## Agenti
- `orchestratore` (opus, effort xhigh): pianifica, divide il lavoro e verifica i risultati.
- `esecutore` (haiku): fa un compito alla volta e riporta come l'ha verificato.

## Note
Le note di lavoro stanno nella cartella `memoria/`.

## Progetto: app vocale "Impegni"
- Monorepo npm: `apps/web` (PWA React+Vite+TS), `apps/api` (Azure Functions, dalla fase B), `packages/shared` (schemi zod), `infra` (Bicep).
- Architettura e decisioni: `docs/proposta-architettura.md`. Solo Android e PC, niente iOS per ora.
- Regole: audio mai conservato; log senza contenuti né dati personali; nessun segreto nel codice; nessun invito senza conferma dell'utente.
- Verifica: `npm test && npm run typecheck && npm run build`.
