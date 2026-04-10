import type { MacroEvent } from "@/lib/types";

const DEFAULT_EVENTS: MacroEvent[] = [
  {
    day: "MON",
    time: "10:00 ET",
    name: "Wholesale Inventories",
    previous: "0.5%",
    estimate: "0.3%",
    impact: "LOW",
  },
  {
    day: "TUE",
    time: "08:30 ET",
    name: "PPI (Core, MoM)",
    previous: "0.2%",
    estimate: "0.2%",
    impact: "MED",
  },
  {
    day: "WED",
    time: "08:30 ET",
    name: "CPI (Headline, YoY)",
    previous: "3.1%",
    estimate: "3.0%",
    impact: "HIGH",
  },
  {
    day: "WED",
    time: "14:00 ET",
    name: "FOMC Minutes",
    previous: "—",
    estimate: "—",
    impact: "HIGH",
  },
  {
    day: "THU",
    time: "08:30 ET",
    name: "Initial Jobless Claims",
    previous: "219K",
    estimate: "225K",
    impact: "MED",
  },
  {
    day: "FRI",
    time: "10:00 ET",
    name: "U. Michigan Sentiment",
    previous: "77.2",
    estimate: "78.0",
    impact: "LOW",
  },
];

interface MacroCalendarProps {
  events?: MacroEvent[];
}

function impactClasses(impact: MacroEvent["impact"]): string {
  if (impact === "HIGH") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (impact === "MED") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
}

export default function MacroCalendar({ events }: MacroCalendarProps) {
  const list = events && events.length ? events : DEFAULT_EVENTS;
  return (
    <div className="divide-y divide-[color:var(--border)]">
      {list.map((e, i) => (
        <div
          key={`${e.day}-${e.time}-${i}`}
          className="grid grid-cols-12 items-center gap-2 py-2.5 font-mono text-[11px]"
        >
          <div className="col-span-1 font-bold text-[color:var(--accent)]">{e.day}</div>
          <div className="col-span-2 text-[color:var(--muted)]">{e.time}</div>
          <div className="col-span-5 truncate text-[color:var(--text)]">{e.name}</div>
          <div className="col-span-2 text-right text-[color:var(--muted)]">
            prev {e.previous ?? "—"}
          </div>
          <div className="col-span-2 flex justify-end">
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${impactClasses(
                e.impact
              )}`}
            >
              {e.impact}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
