import { z } from "zod";

/**
 * Nel browser le regole di sicurezza del sito (CSP) vietano `eval`. zod prova a usarlo per andare più veloce
 * (e, se non può, funziona lo stesso ma il browser segnala una violazione). Disattivando l'ottimizzazione
 * PRIMA che i controlli vengano creati, la prova non avviene. Sul server (Node) non serve cambiare nulla.
 */
if (typeof document !== "undefined") z.config({ jitless: true });
