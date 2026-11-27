/**
 * Utente fisso per provare il backend in locale senza token Microsoft.
 * È una scorciatoia pericolosa: se finisse per errore nelle impostazioni di Azure darebbe accesso a chiunque.
 * Per questo si accetta SOLO in sviluppo locale (Functions Core Tools imposta AZURE_FUNCTIONS_ENVIRONMENT=Development)
 * e MAI dove esiste WEBSITE_SITE_NAME (cioè dentro Azure). In ogni altro caso l'app NON parte.
 */
export function resolveDevBypass(env: Record<string, string | undefined>): string | undefined {
  const user = env.DEV_AUTH_BYPASS_USER?.trim();
  if (!user) return undefined;
  const local = env.AZURE_FUNCTIONS_ENVIRONMENT === "Development" && !env.WEBSITE_SITE_NAME;
  if (!local) throw new Error("DEV_AUTH_BYPASS_USER è ammesso solo in sviluppo locale: rimuoverlo dalle impostazioni.");
  return user;
}
