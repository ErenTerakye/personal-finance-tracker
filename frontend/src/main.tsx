import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./shared/styles/index.css";
import "./shared/styles/tokens.css";
import "./shared/styles/reset.css";
import "./shared/styles/base.css";
import "./shared/styles/layout.css";
import "./shared/styles/components.css";
import "./shared/styles/features.css";
import "./shared/styles/utilities.css";
import "./shared/styles/overrides.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
