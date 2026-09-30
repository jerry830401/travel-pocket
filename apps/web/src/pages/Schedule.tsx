import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import type { ItineraryDay, ItineraryItem } from "../types";
import type { TripOutletContext } from "./TripView";
import { motion, AnimatePresence } from "framer-motion";
import { apiEnabled, loadTripData, saveTripData } from "../dataSource";
import { EditModal, FieldInput, FieldTextarea, FieldStickers, EditBtn, DeleteBtn, AddBtn, EditControls, ReadOnlyBanner } from "../components/editor";
import { useEditSession } from "../components/editor/useEditSession";
import { circleBtn } from "../components/circleBtn";
import { btn } from "../components/btn";
import { Icon } from "../components/icons";
import { toMins, gapLabel, dateBig, weekday, sortItems, nowIndex } from "./scheduleUtils";
import { mapSearchUrl } from "../mapSearchUrl";
import { todayStr } from "../tripDates";

/* Category stickers: a kanji stamp each */
const CATS: Record<string, { g: string; cls: string; l: string }> = {
  planeTakeoff: { g: "発", cls: "st-pl", l: "出發" },
  planeLanding: { g: "着", cls: "st-pl", l: "抵達" },
  train:        { g: "鉄", cls: "st-tr", l: "交通" },
  bus:          { g: "巴", cls: "st-tr", l: "巴士" },
  ship:         { g: "船", cls: "st-tr", l: "渡船" },
  car:          { g: "車", cls: "st-tr", l: "自駕" },
  hotel:        { g: "住", cls: "st-ht", l: "住宿" },
  food:         { g: "食", cls: "st-fd", l: "餐廳" },
  sightseeing:  { g: "景", cls: "st-sg", l: "景點" },
};
const CDEF = { g: "他", cls: "st-xx", l: "其他" };
function gc(k: string) { return CATS[k] ?? CDEF; }

const CATEGORY_OPTIONS = [
  ...Object.entries(CATS).map(([value, { g, cls, l }]) => ({ value, label: l, glyph: g, cls })),
  { value: "other", label: CDEF.l, glyph: CDEF.g, cls: CDEF.cls },
];

const sectionLabel: React.CSSProperties = { fontSize: ".66rem", letterSpacing: ".18em", color: "var(--ink-soft)" };

const dayVariants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
};

/* The dashed line down the timeline, in its 28px column */
const Rail = ({ from = 0 }: { from?: number }) => (
  <span aria-hidden style={{ position: "absolute", left: 13, top: from, bottom: 0, borderLeft: "1.5px dashed var(--rule)" }} />
);

/* ── Draft state for editing an ItineraryItem ── */
type ItemDraft = {
  title: string;
  location: string;
  category: string;
  startTime: string;
  endTime: string;
  description: string; // textarea; multi-line → string[]
};

function itemToDraft(item: ItineraryItem): ItemDraft {
  const desc = Array.isArray(item.description)
    ? item.description.join("\n")
    : (item.description ?? "");
  return {
    title: item.title,
    location: item.location,
    category: item.category,
    startTime: item.startTime,
    endTime: item.endTime,
    description: desc,
  };
}

function draftToItem(draft: ItemDraft, id: string): ItineraryItem {
  const lines = draft.description.split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    id,
    title: draft.title,
    location: draft.location,
    category: draft.category as ItineraryItem["category"],
    startTime: draft.startTime,
    endTime: draft.endTime,
    description: lines.length > 1 ? lines : (lines[0] ?? undefined),
  };
}

const emptyDraft = (): ItemDraft => ({
  title: "", location: "", category: "sightseeing",
  startTime: "", endTime: "", description: "",
});

/* ── Draft state for adding or editing an ItineraryDay ── */
type DayDraft = { date: string; day: string };

function nextDateStr(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Minutes since midnight, refreshed every minute for the 現在 line. */
function useNowMins() {
  const read = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const [mins, setMins] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setMins(read()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return mins;
}

/* ─────────────────────────────────────────────────────────────── */

const Schedule = () => {
  const { trip, editSlot, actionSlot, setNavLocked } = useOutletContext<TripOutletContext>();
  const [retry, setRetry] = useState(0);
  // The version the itinerary was read at, which a save must name.
  const version = useRef(0);
  const session = useEditSession<ItineraryDay[]>(
    [],
    async (next) => {
      version.current = await saveTripData(trip.id, "itinerary", next, version.current);
      return next;
    },
    { lockNav: setNavLocked, reload: () => setRetry((r) => r + 1) }
  );
  const { data: days, setData: setDays, load } = session;
  const [selectedDayIdx, setDayIdx] = useState(0);
  // Kept in range: 取消 can drop a day added in edit mode while it is selected.
  const dayIdx = Math.min(selectedDayIdx, Math.max(0, days.length - 1));
  const [direction, setDirection] = useState(1);
  const [selectedItem, setSelectedItem] = useState<{ item: ItineraryItem; day: ItineraryDay } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editable, setEditable] = useState(false);
  const canEdit = editable && session.editing && !session.saving;
  const [error, setError] = useState(false);
  const dayBarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const today = todayStr();
  const nowMins = useNowMins();

  /* Edit state */
  const [editTarget, setEditTarget] = useState<{ item: ItineraryItem; dayId: string } | null>(null);
  const [addDayId, setAddDayId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft());

  /* Day-level edit state */
  const [dayModalOpen, setDayModalOpen] = useState(false);
  // The day the modal edits, or null when it adds a new one.
  const [editDayId, setEditDayId] = useState<string | null>(null);
  const [dayDraft, setDayDraft] = useState<DayDraft>({ date: "", day: "1" });

  useEffect(() => {
    if (!trip) return;
    loadTripData(trip.id, "itinerary")
      .then(({ data, editable, version: read }) => {
        version.current = read ?? 0;
        load(data);
        setEditable(editable);
        const ti = data.findIndex((d) => d.date === today);
        if (ti >= 0) setDayIdx(ti);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [trip, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const bar = dayBarRef.current;
    if (!bar || !days.length) return;
    const chip = bar.children[dayIdx] as HTMLElement | undefined;
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
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

  /* ── Edit helpers ── */
  const openEdit = (item: ItineraryItem, dayId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(itemToDraft(item));
    setEditTarget({ item, dayId });
  };

  const openAdd = (dayId: string) => {
    setDraft(emptyDraft());
    setAddDayId(dayId);
  };

  const closeModal = () => {
    setEditTarget(null);
    setAddDayId(null);
  };

  /* ── Day-level helpers ── */
  const openAddDay = () => {
    const last = days[days.length - 1];
    setDayDraft({
      date: last ? nextDateStr(last.date) : "",
      day: String(days.length + 1),
    });
    setEditDayId(null);
    setDayModalOpen(true);
  };

  const openEditDay = (day: ItineraryDay) => {
    setDayDraft({ date: day.date, day: String(day.day) });
    setEditDayId(day.id);
    setDayModalOpen(true);
  };

  const handleDeleteDay = (dayId: string) => {
    const target = days.find((d) => d.id === dayId);
    if (!confirm(`確定要刪除「Day ${target?.day}（${target?.date}）」及其所有行程項目？`)) return;
    const next = days.filter((d) => d.id !== dayId);
    const newIdx = Math.min(dayIdx, next.length - 1);
    setDays(next);
    setDayIdx(Math.max(0, newIdx));
  };

  const handleSaveDay = () => {
    const parsedDay = Number(dayDraft.day);
    const fields = {
      day: isNaN(parsedDay) ? dayDraft.day : parsedDay,
      date: dayDraft.date,
    };
    const id = editDayId ?? `day-${Date.now()}`;
    // An edited day keeps its id and items; a new one starts empty.
    const next = (editDayId
      ? days.map((d) => (d.id === editDayId ? { ...d, ...fields } : d))
      : [...days, { id, ...fields, items: [] }]
    ).sort((a, b) => a.date.localeCompare(b.date));
    setDays(next);
    setDayIdx(next.findIndex((d) => d.id === id));
    setDayModalOpen(false);
  };

  const handleDelete = (itemId: string, dayId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("確定要刪除這個行程項目？")) return;
    setDays(days.map((d) =>
      d.id === dayId ? { ...d, items: d.items.filter((it) => it.id !== itemId) } : d
    ));
  };

  const handleSave = () => {
    if (editTarget) {
      setDays(days.map((d) =>
        d.id === editTarget.dayId
          ? { ...d, items: d.items.map((it) => it.id === editTarget.item.id ? draftToItem(draft, it.id) : it) }
          : d
      ));
    } else if (addDayId) {
      const newId = `${addDayId}-${Date.now()}`;
      setDays(days.map((d) =>
        d.id === addDayId
          ? { ...d, items: [...d.items, draftToItem(draft, newId)] }
          : d
      ));
    }
    closeModal();
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 font-hand" style={{ color: "var(--ink-soft)" }}>
      <span className="st-fd flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%" }}>
        <Icon name="cloudOff" size={24} strokeWidth={1.8} />
      </span>
      <p style={{ fontSize: "1.2rem", color: "var(--ink)" }}>行程載入失敗</p>
      <button onClick={handleRetry} className="font-hand font-bold" style={btn("primary")}>
        重試
      </button>
    </div>
  );

  const isEditing = Boolean(editTarget) || Boolean(addDayId);
  const modalTitle = editTarget ? "編輯行程項目" : "新增行程項目";

  /* Shown in time order; the saved list keeps its own order. On today, the
     現在 line goes before the first item that has not started. */
  const items = currentDay ? sortItems(currentDay.items) : [];
  const isToday = currentDay?.date === today;
  const nowIdx = isToday ? nowIndex(items, nowMins) : -1;
  const isOver = (item: ItineraryItem, j: number) => {
    if (!isToday || j >= nowIdx) return false;
    const end = toMins(item.endTime);
    return end !== null ? end <= nowMins : j < nowIdx - 1;
  };
  const nextStart = nowIdx >= 0 && nowIdx < items.length
    ? toMins(items[nowIdx].startTime) ?? toMins(items[nowIdx].endTime)
    : null;
  const untilNext = nextStart !== null ? gapLabel(nextStart - nowMins) : null;

  const nowRow = (
    <div className="flex items-center" style={{ height: 36 }}>
      <div className="font-mono shrink-0 text-right" style={{ width: 48, fontSize: ".7rem", fontWeight: 500, color: "var(--red)" }}>
        {String(Math.floor(nowMins / 60)).padStart(2, "0")}:{String(nowMins % 60).padStart(2, "0")}
      </div>
      <div className="relative shrink-0 self-stretch" style={{ width: 28 }}>
        <Rail />
        <span aria-hidden style={{ position: "absolute", left: 7, top: 12, width: 13, height: 13, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 0 4px var(--red-soft)" }} />
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span style={{ flex: 1, borderTop: "1.5px solid var(--red)" }} />
        <span className="font-hand font-bold whitespace-nowrap" style={{ fontSize: "1rem", color: "var(--red)" }}>
          現在{untilNext ? ` · 下一站 ${untilNext} 後` : ""}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="relative min-h-full lined-bg"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {apiEnabled && !loading && !error && !editable && <ReadOnlyBanner />}

      {editable && !loading && editSlot && createPortal(
        <EditControls
          editing={session.editing}
          saving={session.saving}
          onStart={session.start}
          onCancel={session.cancel}
          onFinish={session.finish}
        />,
        editSlot
      )}

      {canEdit && actionSlot && createPortal(
        <>
          {currentDay && <AddBtn onClick={() => openAdd(currentDay.id)} label="新增行程" bar />}
          <AddBtn onClick={openAddDay} label="新增日" bar />
        </>,
        actionSlot
      )}

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
                  aria-current={d.date === today ? "date" : undefined}
                  className="font-hand font-bold whitespace-nowrap shrink-0 transition-all duration-150 relative"
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
                  {/* Today's day carries a red dot */}
                  {d.date === today && (
                    <span aria-hidden style={{ position: "absolute", top: -3, right: -2, width: 10, height: 10, borderRadius: "50%", background: "var(--red)", border: "2px solid var(--paper)" }} />
                  )}
                </button>
              ))
          }
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pr-3">
          {!loading && todayIdx >= 0 && todayIdx !== dayIdx && (
            <button
              onClick={() => goToDay(todayIdx)}
              className="font-hand font-bold"
              style={{
                padding: "4px 12px",
                borderRadius: 18,
                border: "1.5px dashed var(--red)",
                background: "var(--red-soft)",
                color: "var(--red)",
                fontSize: ".95rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              今天
            </button>
          )}
        </div>
      </div>

      {/* Date stamp */}
      {loading ? (
        <div className="flex items-baseline gap-3.5 px-4 pt-3.5 pb-1.5">
          <div className="skeleton" style={{ width: 120, height: 38, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 88, height: 14, borderRadius: 4 }} />
        </div>
      ) : currentDay && (
        <div className="flex items-center gap-3.5 pl-[18px] pr-4 pt-3.5 pb-2">
          <span className="font-hand font-bold" style={{ fontSize: "2.5rem", letterSpacing: "-0.01em", lineHeight: 1, color: "var(--ink)" }}>
            {dateBig(currentDay.date)}
          </span>
          <span className="font-mono flex-1" style={{ fontSize: ".7rem", color: "var(--ink-soft)", letterSpacing: ".18em" }}>
            {weekday(currentDay.date)} · DAY {currentDay.day}
          </span>
          {canEdit && (
            <div className="flex gap-0.5">
              <EditBtn onClick={() => openEditDay(currentDay)} />
              <DeleteBtn onClick={() => handleDeleteDay(currentDay.id)} />
            </div>
          )}
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div style={{ padding: "8px 18px 84px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{
              height: 64,
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
            style={{ padding: "6px 16px 84px 12px" }}
          >
            {!currentDay && (
              <div className="text-center py-10 font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.2rem" }}>
                無行程資料
              </div>
            )}

            {items.map((item, j) => {
              const cat = gc(item.category);
              const next = items[j + 1];
              // The 現在 line stands in for the gap it falls in.
              const gap = next && nowIdx !== j + 1
                ? gapLabel((toMins(next.startTime) ?? 0) - (toMins(item.endTime) ?? 0))
                : null;
              const rot = j % 2 === 0 ? "rotate(-.4deg)" : "rotate(.4deg)";
              const over = isOver(item, j);

              return (
                <div key={item.id}>
                  {j === nowIdx && nowRow}
                  <div className="flex items-stretch" style={{ opacity: over ? .5 : 1 }}>
                    {/* Time */}
                    <div className="shrink-0 text-right" style={{ width: 48, paddingTop: 13 }}>
                      <div className="font-mono" style={{ fontSize: ".85rem", fontWeight: 500, color: "var(--ink)" }}>
                        {item.startTime || "—"}
                      </div>
                      {item.endTime && (
                        <div className="font-mono" style={{ fontSize: ".7rem", color: "var(--ink-soft)", marginTop: 2 }}>{item.endTime}</div>
                      )}
                    </div>
                    {/* Rail and dot */}
                    <div className="relative shrink-0" style={{ width: 28 }}>
                      <Rail from={j === 0 && nowIdx !== 0 ? 24 : 0} />
                      <span aria-hidden style={{
                        position: "absolute", left: 8, top: 18, width: 12, height: 12, borderRadius: "50%",
                        background: over ? "var(--ink)" : "var(--paper)", border: "2px solid var(--ink)",
                      }} />
                    </div>
                    {/* Card */}
                    <div
                      onClick={() => setSelectedItem({ item, day: currentDay })}
                      className="flex-1 min-w-0 cursor-pointer transition-all duration-200"
                      style={{
                        background: "var(--paper)",
                        border: "1px solid color-mix(in srgb, var(--rule) 60%, transparent)",
                        borderRadius: 10,
                        padding: "11px 10px 11px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "2px 2px 0 var(--rule)",
                        transform: rot,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.transform = "rotate(0) translateY(-2px)";
                        el.style.boxShadow = "3px 3px 0 var(--red)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.transform = rot;
                        el.style.boxShadow = "2px 2px 0 var(--rule)";
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-hand font-bold truncate" style={{ fontSize: "1.35rem", lineHeight: 1.15, color: "var(--ink)" }}>
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                          <span style={{ color: "var(--ink-faint)", display: "flex" }}><Icon name="pin" size={12} /></span>
                          <span className="truncate">{item.location}</span>
                        </div>
                      </div>
                      {/* Edit/delete buttons left of the sticker, in the row, so
                          a short card (no end time) cannot put them over it */}
                      <div className="shrink-0 flex items-center gap-1">
                        {canEdit && (
                          <div className="flex" onClick={(e) => e.stopPropagation()}>
                            <EditBtn onClick={(e) => openEdit(item, currentDay.id, e)} />
                            <DeleteBtn onClick={(e) => handleDelete(item.id, currentDay.id, e)} />
                          </div>
                        )}
                        {/* Sticker */}
                        <div
                          title={cat.l}
                          className={`flex items-center justify-center ${cat.cls}`}
                          style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 17, fontWeight: 600, transform: "rotate(-4deg)", boxShadow: "0 1.5px 3px var(--shadow)" }}
                        >
                          {cat.g}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gap */}
                  {gap && (
                    <div className="flex items-center" style={{ height: 30 }}>
                      <div className="shrink-0" style={{ width: 48 }} />
                      <div className="relative shrink-0 self-stretch" style={{ width: 28 }}><Rail /></div>
                      <span className="font-hand inline-flex items-center gap-1.5" style={{ fontSize: ".95rem", color: "var(--ink-soft)" }}>
                        <Icon name="clock" size={12} /> {gap}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {nowIdx >= 0 && nowIdx === items.length && items.length > 0 && nowRow}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Bottom Sheet (detail view) */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 z-40"
              style={{ background: "var(--scrim)", backdropFilter: "blur(3px)" }}
            />
            <motion.div
              role="dialog"
              aria-label={selectedItem.item.title}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 mx-auto z-50 overflow-y-auto scrollbar-hide"
              style={{
                maxWidth: 480,
                maxHeight: "85vh",
                background: "var(--paper)",
                borderRadius: "22px 22px 0 0",
                borderTop: "2px dashed var(--rule)",
                boxShadow: "0 -8px 40px var(--shadow)",
                padding: "14px 22px 30px",
              }}
            >
              <div style={{ width: 44, height: 4, background: "var(--rule)", borderRadius: 2, margin: "0 auto 18px" }} />
              <button
                onClick={() => setSelectedItem(null)}
                aria-label="關閉"
                className="absolute top-4 right-4"
                style={{ ...circleBtn, width: 40, height: 40, background: "var(--paper)", cursor: "pointer" }}
              >
                <Icon name="x" size={15} strokeWidth={2.5} />
              </button>

              <div className="flex items-center gap-2.5">
                <div
                  className={`flex items-center justify-center ${gc(selectedItem.item.category).cls}`}
                  style={{ width: 30, height: 30, borderRadius: "50%", fontSize: 14, fontWeight: 600, transform: "rotate(-4deg)" }}
                >
                  {gc(selectedItem.item.category).g}
                </div>
                <span className="font-mono" style={{ ...sectionLabel, fontSize: ".7rem", letterSpacing: ".2em" }}>
                  {gc(selectedItem.item.category).l}
                </span>
              </div>

              <h2 className="font-hand font-bold" style={{ margin: "8px 50px 16px 0", fontSize: "2rem", letterSpacing: "-0.01em", lineHeight: 1.1, color: "var(--ink)" }}>
                {selectedItem.item.title}
              </h2>

              <div className="grid grid-cols-2 gap-2.5 mb-[18px]">
                <div style={{ padding: "12px 14px", background: "var(--paper-2)", border: "1px dashed var(--rule)", borderRadius: 8 }}>
                  <div className="font-mono" style={sectionLabel}>時間</div>
                  <div className="font-hand font-bold mt-0.5" style={{ fontSize: "1.35rem", lineHeight: 1.2, color: "var(--ink)" }}>
                    {selectedItem.item.startTime || "—"}{selectedItem.item.endTime ? ` – ${selectedItem.item.endTime}` : ""}
                  </div>
                </div>
                <div style={{ padding: "12px 14px", background: "var(--paper-2)", border: "1px dashed var(--rule)", borderRadius: 8 }}>
                  <div className="font-mono" style={sectionLabel}>第幾天</div>
                  <div className="font-hand font-bold mt-0.5" style={{ fontSize: "1.35rem", lineHeight: 1.2, color: "var(--ink)" }}>
                    Day {selectedItem.day.day} · {selectedItem.day.date.slice(5).replace("-", "/")}
                  </div>
                </div>
              </div>

              <div className="font-mono mb-2" style={sectionLabel}>地點</div>
              <a
                href={mapSearchUrl(selectedItem.item.location)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-hand font-bold flex items-center gap-2.5 mb-[18px] transition-all duration-150 hover:-translate-y-0.5"
                style={{
                  padding: "13px 16px",
                  background: "var(--red-soft)",
                  border: "1.5px dashed var(--red)",
                  borderRadius: 10,
                  color: "var(--red)",
                  textDecoration: "none",
                  fontSize: "1.2rem",
                }}
              >
                <Icon name="pin" size={18} />
                <span className="truncate flex-1 min-w-0">{selectedItem.item.location}</span>
                <span className="flex items-center gap-1 shrink-0" style={{ fontSize: ".95rem" }}>
                  在地圖打開 <Icon name="external" size={14} />
                </span>
              </a>

              {selectedItem.item.description && (Array.isArray(selectedItem.item.description) ? selectedItem.item.description.length > 0 : true) && (
                <>
                  <div className="font-mono mb-2" style={sectionLabel}>備忘錄</div>
                  <div className="lined-bg" style={{ border: "1px dashed var(--rule)", borderRadius: 10, padding: "5px 18px 7px", fontSize: ".95rem", color: "var(--ink)", lineHeight: "28px" }}>
                    {Array.isArray(selectedItem.item.description) ? (
                      <ol className="list-decimal list-inside">
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

      {/* Add / edit day modal */}
      {canEdit && (
        <EditModal
          title={editDayId ? "編輯日" : "新增日"}
          open={dayModalOpen}
          onClose={() => setDayModalOpen(false)}
          onSave={handleSaveDay}
        >
          <FieldInput label="日期" value={dayDraft.date} onChange={(v) => setDayDraft((d) => ({ ...d, date: v }))} type="date" />
          <FieldInput label="第幾天（Day N）" value={dayDraft.day} onChange={(v) => setDayDraft((d) => ({ ...d, day: v }))} placeholder="1 或 8A" />
        </EditModal>
      )}

      {/* Edit / Add item modal */}
      {canEdit && (
        <EditModal
          title={modalTitle}
          open={isEditing}
          onClose={closeModal}
          onSave={handleSave}
        >
          <FieldInput label="標題" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="行程名稱" />
          <FieldInput label="地點" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} placeholder="地點名稱" />
          <FieldStickers
            label="類別"
            value={draft.category}
            onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            options={CATEGORY_OPTIONS}
          />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="開始時間" value={draft.startTime} onChange={(v) => setDraft((d) => ({ ...d, startTime: v }))} placeholder="HH:MM" type="time" />
            <FieldInput label="結束時間" value={draft.endTime} onChange={(v) => setDraft((d) => ({ ...d, endTime: v }))} placeholder="HH:MM" type="time" />
          </div>
          <FieldTextarea label="備忘錄（每行一筆）" value={draft.description} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} placeholder="備忘事項..." rows={3} />
        </EditModal>
      )}
    </div>
  );
};

export default Schedule;
