import { useEffect, useState } from "react";
import { Outlet, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import type { Trip, TripEntry } from "../types";
import { apiEnabled, isShared, loadTrips } from "../dataSource";
import { lockedLink } from "../components/lockedLink";
import { circleBtn } from "../components/circleBtn";
import { Icon, type IconName } from "../components/icons";
import { BottomBar } from "../components/BottomBar";
import { EditingBanner } from "../components/editor";
import { ShareSheet } from "../components/ShareSheet";
import { dateRange, tripStatus } from "../tripDates";

/**
 * What the tab pages get from `useOutletContext`. `editSlot` is the spot at the
 * right end of the header where each page portals its own EditControls, since
 * only the page knows whether its data is editable; `actionSlot` is the bottom
 * bar, where it portals its add buttons while editing. A page in edit mode
 * calls `setNavLocked(true)`, which disables the back link and puts
 * `actionSlot` in place of the tabs, so its draft is not lost.
 */
export type TripOutletContext = {
  trip: Trip;
  editSlot: HTMLElement | null;
  actionSlot: HTMLElement | null;
  setNavLocked: (locked: boolean) => void;
};

/** The badge after the dates: days until the trip, the day it is on, or 已結束. */
function StatusBadge({ trip }: { trip: Trip }) {
  const status = tripStatus(trip.startDate, trip.endDate);
  const [text, color, background] =
    status.kind === "upcoming" ? [`還有 ${status.daysLeft} 天`, "var(--red)", "var(--red-soft)"]
    : status.kind === "ongoing" ? [`旅行中 · DAY ${status.day}/${status.total}`, "var(--green)", "var(--green-soft)"]
    : ["已結束", "var(--ink-soft)", "var(--paper-2)"];
  return (
    <span
      className="font-mono whitespace-nowrap"
      style={{ padding: "1px 7px", borderRadius: 9, fontSize: 10, letterSpacing: ".08em", color, background }}
    >
      {text}
    </span>
  );
}

const TripView = () => {
  const { tripId } = useParams();
  const [trip, setTrip] = useState<TripEntry | null>(null);
  // Members are managed live through the API, so only with data read from it.
  const [editable, setEditable] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(false);
  const [editSlot, setEditSlot] = useState<HTMLElement | null>(null);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [navLocked, setNavLocked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadTrips()
      .then(({ data, editable }) => {
        const found = data.find((t) => t.id === tripId);
        if (found) setTrip(found);
        else setError(true);
        setEditable(editable);
      })
      .catch(() => setError(true));
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

  if (error)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 font-hand" style={{ color: "var(--ink-soft)" }}>
        <span className="st-fd flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%" }}>
          <Icon name="briefcase" size={24} strokeWidth={1.8} />
        </span>
        <p style={{ fontSize: "1.2rem", color: "var(--ink)" }}>找不到這趟旅行</p>
        <Link to="/" className="font-hand" style={{ fontSize: "1.05rem", color: "var(--red)", textDecoration: "underline" }}>
          回首頁
        </Link>
      </div>
    );

  if (!trip)
    return (
      <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
        <div
          className="shrink-0 px-4 pb-3 pt-safe z-30 flex items-center gap-3"
          style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
        >
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="skeleton" style={{ height: 28, width: "55%", borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 16, width: "40%", borderRadius: 4 }} />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.1rem" }}>
          載入中...
        </div>
      </div>
    );

  const tabs: { key: string; label: string; icon: IconName }[] = [
    { key: "schedule", label: "日程", icon: "calendar" },
    { key: "shops",    label: "購物", icon: "bag" },
    { key: "info",     label: "資訊", icon: "paperclip" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="shrink-0 pl-4 pr-3.5 pb-3 pt-safe z-30 flex items-center gap-2.5"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        <Link
          to="/"
          aria-label="回首頁"
          {...lockedLink(navLocked)}
          className="transition-all duration-150"
          style={{
            ...circleBtn,
            opacity: navLocked ? .35 : 1,
            cursor: navLocked ? "not-allowed" : undefined,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(0)"; }}
        >
          <Icon name="back" size={20} strokeWidth={2.4} />
        </Link>
        <div className="flex-1 min-w-0">
          <div
            className="font-hand font-bold truncate"
            style={{ fontSize: "1.8rem", letterSpacing: "-0.01em", color: "var(--ink)", lineHeight: 1 }}
          >
            {trip.name}
          </div>
          <div className="flex items-center gap-2 min-w-0" style={{ marginTop: 4 }}>
            <span className="font-hand whitespace-nowrap" style={{ fontSize: "1rem", color: "var(--ink-soft)" }}>
              {dateRange(trip.startDate, trip.endDate)}
            </span>
            <StatusBadge trip={trip} />
          </div>
        </div>
        {apiEnabled && editable && !navLocked && (
          <button
            onClick={() => setSharing(true)}
            aria-label="成員"
            title={isShared(trip) ? "共享中" : "邀請成員"}
            style={{ ...circleBtn, cursor: "pointer" }}
          >
            <Icon name="users" size={19} />
          </button>
        )}
        {/* `contents`: no box of its own, so an empty slot adds no gap */}
        <div ref={setEditSlot} className="contents" />
      </header>

      {navLocked && <EditingBanner />}

      <ShareSheet
        trip={trip}
        open={sharing}
        onClose={() => setSharing(false)}
        onLeft={() => navigate("/", { replace: true })}
      />

      {/* Content */}
      <main className="flex-1 overflow-y-auto scrollbar-hide overscroll-y-contain">
        <Outlet context={{ trip, editSlot, actionSlot, setNavLocked } satisfies TripOutletContext} />
      </main>

      {/* Bottom bar: the tabs, or the page's add buttons while it is editing */}
      <BottomBar>
        {!navLocked && (
          <nav className="flex-1 flex justify-around">
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <Link
                  key={t.key}
                  to={`/trip/${tripId}/${t.key}`}
                  aria-current={isActive ? "page" : undefined}
                  className="font-hand font-bold flex items-center gap-1.5 transition-all duration-150"
                  style={{
                    background: isActive ? "var(--ink)" : "transparent",
                    color: isActive ? "var(--paper)" : "var(--ink)",
                    padding: "6px 16px",
                    borderRadius: 18,
                    fontSize: "1.2rem",
                    transform: isActive ? "rotate(-1.5deg)" : "none",
                    boxShadow: isActive ? "2px 2px 0 var(--red)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <Icon name={t.icon} size={17} />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div ref={setActionSlot} className={navLocked ? "flex-1 flex justify-center gap-3" : "hidden"} />
      </BottomBar>
    </div>
  );
};

export default TripView;
