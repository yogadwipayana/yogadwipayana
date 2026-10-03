import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { Logo } from "@/components/ui/Logo";

export const alt =
  "Yoga — AI Router, Chat, VPS, and Image tools behind one key";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#3ecf8e";
const BG = "#1c1c1c";

export default async function OpengraphImage() {
  // Satori cannot fetch relative URLs, so the backdrop is inlined. This route
  // is prerendered at build time, so the read happens once, not per request.
  const backdrop = await readFile(
    join(process.cwd(), "public", "images", "og", "backdrop.jpg"),
  );
  const backdropSrc = `data:image/jpeg;base64,${backdrop.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 72,
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backdropSrc}
          alt=""
          width={size.width}
          height={size.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        />

        {/* Scrim: keeps the headline legible where the glow brightens the right. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            background:
              "linear-gradient(100deg, rgba(18,18,18,0.88) 12%, rgba(18,18,18,0.58) 52%, rgba(18,18,18,0.02) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            position: "relative",
          }}
        >
          <Logo width={46} height={46} />
          <div style={{ fontSize: 34, color: "#ffffff", fontWeight: 600 }}>
            Yoga
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 26,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 68,
              lineHeight: 1.1,
              color: "#ffffff",
              fontWeight: 700,
              letterSpacing: -1.5,
              maxWidth: 880,
            }}
          >
            AI Router, Chat, VPS &amp; Image tools in one hub
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.6)",
              maxWidth: 840,
            }}
          >
            One OpenAI-compatible key for GPT and Claude. Pay as you go, built
            and run in the open.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${GREEN}59`,
              background: `${GREEN}1a`,
              color: GREEN,
              fontSize: 24,
            }}
          >
            yogathedev.com
          </div>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.4)" }}>
            Pay as you go · No subscription
          </div>
        </div>
      </div>
    ),
    size,
  );
}
