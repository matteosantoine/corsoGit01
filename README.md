# Impegni — app vocale

Premi "Registra", racconta cosa devi fare: l'app trascrive, estrae gli impegni e,
dopo conferma, crea eventi Outlook e promemoria To Do.

- Proposta di architettura: `docs/proposta-architettura.md`
- Registrazione app in Entra ID: `docs/registrazione-entra-id.md`
- Deploy Azure: `docs/deploy.md`
- Servizi e costi: `docs/costi-stimati.md`

## Sviluppo locale
```bash
npm install
cp apps/web/.env.example apps/web/.env    # opzionale: senza, in dev l'app parte senza login
npm run dev                               # http://localhost:5173
npm test && npm run typecheck && npm run build
```

## Backend in locale
```bash
cp apps/api/local.settings.example.json apps/api/local.settings.json   # compila i valori
npm run build -w apps/api && cd apps/api && func start                  # serve Azure Functions Core Tools
```
Per provare senza token Microsoft imposta `DEV_AUTH_BYPASS_USER` in `local.settings.json`
(solo sviluppo locale: non esiste nel Bicep e non va mai impostato in Azure).
Nel frontend imposta `VITE_API_URL=http://localhost:7071`.

## Stato
- [x] Fase 0: struttura repo, infrastruttura Bicep, guida Entra ID
- [x] Fase A: login Microsoft, registrazione audio, coda offline, PWA installabile
- [x] Fase B: trascrizione e cancellazione audio (testata con servizi simulati; da provare su Azure dopo il deploy)
- [x] Fase C: estrazione e domande (risposta con pulsanti; vedi `docs/estrazione.md`)
- [ ] Fase D: contatti e conferma
- [ ] Fase E: creazione eventi e promemoria
- [ ] Fase F: schermate Oggi e Note
