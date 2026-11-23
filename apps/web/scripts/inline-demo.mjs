// Unisce la build di anteprima in UN solo file HTML (anteprima.html), apribile ovunque.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-demo";
let html = readFileSync(join(dir, "index.html"), "utf8");
const assets = readdirSync(join(dir, "assets"));
const read = (name) => readFileSync(join(dir, "assets", name), "utf8");

for (const f of assets.filter((a) => a.endsWith(".css"))) {
  html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${read(f)}</style>`);
}
for (const f of assets.filter((a) => a.endsWith(".js"))) {
  const code = read(f).replace(/<\/script/gi, "<\\/script");
  html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => "");
  html = html.replace("</body>", () => `<script type="module">${code}</script>\n</body>`);
}
// Collegamenti a file locali (icone, manifest) non servono nel file unico.
html = html.replace(/<link[^>]*rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g, "");
writeFileSync(join(dir, "anteprima.html"), html);
console.log(`anteprima.html: ${(html.length / 1024).toFixed(0)} KB`);

// Versione "solo contenuto" (senza <html>/<head>/<body>), per pubblicarla come pagina in un visualizzatore
// che aggiunge da sé lo scheletro del documento.
const title = "Impegni Anteprima";
const styles = [...html.matchAll(/<style>[\s\S]*?<\/style>/g)].map((m) => m[0]).join("\n");
const scripts = [...html.matchAll(/<script type="module">[\s\S]*?<\/script>/g)].map((m) => m[0]).join("\n");
writeFileSync(join(dir, "anteprima-pubblicabile.html"), `<title>${title}</title>\n${styles}\n<div id="root"></div>\n${scripts}\n`);
console.log("anteprima-pubblicabile.html scritto");
