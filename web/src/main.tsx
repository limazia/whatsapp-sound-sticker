import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app";
import "@/styles/globals.css";

const app = document.getElementById("app");
if (!app) throw new Error("Elemento #app ausente.");

createRoot(app).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
