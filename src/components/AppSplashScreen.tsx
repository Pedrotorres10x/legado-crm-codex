import { useEffect, useState } from "react";

export default function AppSplashScreen() {
  const [exiting, setExiting] = useState(false);

  // After 2.5s start the fade-out so the transition to the app is smooth
  useEffect(() => {
    const t = setTimeout(() => setExiting(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#1a1f36",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        animation: exiting ? "splash-fade-out 0.6s ease-in-out forwards" : undefined,
      }}
    >
      {/* Logo + branding */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          animation: "splash-logo-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* House icon */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
            border: "1px solid rgba(212,175,55,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 40px -8px rgba(212,175,55,0.4)",
          }}
        >
          <img
            src="/assets/icon-only.png"
            alt="Legado CRM"
            style={{ width: 64, height: 64, objectFit: "contain" }}
            onError={(e) => {
              // Fallback: show a simple house emoji if image fails
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.innerHTML = '<span style="font-size:48px">🏠</span>';
              }
            }}
          />
        </div>

        {/* Name */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#D4AF37",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Legado CRM
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 14,
              color: "rgba(180,185,210,0.7)",
              margin: "8px 0 0",
              letterSpacing: "0.02em",
            }}
          >
            Tu inmobiliaria, siempre contigo
          </p>
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: "env(safe-area-inset-bottom, 48px)",
          left: "15%",
          right: "15%",
          height: 3,
          borderRadius: 100,
          background: "rgba(212,175,55,0.15)",
          overflow: "hidden",
          animation: "splash-logo-in 1s ease both",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 100,
            background: "linear-gradient(90deg, #D4AF37, #F5D26E)",
            animation: "splash-progress 2.2s cubic-bezier(0.4, 0, 0.2, 1) both",
            boxShadow: "0 0 8px rgba(212,175,55,0.6)",
          }}
        />
      </div>
    </div>
  );
}
