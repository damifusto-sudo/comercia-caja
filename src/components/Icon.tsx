const PATHS: Record<string, string> = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  cash: "M2.5 7h19v10h-19zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
  cart: "M3 4h2l2.4 12.3a1 1 0 0 0 1 .7h9.2a1 1 0 0 0 1-.8L21 8H6M9 20a1 1 0 1 0 0 .01M18 20a1 1 0 1 0 0 .01",
  box: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9",
  truck: "M2 6h11v9H2zM13 9h5l3 3v3h-8M6.5 18a1.5 1.5 0 1 0 0 .01M17.5 18a1.5 1.5 0 1 0 0 .01",
  factory: "M3 21V9l5 3V9l5 3V9l5 3v9zM3 21h18M7 21v-4M12 21v-4M17 21v-4",
  receipt: "M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21zM8 8h8M8 12h8M8 16h5",
  users: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M2.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 11.5a3 3 0 0 0 0-6M21.5 20c0-2.5-2-4.3-4.5-4.6",
  check: "M4 5h16v14H4zM4 9h16M8 14h5",
  wallet: "M3 7h15v11H3zM3 7l2.5-3h10L18 7M18 11h3v4h-3a2 2 0 0 1 0-4",
  vault: "M3 4h18v15H3zM7 19v2M17 19v2M12 8a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M12 11h.01",
  chart: "M4 20V4M4 20h16M8 20v-6M12 20V9M16 20v-9M20 20v-4",
  bars: "M4 20V4M4 20h16M8 20v-7M13 20v-11M18 20v-5",
  shield: "M12 3l8 3v6c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V6z",
  logout: "M9 21H4V3h5M16 16l4-4-4-4M20 12H9",
  book: "M5 4h13a1 1 0 0 1 1 1v15H6a1 1 0 0 1-1-1zM5 4v15M9 8h6M9 12h6",
  card: "M2.5 6h19v12h-19zM2.5 10h19",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3M20 14v6M17 20h3",
  alert: "M12 3 2 20h20zM12 10v5M12 18v.01",
  idcard: "M3 5h18v14H3zM8 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M5 16.5c0-1.7 1.4-3 3-3s3 1.3 3 3M14 9h4M14 13h4",
  refresh: "M20 11a8 8 0 0 0-14.3-4.5M4 4v3.5H7.5M4 13a8 8 0 0 0 14.3 4.5M20 20v-3.5H16.5",
  link: "M9 15l6-6M10.5 6.5 12 5a4 4 0 0 1 6 6l-1.5 1.5M13.5 17.5 12 19a4 4 0 0 1-6-6l1.5-1.5",
};

export default function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const d = PATHS[name] ?? "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d
        .split("M")
        .filter(Boolean)
        .map((seg, i) => (
          <path key={i} d={"M" + seg} />
        ))}
    </svg>
  );
}
