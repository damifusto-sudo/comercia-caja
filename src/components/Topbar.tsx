"use client";

import { useEffect, useState } from "react";

export default function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("es-AR", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="cx-topbar">
      <span className="cx-tick" />
      <h1 className="cx-title">{title}</h1>
      {subtitle && <span className="cx-subtitle">{subtitle}</span>}
      <div style={{ flex: 1 }} />
      <span className="cx-clock">
        <span className="cx-live-dot" />
        {clock}
      </span>
    </header>
  );
}
