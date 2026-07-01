import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Token CSS variables must exist before any consuming styles load.
import "../dist/tokens.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
