import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Token CSS variables must exist before any consuming styles load.
import "../dist/tokens.css";
import "./index.css";
import App from "./App.tsx";
import { configureRiveRuntime } from "./riveRuntime";

/* Point the Rive runtime at our self-hosted wasm BEFORE the first canvas mounts.
   Left to itself the runtime fetches ~2.4 MB from unpkg at runtime, so a CDN
   incident takes out every Rive surface on the site. Called here, explicitly and
   ahead of render, rather than as an import side effect — the ordering is the
   whole contract, and it should be visible at the call site. */
configureRiveRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
