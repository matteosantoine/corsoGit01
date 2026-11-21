# Impegni — app vocale

Premi "Registra", racconta cosa devi fare: l'app trascrive, estrae gli impegni e,
dopo conferma, crea eventi Outlook e promemoria To Do.

- Proposta di architettura: `docs/proposta-architettura.md`
- Registrazione app in Entra ID: `docs/registrazione-entra-id.md`
- Deploy Azure: `docs/deploy.md`

## Sviluppo locale
```bash
npm install
cp apps/web/.env.example apps/web/.env    # opzionale: senza, in dev l'app parte senza login
npm run dev                               # http://localhost:5173
npm test && npm run typecheck && npm run build
```

## Stato
- [x] Fase 0: struttura repo, infrastruttura Bicep, guida Entra ID
- [x] Fase A: login Microsoft, registrazione audio, coda offline, PWA installabile
- [ ] Fase B: trascrizione e cancellazione audio
- [ ] Fase C: estrazione e domande
- [ ] Fase D: contatti e conferma
- [ ] Fase E: creazione eventi e promemoria
- [ ] Fase F: schermate Oggi e Note
