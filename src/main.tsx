import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const ensureViewportMeta = () => {
  const viewport = document.querySelector('meta[name="viewport"]') ?? document.createElement('meta');
  viewport.setAttribute('name', 'viewport');
  viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');

  if (!viewport.parentNode) {
    document.head.appendChild(viewport);
  }
};

ensureViewportMeta();

createRoot(document.getElementById("root")!).render(<App />);
