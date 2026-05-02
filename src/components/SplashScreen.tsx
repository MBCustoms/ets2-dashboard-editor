import { useEffect, useState } from "react";

const SHOW_MS = 3800;
const FADE_MS = 600;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SHOW_MS);
    const doneTimer = setTimeout(() => onDone(), SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 50% 40%, #0f172a 0%, #020617 60%)",
        overflow: "hidden",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {/* Glow background */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          background:
            "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "pulseGlow 3s ease-in-out infinite",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          zIndex: 2,
          userSelect: "none",
        }}
      >
        {/* Animated Truck */}
        <div
          style={{
            fontSize: 72,
            animation: "float 2.5s ease-in-out infinite",
            filter: "drop-shadow(0 0 20px rgba(16,185,129,0.6))",
          }}
        >
          🚛
        </div>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              background:
                "linear-gradient(90deg, #10b981, #22c55e, #4ade80)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.03em",
            }}
          >
            ETS2 Dashboard Editor
          </h1>

          <p
            style={{
              marginTop: 6,
              color: "#64748b",
              fontSize: 12,
              letterSpacing: "0.08em",
            }}
          >
            by Metehan BİLAL
          </p>
        </div>

        {/* Animated Progress */}
        <div
          style={{
            width: 220,
            height: 4,
            background: "#1e293b",
            borderRadius: 999,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              background:
                "linear-gradient(90deg, #059669, #10b981, #34d399)",
              animation: `progress ${SHOW_MS}ms cubic-bezier(.4,0,.2,1) forwards`,
              boxShadow: "0 0 12px rgba(16,185,129,0.7)",
            }}
          />
        </div>

        {/* Loading text */}
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "#475569",
            letterSpacing: "0.2em",
            animation: "fadeText 1.5s ease-in-out infinite",
          }}
        >
          LOADING
        </p>
      </div>

      <style>{`
        @keyframes progress {
          from { transform: scaleX(0); transform-origin: left; }
          to   { transform: scaleX(1); transform-origin: left; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        @keyframes fadeText {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}