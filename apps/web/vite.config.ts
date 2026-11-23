import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Impegni",
        short_name: "Impegni",
        description: "Detta un vocale, ci pensa l'app a creare impegni e promemoria.",
        lang: "it",
        start_url: "/",
        display: "standalone",
        background_color: "#0b3d91",
        theme_color: "#0b3d91",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  // La build di anteprima è un solo file HTML: niente caricamenti separati.
  build: mode === "demo" ? { rollupOptions: { output: { inlineDynamicImports: true } } } : undefined,
  test: { environment: "node" },
}));
