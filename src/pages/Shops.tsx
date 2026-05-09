import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import type { Trip, Shop } from "../types";

const PIN_SVG = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const CLK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const Shops = () => {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedTag, setSelectedTag] = useState("All");

  useEffect(() => {
    if (!trip) return;
    fetch(`${import.meta.env.BASE_URL}data/${trip.id}/shops.json`)
      .then((r) => r.json())
      .then(setShops);
  }, [trip]);

  const tags = useMemo(() => {
    const all = new Set(shops.flatMap((s) => s.tags));
    return ["All", ...Array.from(all)];
  }, [shops]);

  const filtered = useMemo(() => {
    if (selectedTag === "All") return shops;
    return shops.filter((s) => s.tags.includes(selectedTag));
  }, [shops, selectedTag]);

  return (
    <div style={{ background: "var(--bg)" }}>
      {/* Tag bar */}
      <div
        className="sticky top-0 z-10 flex gap-2 overflow-x-auto scrollbar-hide px-3.5 py-2.5"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        {tags.map((tag) => {
          const on = tag === selectedTag;
          return (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className="font-hand font-bold whitespace-nowrap shrink-0 transition-all duration-150"
              style={{
                fontSize: "1.05rem",
                padding: "3px 13px",
                borderRadius: 18,
                border: "1.5px solid var(--ink)",
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--paper)" : "var(--ink)",
                cursor: "pointer",
                transform: on ? "rotate(-1.5deg)" : "none",
                boxShadow: on ? "2px 2px 0 var(--blue)" : "none",
              }}
            >
              {tag === "All" ? "全部" : tag}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding: "14px 18px 84px" }}>
        {filtered.length === 0 && (
          <div className="text-center py-10 font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.2rem" }}>
            找不到相關店家
          </div>
        )}

        {filtered.map((shop, i) => {
          const rot = i % 2 === 0 ? "rotate(-.3deg)" : "rotate(.4deg)";
          return (
            <div
              key={shop.id}
              className="transition-all duration-200"
              style={{
                position: "relative",
                background: "var(--paper)",
                border: "1px solid color-mix(in srgb, var(--rule) 55%, transparent)",
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 14,
                boxShadow: "2px 2px 0 var(--rule)",
                transform: rot,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "rotate(0) translateY(-2px)";
                el.style.boxShadow = "3px 3px 0 var(--blue)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = rot;
                el.style.boxShadow = "2px 2px 0 var(--rule)";
              }}
            >
              <div className="flex justify-between items-start gap-2.5 mb-1.5">
                <div className="font-hand font-bold flex-1 min-w-0" style={{ fontSize: "1.4rem", lineHeight: 1.15, color: "var(--ink)" }}>
                  {shop.name}
                </div>
                {shop.googleMapLink && (
                  <a
                    href={shop.googleMapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center justify-center transition-all duration-150 hover:rotate-[-8deg] hover:scale-105"
                    style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: "var(--blue-soft)", color: "var(--blue)",
                      border: "1.5px solid var(--blue)",
                      textDecoration: "none",
                    }}
                  >
                    {PIN_SVG}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 mb-1" style={{ fontSize: ".82rem", color: "var(--ink-soft)" }}>
                <span style={{ color: "var(--ink-faint)", flexShrink: 0 }}>{PIN_SVG}</span>
                <span className="truncate">{shop.location}</span>
              </div>
              <div className="flex items-center gap-1.5 mb-2.5" style={{ fontSize: ".82rem", color: "var(--ink-soft)" }}>
                <span style={{ color: "var(--ink-faint)", flexShrink: 0 }}>{CLK}</span>
                <span>{shop.businessHours}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {shop.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-hand font-bold"
                    style={{
                      fontSize: ".95rem",
                      padding: "1px 10px",
                      borderRadius: 12,
                      background: "var(--paper-2)",
                      border: "1px dashed var(--rule)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Shops;
