import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { Trip, InfoItem } from "../types";

const EXT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const Info = () => {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const [items, setItems] = useState<InfoItem[]>([]);

  useEffect(() => {
    if (!trip) return;
    fetch(`${import.meta.env.BASE_URL}data/${trip.id}/info.json`)
      .then((r) => r.json())
      .then(setItems)
      .catch(console.error);
  }, [trip]);

  return (
    <div style={{ padding: "18px 18px 84px", background: "var(--bg)" }}>
      <div className="font-hand font-bold mb-3.5" style={{ fontSize: "1.6rem", color: "var(--ink)" }}>
        小筆記
      </div>

      {items.length === 0 && (
        <div className="text-center py-10 font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.2rem" }}>
          載入資訊中...
        </div>
      )}

      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            background: "var(--paper)",
            border: "1px solid color-mix(in srgb, var(--rule) 55%, transparent)",
            borderRadius: 12,
            marginBottom: 14,
            overflow: "hidden",
            boxShadow: "2px 2px 0 var(--rule)",
            transform: i % 2 === 0 ? "rotate(-.2deg)" : "rotate(.2deg)",
          }}
        >
          {/* Card header */}
          <div
            className="flex items-center gap-3.5 px-4 py-3.5"
            style={{ borderBottom: "1.5px dashed var(--rule)" }}
          >
            <div
              className="flex items-center justify-center font-hand font-bold shrink-0"
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "var(--yel-soft)", color: "#7a5a20",
                fontSize: 18,
                boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.5)",
                transform: "rotate(-3deg)",
              }}
            >
              {item.icon}
            </div>
            <div className="font-hand font-bold" style={{ fontSize: "1.4rem", lineHeight: 1, color: "var(--ink)" }}>
              {item.title}
            </div>
          </div>

          {/* Links */}
          {item.links.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between transition-all duration-150"
              style={{
                padding: "12px 18px",
                fontSize: ".92rem",
                color: "var(--ink)",
                textDecoration: "none",
                borderBottom: idx < item.links.length - 1 ? "1px dashed var(--rule)" : "none",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--paper-2)";
                (e.currentTarget as HTMLElement).style.color = "var(--red)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--ink)";
              }}
            >
              <span>{link.label}</span>
              <span style={{ color: "var(--ink-faint)" }}>{EXT}</span>
            </a>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Info;
