import { CosmosClient } from "@azure/cosmos";
import type { TokenCredential } from "@azure/identity";
import { withDefaults } from "@impegni/shared";
import type { SettingsRepo } from "./settings";

const DOC_ID = "preferenze";

export function createCosmosSettings(opts: { endpoint: string; database: string; credential: TokenCredential }): SettingsRepo {
  const client = new CosmosClient({ endpoint: opts.endpoint, aadCredentials: opts.credential });
  const container = client.database(opts.database).container("settings");
  return {
    async get(userId) {
      const { resource } = await container.item(DOC_ID, userId).read();
      return withDefaults(resource);
    },
    async put(userId, settings) {
      await container.items.upsert({ id: DOC_ID, userId, ...settings });
    },
  };
}

