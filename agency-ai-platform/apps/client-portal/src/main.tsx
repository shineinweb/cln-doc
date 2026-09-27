import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { webEnv } from "./env";
import "./styles.css";

document.documentElement.dataset.apiUrl = webEnv.VITE_API_URL;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
