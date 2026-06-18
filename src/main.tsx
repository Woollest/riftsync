import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { registerServiceWorker } from "./app/registerServiceWorker";
import "./app/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
