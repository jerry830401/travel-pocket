import { useEffect, useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import type { Trip, ItineraryDay, ItineraryItem } from "../types";
import { motion, AnimatePresence } from "framer-motion";

/* Category sticker data */
const CATS: Record<string, { g: string; cls: string; l: string }> = {
  planeTakeoff: { g: "✈",  cls: "st-pl", l: "出發" },
  planeLanding: { g: "🛬", cls: "st-pl", l: "抵達" },
  train:        { g: "🚆", cls: "st-tr", l: "交通" },
  bus:          { g: "🚌", cls: "st-tr", l: "巴士" },
  ship:         { g: "⛴",  cls: "st-tr", l: "渡船" },
  car:          { g: "🚗", cls: "st-tr", l: "自駕" },
  hotel:        { g: "住",  cls: "st-ht", l: "住宿" },
  food:         { g: "食",  cls: "st-fd", l: "餐廳" },
  sightseeing:  { g: "⛩",  cls: "st-sg", l: "景點" },
};
const CDEF = { g: "·", cls: "st-xx", l: "其他" };
function gc(k: string) { return CATS[k] ?? CDEF; }

function toMins(s: string | undefined) {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function gapLabel(diff: number | null) {
  if (!diff || diff <= 0) return null;
  const h = Math.floor(diff / 60), m = diff % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
function dateBig(d: string) { const [,mo,dy] = d.split("-"); return `${mo} / ${dy}`; }
function weekday(d: string) {
  return ["SUN","MON","TUE","WED","THU","FRI","SAT"][new Date(d).getDay()];
}
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const PIN_SVG = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const PIN_L = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const CLK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const EXT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const dayVariants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
};

const Schedule = () => {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [dayIdx, setDayIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedItem, setSelectedItem] = useState<{ item: ItineraryItem; day: ItineraryDay } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const dayBarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const today = getTodayStr();

  useEffect(() => {
    if (!trip) return;
    fetch(`${import.meta.env.BASE_URL}data/${trip.id}/itinerary.json`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: ItineraryDay[]) => {
        setDays(data);
        const ti = data.findIndex((d) => d.date === today);
        if (ti >= 0) setDayIdx(ti);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [trip, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll active day pill into view
  useEffect(() => {
    const bar = dayBarRef.current;
    if (!bar || !days.length) return;
    const btn = bar.children[dayIdx] as HTMLElement | undefined;
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [dayIdx, days.length]);

  const goToDay = (idx: number) => {
    setDirection(idx >= dayIdx ? 1 : -1);
    setDayIdx(idx);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (selectedItem) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 50) {
      if (dx < 0 && dayIdx < days.length - 1) goToDay(dayIdx + 1);
      else if (dx > 0 && dayIdx > 0) goToDay(dayIdx - 1);
    }
  };

  const todayIdx = days.findIndex((d) => d.date === today);
  const currentDay = days[dayIdx];

  const handleRetry = () => {
    setLoading(true);
    setError(false);
    setRetry((r) => r + 1);
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 font-hand" style={{ color: "var(--ink-soft)" }}>
      <span style={{ fontSize: "2.4rem" }}>😵</span>
      <p style={{ fontSize: "1.1rem" }}>行程載入失敗</p>
      <button
        onClick={handleRetry}
        className="font-hand font-bold"
        style={{
          padding: "6px 22px", borderRadius: 18,
          border: "1.5px solid var(--ink)",
          background: "var(--ink)", color: "var(--paper)",
          fontSize: "1rem", cursor: "pointer",
        }}
      >
        重試
      </button>
    </div>
  );

  return (
    <div
      className="relative min-h-full lined-bg"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Day bar */}
      <div
        className="sticky top-0 z-10 flex items-center"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        <div
          ref={dayBarRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 px-3.5 py-3"
        >
          {loading
            ? [...Array(5)].map((_, i) => (
                <div key={i} className="skeleton shrink-0" style={{ width: 76, height: 32, borderRadius: 18 }} />
              ))
            : days.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => goToDay(i)}
                  className="font-hand font-bold whitespace-nowrap shrink-0 transition-all duration-150"
                  style={{
                    fontSize: "1.05rem",
                    padding: "4px 14px",
                    borderRadius: 18,
                    border: "1.5px solid var(--ink)",
                    background: i === dayIdx ? "var(--ink)" : "transparent",
                    color: i === dayIdx ? "var(--paper)" : "var(--ink)",
                    cursor: "pointer",
                    transform: i === dayIdx ? "rotate(-2deg)" : "none",
                    boxShadow: i === dayIdx ? "2px 2px 0 var(--red)" : "none",
                  }}
                >
                  <span>Day {d.day}</span>
                  <span style={{ fontSize: ".85em", opacity: .65, marginLeft: 4 }}>{d.date.slice(5)}</span>
                </button>
              ))
          }
        </div>
        {/* 今天 quick-jump button */}
        {!loading && todayIdx >= 0 && todayIdx !== dayIdx && (
          <button
            onClick={() => goToDay(todayIdx)}
            className="shrink-0 font-hand font-bold mr-3"
            style={{
              padding: "4px 12px",
              borderRadius: 18,
              border: "1.5px dashed var(--red)",
              background: "var(--red-soft)",
              color: "var(--red)",
              fontSize: ".9rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            今天
          </button>
        )}
      </div>

      {/* Date stamp */}
      {loading ? (
        <div className="flex items-baseline gap-3.5 px-4 pt-3.5 pb-1.5">
          <div className="skeleton" style={{ width: 120, height: 38, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 88, height: 14, borderRadius: 4 }} />
        </div>
      ) : currentDay && (
        <div className="flex items-baseline gap-3.5 px-4 pt-3.5 pb-1.5">
          <span className="font-hand font-bold" style={{ fontSize: "2.4rem", letterSpacing: "-0.01em", lineHeight: 1, color: "var(--ink)" }}>
            {dateBig(currentDay.date)}
          </span>
          <span className="font-mono" style={{ fontSize: ".7rem", color: "var(--ink-soft)", letterSpacing: ".18em" }}>
            {weekday(currentDay.date)} · DAY {currentDay.day}
          </span>
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div style={{ padding: "8px 18px 84px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{
              height: 70,
              borderRadius: 10,
              marginBottom: 12,
              transform: i % 2 === 0 ? "rotate(-.4deg)" : "rotate(.4deg)",
            }} />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={dayIdx}
            custom={direction}
            variants={dayVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ padding: "8px 18px 84px" }}
          >
            {!currentDay && (
              <div className="text-center py-10 font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.2rem" }}>
                無行程資料
              </div>
            )}

            {currentDay?.items.map((item, j) => {
              const cat = gc(item.category);
              const next = currentDay.items[j + 1];
              const gap = next ? gapLabel((toMins(next.startTime) ?? 0) - (toMins(item.endTime) ?? 0)) : null;
              const rot = j % 2 === 0 ? "rotate(-.4deg)" : "rotate(.4deg)";

              return (
                <div key={item.id}>
                  <div
                    onClick={() => setSelectedItem({ item, day: currentDay })}
                    className="cursor-pointer transition-all duration-200"
                    style={{
                      position: "relative",
                      background: "var(--paper)",
                      border: "1px solid color-mix(in srgb, var(--rule) 55%, transparent)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      boxShadow: "0 1px 2px rgba(40,30,20,.06),2px 2px 0 var(--rule)",
                      transform: rot,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = "rotate(0) translateY(-2px)";
                      el.style.boxShadow = "3px 3px 0 var(--red),0 4px 12px rgba(40,30,20,.1)";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = rot;
                      el.style.boxShadow = "0 1px 2px rgba(40,30,20,.06),2px 2px 0 var(--rule)";
                    }}
                  >
                    {/* Time */}
                    <div className="shrink-0 text-center" style={{ minWidth: 54 }}>
                      <div className="font-mono font-semibold" style={{ fontSize: ".95rem", color: "var(--ink)", letterSpacing: ".02em" }}>
                        {item.startTime || "—"}
                      </div>
                      {item.endTime && (
                        <>
                          <div style={{ width: 1.5, height: 14, background: "var(--rule)", margin: "5px auto" }} />
                          <div className="font-mono" style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>{item.endTime}</div>
                        </>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-hand font-bold truncate" style={{ fontSize: "1.4rem", lineHeight: 1.1, color: "var(--ink)" }}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                        <span style={{ color: "var(--ink-faint)", flexShrink: 0 }}>{PIN_SVG}</span>
                        <span className="truncate">{item.location}</span>
                      </div>
                    </div>
                    {/* Sticker */}
                    <div
                      className={`shrink-0 flex items-center justify-center font-hand font-bold ${cat.cls}`}
                      style={{ width: 38, height: 38, borderRadius: "50%", fontSize: 18, transform: "rotate(-4deg)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.5),0 1.5px 3px rgba(40,30,20,.18)" }}
                    >
                      {cat.g}
                    </div>
                  </div>

                  {/* Gap pill */}
                  {gap && (
                    <div className="flex justify-center py-0.5 mb-3">
                      <span
                        className="font-hand inline-flex items-center gap-1.5"
                        style={{
                          fontSize: ".95rem", color: "var(--ink-soft)",
                          padding: "1px 12px",
                          border: "1.5px dashed var(--rule)",
                          borderRadius: 999,
                          background: "var(--paper)",
                          transform: "rotate(-1deg)",
                        }}
                      >
                        {CLK} {gap}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(40,30,20,.4)", backdropFilter: "blur(5px)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 mx-auto z-50 overflow-y-auto scrollbar-hide"
              style={{
                maxWidth: 480,
                maxHeight: "85vh",
                background: "var(--paper)",
                borderRadius: "24px 24px 0 0",
                borderTop: "2px dashed var(--rule)",
                boxShadow: "0 -8px 40px rgba(40,30,20,.18)",
                padding: "22px 22px 28px",
              }}
            >
              {/* Handle */}
              <div style={{ width: 48, height: 4, background: "var(--rule)", borderRadius: 2, margin: "0 auto 18px" }} />
              {/* Close */}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-[18px] right-[18px] flex items-center justify-center font-hand"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  border: "1.5px solid var(--ink)",
                  background: "var(--paper)", color: "var(--ink)", fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ×
              </button>

              {/* Eyebrow */}
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={`flex items-center justify-center font-hand font-bold ${gc(selectedItem.item.category).cls}`}
                  style={{ width: 30, height: 30, borderRadius: "50%", fontSize: 14 }}
                >
                  {gc(selectedItem.item.category).g}
                </div>
                <span className="font-mono uppercase" style={{ fontSize: ".7rem", color: "var(--ink-soft)", letterSpacing: ".2em" }}>
                  {gc(selectedItem.item.category).l}
                </span>
              </div>

              {/* Title */}
              <h2 className="font-hand font-bold mb-4" style={{ fontSize: "2rem", letterSpacing: "-0.01em", lineHeight: 1.1, color: "var(--ink)" }}>
                {selectedItem.item.title}
              </h2>

              {/* Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div style={{ padding: "12px 14px", background: "var(--paper-2)", border: "1px dashed var(--rule)", borderRadius: 8 }}>
                  <div className="font-mono uppercase" style={{ fontSize: ".65rem", letterSpacing: ".18em", color: "var(--ink-soft)" }}>時間</div>
                  <div className="font-hand font-bold mt-0.5" style={{ fontSize: "1.3rem", lineHeight: 1.2, color: "var(--ink)" }}>
                    {selectedItem.item.startTime || "—"}{selectedItem.item.endTime ? ` – ${selectedItem.item.endTime}` : ""}
                  </div>
                </div>
                <div style={{ padding: "12px 14px", background: "var(--paper-2)", border: "1px dashed var(--rule)", borderRadius: 8 }}>
                  <div className="font-mono uppercase" style={{ fontSize: ".65rem", letterSpacing: ".18em", color: "var(--ink-soft)" }}>第幾天</div>
                  <div className="font-hand font-bold mt-0.5" style={{ fontSize: "1.3rem", lineHeight: 1.2, color: "var(--ink)" }}>
                    Day {selectedItem.day.day}
                  </div>
                </div>
              </div>

              {/* Map */}
              <div className="font-mono uppercase mb-2" style={{ fontSize: ".65rem", letterSpacing: ".18em", color: "var(--ink-soft)" }}>地點資訊</div>
              <a
                href={
                  selectedItem.item.googleMapLink ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedItem.item.location)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="font-hand font-bold flex items-center justify-between mb-4 transition-all duration-150 hover:-translate-y-0.5"
                style={{
                  padding: "14px 16px",
                  background: "var(--red-soft)",
                  border: "1.5px dashed var(--red)",
                  borderRadius: 10,
                  color: "var(--red)",
                  textDecoration: "none",
                  fontSize: "1.1rem",
                }}
              >
                <span className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span style={{ flexShrink: 0, color: "var(--red)" }}>{PIN_L}</span>
                  <span className="truncate">{selectedItem.item.location}</span>
                </span>
                <span>{EXT}</span>
              </a>

              {/* Notes */}
              {selectedItem.item.description && (Array.isArray(selectedItem.item.description) ? selectedItem.item.description.length > 0 : true) && (
                <>
                  <div className="font-mono uppercase mb-2" style={{ fontSize: ".65rem", letterSpacing: ".18em", color: "var(--ink-soft)" }}>備忘錄</div>
                  <div style={{ background: "var(--paper-2)", border: "1px dashed var(--rule)", borderRadius: 10, padding: "14px 18px", fontSize: ".9rem", color: "var(--ink-soft)", lineHeight: 1.7 }}>
                    {Array.isArray(selectedItem.item.description) ? (
                      <ol className="list-decimal list-inside space-y-1">
                        {selectedItem.item.description.map((d, i) => <li key={i}>{d}</li>)}
                      </ol>
                    ) : (
                      selectedItem.item.description
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Schedule;
