/** Fuso (nome Windows, accettato da Graph) che copre l'Italia. */
export const GRAPH_TZ = "W. Europe Standard Time";

export class GraphWriteError extends Error {
  constructor(message: string, readonly kind: "permessi" | "dati" | "temporaneo") {
    super(message);
  }
}

function mapStatus(status: number): GraphWriteError {
  if (status === 401 || status === 403) return new GraphWriteError(`risposta ${status}`, "permessi");
  if (status === 400 || status === 404 || status === 409) return new GraphWriteError(`risposta ${status}`, "dati");
  return new GraphWriteError(`risposta ${status}`, "temporaneo"); // 429, 5xx...
}

type Options = { getGraphToken: (userToken: string) => Promise<string>; fetchImpl?: typeof fetch };

/** Chiamata a Microsoft Graph per conto dell'utente, con errori già classificati (permessi / dati / temporaneo). */
export function makeGraphCall({ getGraphToken, fetchImpl = fetch }: Options) {
  return async function call(userToken: string, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    let res: Response;
    try {
      const token = await getGraphToken(userToken);
      res = await fetchImpl(`https://graph.microsoft.com/v1.0${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: `outlook.timezone="${GRAPH_TZ}"`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GraphWriteError("servizio non raggiungibile", "temporaneo");
    }
    if (!res.ok) throw mapStatus(res.status);
    return res.json();
  };
}
