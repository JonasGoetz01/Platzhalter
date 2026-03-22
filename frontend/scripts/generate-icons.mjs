import sharp from "sharp";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// SVG icon matching the LogoIcon component from src/components/logo.tsx
// Uses the same brand colors: NACHT=#0d0d0f, GOLD=#c8a96e, CREME=#e8e4dc
const svg = `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="56" height="56" rx="12" fill="#0d0d0f"/>

  <!-- Table surface -->
  <rect x="12" y="18" width="32" height="20" rx="3"
    fill="#e8e4dc" fill-opacity="0.12"
    stroke="#e8e4dc" stroke-width="1.2" stroke-opacity="0.3"/>

  <!-- Dot grid on table -->
  <circle cx="20" cy="25" r="0.7" fill="rgba(232,228,220,0.15)"/>
  <circle cx="20" cy="31" r="0.7" fill="rgba(232,228,220,0.15)"/>
  <circle cx="28" cy="25" r="0.7" fill="rgba(232,228,220,0.15)"/>
  <circle cx="28" cy="31" r="0.7" fill="rgba(232,228,220,0.15)"/>
  <circle cx="36" cy="25" r="0.7" fill="rgba(232,228,220,0.15)"/>
  <circle cx="36" cy="31" r="0.7" fill="rgba(232,228,220,0.15)"/>

  <!-- Top-left seat - highlighted in gold -->
  <rect x="15" y="10" width="8" height="5" rx="1.5" fill="#c8a96e"/>
  <circle cx="19" cy="11.5" r="1" fill="#0d0d0f" fill-opacity="0.6"/>
  <rect x="17.8" y="12.8" width="2.4" height="1.2" rx="0.6" fill="#0d0d0f" fill-opacity="0.4"/>

  <!-- Top-right seat -->
  <rect x="33" y="10" width="8" height="5" rx="1.5"
    fill="#e8e4dc" fill-opacity="0.2"
    stroke="#e8e4dc" stroke-width="0.8" stroke-opacity="0.2"/>

  <!-- Bottom-left seat -->
  <rect x="15" y="41" width="8" height="5" rx="1.5"
    fill="#e8e4dc" fill-opacity="0.2"
    stroke="#e8e4dc" stroke-width="0.8" stroke-opacity="0.2"/>

  <!-- Bottom-right seat -->
  <rect x="33" y="41" width="8" height="5" rx="1.5"
    fill="#e8e4dc" fill-opacity="0.2"
    stroke="#e8e4dc" stroke-width="0.8" stroke-opacity="0.2"/>

  <!-- Left seat -->
  <rect x="4" y="23" width="5" height="8" rx="1.5"
    fill="#e8e4dc" fill-opacity="0.2"
    stroke="#e8e4dc" stroke-width="0.8" stroke-opacity="0.2"/>

  <!-- Right seat -->
  <rect x="47" y="23" width="5" height="8" rx="1.5"
    fill="#e8e4dc" fill-opacity="0.2"
    stroke="#e8e4dc" stroke-width="0.8" stroke-opacity="0.2"/>
</svg>`;

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

const svgBuffer = Buffer.from(svg);

for (const { name, size } of sizes) {
  const outPath = join(publicDir, name);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`Created ${outPath} (${size}x${size})`);
}

console.log("Done! All PWA icons generated.");
