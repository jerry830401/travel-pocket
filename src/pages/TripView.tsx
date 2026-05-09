import { useEffect, useState } from "react";
import { Outlet, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import type { Trip } from "../types";
import { useTheme } from "../contexts/ThemeContext";

const TripView = () => {
  const { tripId } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/trips.json`)
      .then((r) => r.json())
      .then((data: Trip[]) => {
        const found = data.find((t) => t.id === tripId);
        if (found) setTrip(found);
      });
  }, [tripId]);

  // Redirect to schedule if on base trip path
  useEffect(() => {
    if (trip && !location.pathname.includes("/schedule") && !location.pathname.includes("/shops") && !location.pathname.includes("/info")) {
      navigate(`/trip/${tripId}/schedule`, { replace: true });
    }
  }, [trip, location.pathname, tripId, navigate]);

  const activeTab = location.pathname.includes("/shops")
    ? "shops"
    : location.pathname.includes("/info")
    ? "info"
    : "schedule";

  if (!trip)
    return (
      <div className="p-10 text-center font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.2rem" }}>
        載入中...
      </div>
    );

  const tabs = [
    { key: "schedule", label: "日程" },
    { key: "shops",    label: "購物" },
    { key: "info",     label: "資訊" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="shrink-0 px-4 pb-3 pt-safe z-30 flex items-center gap-3"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        <Link
          to="/"
          className="shrink-0 flex items-center justify-center font-hand transition-all duration-150"
          style={{
            width: 34, height: 34, borderRadius: "50%",
            border: "1.5px solid var(--ink)",
            background: "transparent", color: "var(--ink)", fontSize: 22,
            textDecoration: "none",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(0)"; }}
        >
          ‹
        </Link>
        <div className="flex-1 min-w-0">
          <div
            className="font-hand font-bold truncate"
            style={{ fontSize: "1.75rem", letterSpacing: "-0.01em", color: "var(--ink)", lineHeight: 1 }}
          >
            {trip.name}
          </div>
          <div className="font-hand" style={{ fontSize: ".95rem", color: "var(--ink-soft)", marginTop: 2 }}>
            {trip.startDate} → {trip.endDate}
          </div>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="切換主題"
          className="shrink-0 flex items-center justify-center font-hand transition-all duration-150 hover:rotate-[-10deg]"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1.5px dashed var(--ink)",
            background: "transparent", color: "var(--ink)", fontSize: 18,
          }}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto scrollbar-hide overscroll-y-contain">
        <Outlet context={{ trip }} />
      </main>

      {/* Bottom nav */}
      <nav
        className="shrink-0 flex justify-around px-2 pb-3 pt-2.5 z-30"
        style={{ background: "var(--paper)", borderTop: "1.5px dashed var(--rule)" }}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <Link
              key={t.key}
              to={`/trip/${tripId}/${t.key}`}
              className="font-hand font-bold transition-all duration-150"
              style={{
                background: isActive ? "var(--ink)" : "transparent",
                color: isActive ? "var(--paper)" : "var(--ink)",
                padding: "5px 16px",
                borderRadius: 16,
                fontSize: "1.15rem",
                transform: isActive ? "rotate(-1.5deg)" : "none",
                boxShadow: isActive ? "2px 2px 0 var(--rule)" : "none",
                textDecoration: "none",
                border: "none",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default TripView;
