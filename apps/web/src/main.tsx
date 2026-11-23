import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

async function boot() {
  if (import.meta.env.VITE_DEMO === "1") {
    // Anteprima: l'"API" è simulata nel browser e non si registra il service worker.
    (await import("./demo/install")).installDemo();
  } else {
    registerSW({ immediate: true });
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void boot();
