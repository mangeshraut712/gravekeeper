import { ImageResponse } from "next/og";
import { siteUrl, themeColor } from "@/shared/site";

// Shared renderer for opengraph-image.tsx and twitter-image.tsx (1200x630 PNG).
// Drawn from the app's own palette and tombstone mark; no external images or fonts.
export const shareImageSize = { width: 1200, height: 630 };
export const shareImageAlt =
  "Gravekeeper: a tombstone mark on a dark graveyard background with the line 'Good code deserves a second life.'";

export function renderShareImage() {
  const host = new URL(siteUrl).host;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: themeColor,
          color: "#e7e5e4",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {/* Moon glow, as on the home page */}
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -140,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(234,199,127,0.20) 0%, rgba(234,199,127,0) 70%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
              <path
                d="M7 27V13a9 9 0 0 1 18 0v14M3 27h26M12 13h8M16 9v9"
                stroke="#fde68a"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path d="M11 22h10" stroke="#fde68a" strokeWidth="1.5" />
            </svg>
            <div style={{ fontSize: 40, letterSpacing: 1, color: "#f5f5f4" }}>
              Gravekeeper
            </div>
          </div>
          <div
            style={{
              marginTop: 64,
              fontSize: 22,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: "#fde68a",
            }}
          >
            Digital archaeology for the living web
          </div>
          <div
            style={{
              marginTop: 22,
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              lineHeight: 1.06,
              color: "#f5f5f4",
            }}
          >
            <span>Good code deserves</span>
            <span style={{ color: "#fde68a" }}>a second life.</span>
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              gap: 28,
              fontSize: 24,
              color: "#a8a29e",
            }}
          >
            <span>Archive snapshots</span>
            <span>·</span>
            <span>Revival plans</span>
            <span>·</span>
            <span>Signed receipts</span>
          </div>
          <div style={{ marginTop: 14, fontSize: 22, color: "#a8a29e" }}>
            {host}
          </div>
        </div>
        {/* Tombstone, echoing the home page illustration */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            width: 300,
          }}
        >
          <div
            style={{
              width: 230,
              height: 330,
              borderTopLeftRadius: 115,
              borderTopRightRadius: 115,
              border: "2px solid #8a7956",
              background: "linear-gradient(180deg, #302e28 0%, #151714 100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 92,
            }}
          >
            <div style={{ fontSize: 34, color: "#dfc58c" }}>R.I.P.</div>
            <div
              style={{
                marginTop: 14,
                width: 90,
                height: 2,
                background: "#70654c",
              }}
            />
            <div style={{ marginTop: 26, fontSize: 20, color: "#bab5a3" }}>
              last commit
            </div>
            <div style={{ marginTop: 8, fontSize: 26, color: "#e7dec9" }}>
              not the end.
            </div>
          </div>
        </div>
      </div>
    ),
    shareImageSize,
  );
}
