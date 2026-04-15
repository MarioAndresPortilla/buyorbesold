"use client";

import { useEffect, useState } from "react";
import type { MarketData, Ticker } from "@/lib/types";
import TickerTape from "./TickerTape";

interface GlobalTickerTapeProps {
  /** Optional server-fetched snapshot — avoids a client fetch on first paint. */
  initialData?: MarketData;
}

function extractTape(data: MarketData): Ticker[] {
  return [
    data.sp500,
    data.bitcoin,
    data.gold,
    data.silver,
    data.crude,
    data.natgas,
    data.copper,
    data.qqq,
    data.voo,
    data.vti,
    data.dia,
    data.dxy,
    data.tnx,
  ];
}

export default function GlobalTickerTape({ initialData }: GlobalTickerTapeProps) {
  const [tickers, setTickers] = useState<Ticker[]>(
    initialData ? extractTape(initialData) : []
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/markets", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MarketData;
        if (!cancelled) setTickers(extractTape(data));
      } catch {
        // ignore; keep whatever we had
      }
    };
    if (!initialData) load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [initialData]);

  if (tickers.length === 0) return null;
  return <TickerTape tickers={tickers} />;
}
