import { cn } from "@/lib/utils"

const GOLD = "#c8a96e"
const CREME = "#e8e4dc"
const DARK = "#1a1a1f"
const NACHT = "#0d0d0f"

export function Logo({
  variant = "dark",
  className,
}: {
  variant?: "dark" | "light"
  className?: string
}) {
  const tableColor = variant === "dark" ? CREME : DARK
  const textColor = variant === "dark" ? CREME : DARK
  const mutedColor = variant === "dark" ? "rgba(232,228,220,0.5)" : "rgba(26,26,31,0.5)"
  const dotColor = variant === "dark" ? "rgba(232,228,220,0.15)" : "rgba(26,26,31,0.15)"

  return (
    <svg
      viewBox="0 0 240 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-9", className)}
      aria-label="Platzhalter"
    >
      {/* Table surface */}
      <rect
        x={8}
        y={18}
        width={40}
        height={26}
        rx={4}
        fill={tableColor}
        fillOpacity={0.12}
        stroke={tableColor}
        strokeWidth={1.5}
        strokeOpacity={0.3}
      />

      {/* Dot grid on table */}
      {[16, 24, 32, 40].map((cx) =>
        [26, 32, 38].map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.8} fill={dotColor} />
        ))
      )}

      {/* Seats - top row */}
      {/* Top-left seat - highlighted in gold */}
      <rect x={12} y={10} width={10} height={5} rx={2} fill={GOLD} />
      {/* Person silhouette on highlighted seat */}
      <circle cx={17} cy={11.5} r={1.2} fill={NACHT} fillOpacity={0.6} />
      <rect x={15.5} y={13} width={3} height={1.5} rx={0.75} fill={NACHT} fillOpacity={0.4} />

      {/* Top-right seat */}
      <rect x={34} y={10} width={10} height={5} rx={2} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={1} strokeOpacity={0.2} />

      {/* Bottom-left seat */}
      <rect x={12} y={47} width={10} height={5} rx={2} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={1} strokeOpacity={0.2} />

      {/* Bottom-right seat */}
      <rect x={34} y={47} width={10} height={5} rx={2} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={1} strokeOpacity={0.2} />

      {/* Left seat */}
      <rect x={0} y={25} width={5} height={10} rx={2} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={1} strokeOpacity={0.2} />

      {/* Right seat */}
      <rect x={51} y={25} width={5} height={10} rx={2} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={1} strokeOpacity={0.2} />

      {/* Vertical divider */}
      <line x1={68} y1={16} x2={68} y2={56} stroke={tableColor} strokeOpacity={0.15} strokeWidth={1} />

      {/* Wordmark */}
      <text
        x={78}
        y={38}
        fontFamily="'DM Serif Display', serif"
        fontSize={22}
        fill={textColor}
        letterSpacing={0.5}
      >
        Platzhalter
      </text>

      {/* Tagline */}
      <text
        x={78}
        y={52}
        fontFamily="'IBM Plex Mono', monospace"
        fontSize={7.5}
        fill={mutedColor}
        letterSpacing={2.5}
      >
        SITZPLAN · VERWALTUNG
      </text>
    </svg>
  )
}

export function LogoIcon({ className }: { className?: string }) {
  const tableColor = CREME

  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8", className)}
      aria-label="Platzhalter"
    >
      {/* Background */}
      <rect width={56} height={56} rx={12} fill={NACHT} />

      {/* Table surface */}
      <rect
        x={12}
        y={18}
        width={32}
        height={20}
        rx={3}
        fill={tableColor}
        fillOpacity={0.12}
        stroke={tableColor}
        strokeWidth={1.2}
        strokeOpacity={0.3}
      />

      {/* Dot grid on table */}
      {[20, 28, 36].map((cx) =>
        [25, 31].map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.7} fill="rgba(232,228,220,0.15)" />
        ))
      )}

      {/* Seats - top row */}
      {/* Top-left seat - highlighted */}
      <rect x={15} y={10} width={8} height={5} rx={1.5} fill={GOLD} />
      <circle cx={19} cy={11.5} r={1} fill={NACHT} fillOpacity={0.6} />
      <rect x={17.8} y={12.8} width={2.4} height={1.2} rx={0.6} fill={NACHT} fillOpacity={0.4} />

      {/* Top-right seat */}
      <rect x={33} y={10} width={8} height={5} rx={1.5} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={0.8} strokeOpacity={0.2} />

      {/* Bottom-left seat */}
      <rect x={15} y={41} width={8} height={5} rx={1.5} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={0.8} strokeOpacity={0.2} />

      {/* Bottom-right seat */}
      <rect x={33} y={41} width={8} height={5} rx={1.5} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={0.8} strokeOpacity={0.2} />

      {/* Left seat */}
      <rect x={4} y={23} width={5} height={8} rx={1.5} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={0.8} strokeOpacity={0.2} />

      {/* Right seat */}
      <rect x={47} y={23} width={5} height={8} rx={1.5} fill={tableColor} fillOpacity={0.2} stroke={tableColor} strokeWidth={0.8} strokeOpacity={0.2} />
    </svg>
  )
}
