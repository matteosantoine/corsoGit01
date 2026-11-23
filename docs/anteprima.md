# Anteprima funzionante (senza Azure)

Un modo per **vedere e provare l'app** prima del deploy. Gira interamente nel browser: l'app e i gestori del
server sono **il codice vero** (controlli di conferma, creazione senza doppioni, ricerca, eliminazione…), mentre
tre servizi esterni sono **simulati**:

| Servizio vero | Nell'anteprima |
|---|---|
| Microfono e Azure Speech | nessun microfono: la "frase detta" si sceglie dal menu giallo in alto (o si scrive) |
| Azure OpenAI | un piccolo interprete a regole (`apps/web/src/demo/parser.ts`) che capisce poche forme di frase italiana |
| Microsoft Graph (contatti, calendario, To Do) | una rubrica finta (Mario, Anna ×2, Elena, Giulia, Paolo), un calendario e una lista di promemoria in memoria |

Tutto è in memoria: **ricaricando la pagina si riparte da zero**. L'anteprima serve a vedere come funziona e come
si presenta; **non dimostra la qualità dell'AI vera** né il collegamento a Microsoft (si proverà dopo il deploy).

## Aprirla sul proprio computer
```bash
git clone <repository> && cd <cartella>
npm install
npm run demo          # apre http://localhost:5173
```
Oppure un file unico: `npm run build:demo` crea `apps/web/dist-demo/anteprima.html` (apribile con doppio clic).

## Cosa provare
1. Scegli una frase dal menu giallo (es. "Giovedì prossimo alle dieci riunione con Mario Rossi su Teams e
   ricordami di pagare la bolletta venerdì") e premi **Registra** → **Stop**.
2. Rispondi alle domande (data, ora, invitati), scegli i contatti, poi **Conferma / Modifica / Scarta** → **Fine**.
3. Guarda **Oggi** (calendario e promemoria), **Note** (archivio, ricerca, elimina), **Impostazioni**.
4. Prova **Correggi il testo** e la frase libera ("Domani alle 11 riunione con Paolo").

## Sicurezza della build
La modalità anteprima si attiva solo con `--mode demo` (variabile `VITE_DEMO=1`). La build vera
(`npm run build`) **non contiene** nulla dell'anteprima: verificato cercando nel pacchetto finale rubrica finta,
interprete e banner (nessuna corrispondenza).
