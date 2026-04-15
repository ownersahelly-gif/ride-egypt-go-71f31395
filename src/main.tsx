import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const lockViewportZoom = () => {
  const viewport = document.querySelector('meta[name="viewport"]') ?? document.createElement('meta');
  viewport.setAttribute('name', 'viewport');
  viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');

  if (!viewport.parentNode) {
    document.head.appendChild(viewport);
  }

  const preventGesture = (event: Event) => event.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
    document.addEventListener(eventName, preventGesture, { passive: false });
  });

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  document.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    },
    { passive: false }
  );
};

lockViewportZoom();

createRoot(document.getElementById("root")!).render(<App />);
