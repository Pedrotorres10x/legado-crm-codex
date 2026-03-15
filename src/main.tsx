import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { environmentSafety, shouldBlockLocalProdBackend } from "./lib/environment.ts";
import AppErrorBoundary from "./components/AppErrorBoundary.tsx";

const root = createRoot(document.getElementById("root")!);

const clearLocalServiceWorkers = () => {
  if (typeof window === "undefined") return;
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!isLocalhost || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);

  if ("caches" in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined);
  }
};

clearLocalServiceWorkers();

if (shouldBlockLocalProdBackend) {
  root.render(
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f7f5ef", color: "#1f2937", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: "720px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.08)" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b45309", margin: 0 }}>
          Safety Lock
        </p>
        <h1 style={{ margin: "10px 0 12px", fontSize: "28px", lineHeight: 1.1 }}>
          El entorno local está apuntando al Supabase de producción
        </h1>
        <p style={{ margin: "0 0 16px", fontSize: "16px", lineHeight: 1.6 }}>
          Para evitar tocar datos reales del CRM de la inmobiliaria por accidente, la aplicación se ha bloqueado en <code>localhost</code>.
        </p>
        <p style={{ margin: "0 0 8px", fontSize: "14px" }}>
          Proyecto detectado: <code>{environmentSafety.projectId}</code>
        </p>
        <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6 }}>
          Solución recomendada: crea un <code>.env.local</code> con un proyecto Supabase de pruebas. Solo si quieres asumir el riesgo conscientemente, añade <code>VITE_ALLOW_PROD_BACKEND_ON_LOCAL=true</code> de forma temporal.
        </p>
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
          Esta barrera solo protege el entorno local. No afecta al CRM en producción.
        </p>
      </div>
    </div>,
  );
} else {
  root.render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
}
