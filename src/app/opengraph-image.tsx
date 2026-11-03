import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Phase: contrast-safe color scales. A color map from white through blue, green, yellow, red and purple to black.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MAP = 440;

// Hues left to right, like the app's hero color map; a white-to-black wash on top supplies the lightness axis.
const HUES = ["#2f6bff", "#13c4a3", "#9be22b", "#ffd21f", "#ff7a1a", "#f0364f", "#a43cf0"];

export default async function Image() {
  const lockup = await readFile(join(process.cwd(), "public/phase-lockup-white.png"));
  const lockupSrc = `data:image/png;base64,${lockup.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 90px",
          background: "linear-gradient(135deg, #0b0b10 0%, #14141d 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
          <img src={lockupSrc} width={276} height={90} alt="" />
          <div style={{ display: "flex", fontSize: 62, fontWeight: 700, lineHeight: 1.08, marginTop: 44, letterSpacing: -1.5 }}>
            Contrast-safe color scales
          </div>
          <div style={{ display: "flex", fontSize: 28, lineHeight: 1.35, marginTop: 24, color: "#a9abb8" }}>
            Shade numbers guarantee WCAG contrast, in OKLCH and Display P3.
          </div>
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            width: MAP,
            height: MAP,
            borderRadius: 72,
            overflow: "hidden",
            backgroundImage: `linear-gradient(90deg, ${HUES.join(", ")})`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: MAP,
              height: MAP,
              display: "flex",
              backgroundImage:
                "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,1) 100%)",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
