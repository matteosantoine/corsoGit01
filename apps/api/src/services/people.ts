export type Candidate = { nome: string; email: string };

export class PeopleError extends Error {}

export interface PeopleSearch {
  /** Cerca per nome tra le persone dell'utente. `userToken` è il token Microsoft dell'utente. */
  search(userToken: string | null, name: string): Promise<Candidate[]>;
}

/** Toglie ciò che potrebbe alterare la ricerca (virgolette, controlli) e limita la lunghezza. */
export function cleanQuery(raw: string): string {
  return raw.replace(/["\\\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

type GraphPerson = {
  displayName?: string | null;
  scoredEmailAddresses?: { address?: string | null; relevanceScore?: number }[];
};

export function toCandidates(people: GraphPerson[], limit = 5): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const p of people) {
    const best = [...(p.scoredEmailAddresses ?? [])]
      .filter((a) => a.address && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.address))
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))[0];
    if (!best?.address) continue;
    const email = best.address.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ nome: (p.displayName ?? "").trim() || email, email });
    if (out.length === limit) break;
  }
  return out;
}

type Options = {
  /** Scambia il token dell'utente con un token per Microsoft Graph (flusso On-Behalf-Of). */
  getGraphToken: (userToken: string) => Promise<string>;
  fetchImpl?: typeof fetch;
};

/**
 * Cerca con Graph "People": include i contatti Outlook e le persone con cui l'utente
 * comunica più spesso, anche di altre aziende (permesso delegato People.Read).
 */
export function createGraphPeople({ getGraphToken, fetchImpl = fetch }: Options): PeopleSearch {
  return {
    async search(userToken, name) {
      const q = cleanQuery(name);
      if (!userToken || !q) return [];
      let res: Response;
      try {
        const token = await getGraphToken(userToken);
        res = await fetchImpl(
          `https://graph.microsoft.com/v1.0/me/people?$search=${encodeURIComponent(`"${q}"`)}&$top=10&$select=displayName,scoredEmailAddresses`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch {
        throw new PeopleError("servizio non raggiungibile");
      }
      if (!res.ok) throw new PeopleError(`risposta ${res.status}`);
      const data = (await res.json()) as { value?: GraphPerson[] };
      return toCandidates(data.value ?? []);
    },
  };
}
