import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NewTrip, Trip } from "../types";
import { apiEnabled, createTrip, deleteTrip, loadTrips, saveTrips } from "../dataSource";
import { EditModal, FieldInput, EditBtn, DeleteBtn, AddBtn, EditControls, ReadOnlyBanner } from "../components/editor";
import { lockedLink } from "../components/lockedLink";
import { circleBtn } from "../components/circleBtn";
import { BottomBar } from "../components/BottomBar";
import { useEditSession, type SaveDraft } from "../components/editor/useEditSession";

function seasonTag(startDate: string) {
  const m = parseInt(startDate.split("-")[1], 10);
  if (m >= 3 && m <= 5) return "❄ 春";
  if (m >= 6 && m <= 8) return "☀ 夏";
  if (m >= 9 && m <= 11) return "🌿 秋";
  return "❄ 冬";
}

const WASHI = [
  { l: "var(--red)", r: "var(--blue)" },
  { l: "var(--green)", r: "var(--yel)" },
  { l: "var(--purple)", r: "var(--red)" },
];

function calcDays(s: string, e: string) {
  return Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1;
}

type TripDraft = {
  name: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  snapshot: string;
};

const EMPTY_DRAFT: TripDraft = { name: "", startDate: "", endDate: "", coverImage: "", snapshot: "" };

function tripToDraft(trip: Trip): TripDraft {
  return {
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    coverImage: trip.coverImage,
    snapshot: trip.snapshot ?? "",
  };
}

function draftToNewTrip(draft: TripDraft): NewTrip {
  const trip: NewTrip = {
    name: draft.name.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    coverImage: draft.coverImage.trim(),
  };
  if (draft.snapshot.trim()) trip.snapshot = draft.snapshot.trim();
  return trip;
}

/* A trip added in edit mode has a placeholder id until 完成 creates it; ':'
   never appears in a real id (ID_PATTERN). */
const NEW_ID = "new:";

/**
 * Saves the trip list in the order the API needs: deletions first, then new
 * trips (the server assigns their ids), then one PUT for edits and order.
 * Each step is reported, so a retry after a failure skips what went through.
 */
const saveTripList: SaveDraft<Trip[]> = async (draft, saved, progress) => {
  let s = saved;
  let d = draft;
  for (const trip of s.filter((t) => !d.some((x) => x.id === t.id))) {
    await deleteTrip(trip.id);
    s = s.filter((t) => t.id !== trip.id);
    progress(s, d);
  }
  for (const trip of d.filter((t) => t.id.startsWith(NEW_ID))) {
    const created = await createTrip(draftToNewTrip(tripToDraft(trip)));
    s = [...s, created];
    d = d.map((t) => (t.id === trip.id ? created : t));
    progress(s, d);
  }
  if (JSON.stringify(s) !== JSON.stringify(d)) await saveTrips(d);
  return d;
};

const Home = () => {
  const session = useEditSession<Trip[]>([], saveTripList);
  const { data: trips, setData: setTrips, load, editing } = session;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editable, setEditable] = useState(false);
  const canEdit = editable && editing && !session.saving;

  /* Edit state */
  const [editTarget, setEditTarget] = useState<Trip | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TripDraft>(EMPTY_DRAFT);

  useEffect(() => {
    loadTrips()
      .then(({ data, editable }) => { load(data); setEditable(editable); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (trip: Trip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft(tripToDraft(trip));
    setEditTarget(trip);
  };

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setAdding(true);
  };

  const closeModal = () => {
    setEditTarget(null);
    setAdding(false);
  };

  const handleSave = () => {
    if (!draft.name.trim() || !draft.startDate || !draft.endDate) {
      alert("請填寫旅行名稱與日期");
      return;
    }
    if (adding) {
      setTrips([...trips, { ...draftToNewTrip(draft), id: `${NEW_ID}${Date.now()}` }]);
    } else if (editTarget) {
      setTrips(trips.map((t) =>
        t.id === editTarget.id ? { ...draftToNewTrip(draft), id: t.id } : t
      ));
    }
    closeModal();
  };

  // The API deletes the trip (with its itinerary, shops and info) on 完成.
  const handleDelete = (trip: Trip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`確定要刪除「${trip.name}」？行程、店家和資訊會一起刪除。`)) return;
    setTrips(trips.filter((t) => t.id !== trip.id));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 pt-safe-home px-6 pb-5 relative"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", top: -6, right: 30, width: 60, height: 18,
            background: "repeating-linear-gradient(45deg, color-mix(in srgb, var(--red) 80%, transparent) 0 5px, color-mix(in srgb, var(--red) 60%, transparent) 5px 10px)",
            transform: "rotate(8deg)",
            boxShadow: "0 2px 4px rgba(40,30,20,.18)",
          }}
        />
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1
              className="font-hand font-bold leading-none"
              style={{ fontSize: "2.6rem", letterSpacing: "-0.01em", color: "var(--ink)" }}
            >
              Travel Pocket
            </h1>
            <svg width="160" height="9" viewBox="0 0 160 9" className="mt-1.5">
              <path d="M2 5 Q 25 1, 45 5 T 85 5 T 125 5 T 158 5" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="font-hand italic mt-1" style={{ fontSize: "1.05rem", color: "var(--ink-soft)" }}>
              my little travel journal · 旅の記録
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {editable && !loading && !error && (
              <EditControls
                editing={editing}
                saving={session.saving}
                onStart={session.start}
                onCancel={session.cancel}
                onFinish={session.finish}
              />
            )}
            {/* Leaving the page would drop the draft, so edit mode stays here. */}
            <Link
              to="/settings"
              aria-label="設定"
              {...lockedLink(editing)}
              className="transition-all duration-150 hover:rotate-[-10deg]"
              style={{
                ...circleBtn,
                opacity: editing ? .35 : 1,
                cursor: editing ? "not-allowed" : undefined,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide dot-grid-bg px-4 pb-8 pt-5">
        {apiEnabled && !loading && !error && !editable && <ReadOnlyBanner />}

        <div
          className="font-hand font-bold flex items-center gap-2.5 mb-4 mx-1"
          style={{ fontSize: "1.15rem", color: "var(--red)" }}
        >
          <span style={{ display: "inline-block", width: 22, height: 2, background: "var(--red)", borderRadius: 1 }} />
          旅行筆記
        </div>

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 font-hand" style={{ color: "var(--ink-soft)" }}>
            <span style={{ fontSize: "2.4rem" }}>😵</span>
            <p style={{ fontSize: "1.1rem" }}>旅行清單載入失敗</p>
            <button
              onClick={() => { setLoading(true); setError(false); setRetry((r) => r + 1); }}
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
        )}

        {/* Skeleton cards */}
        {loading && (
          <>
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="block mb-8"
                style={{ transform: i % 2 === 0 ? "rotate(-1.2deg)" : "rotate(1deg)" }}
              >
                <div
                  style={{
                    background: "var(--paper)",
                    padding: "10px 10px 18px",
                    borderRadius: 6,
                    boxShadow: "0 4px 14px rgba(40,30,20,.12)",
                  }}
                >
                  <div className="skeleton" style={{ height: 170, borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 32, width: "65%", borderRadius: 4, marginTop: 14 }} />
                  <div className="skeleton" style={{ height: 18, width: "45%", borderRadius: 4, marginTop: 8 }} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state: a new account starts without trips */}
        {!loading && !error && trips.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 font-hand" style={{ color: "var(--ink-soft)" }}>
            <span style={{ fontSize: "2.4rem" }}>🧳</span>
            <p style={{ fontSize: "1.1rem" }}>還沒有旅行筆記</p>
          </div>
        )}

        {/* Trip cards */}
        {!loading && !error && trips.map((trip, i) => {
          const w = WASHI[i % WASHI.length];
          const baseRotate = i % 2 === 0 ? "rotate(-1.2deg)" : "rotate(1deg)";
          return (
            <Link
              to={`/trip/${trip.id}`}
              key={trip.id}
              // Opening a trip would drop the draft, so edit mode stays here.
              aria-disabled={editing || undefined}
              onClick={(e) => { if (editing) e.preventDefault(); }}
              className={`block mb-8 ${editing ? "cursor-default" : "cursor-pointer"}`}
              style={{ transform: baseRotate, transition: "transform .25s cubic-bezier(.2,.8,.3,1), box-shadow .2s", display: "block" }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "rotate(0deg) translateY(-3px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = baseRotate;
              }}
            >
              <div
                className="relative rounded-md"
                style={{
                  background: "var(--paper)",
                  padding: "10px 10px 18px",
                  boxShadow: "0 4px 14px rgba(40,30,20,.12),0 1px 3px rgba(40,30,20,.08)",
                }}
              >
                {/* Washi tapes */}
                <div aria-hidden style={{
                  position: "absolute", top: -10, left: 30, width: 90, height: 22, zIndex: 3,
                  background: `repeating-linear-gradient(45deg, ${w.l} 0 6px, color-mix(in srgb, ${w.l} 60%, transparent) 6px 12px)`,
                  transform: "rotate(-7deg)", boxShadow: "0 2px 4px rgba(40,30,20,.18)",
                }} />
                <div aria-hidden style={{
                  position: "absolute", top: -10, right: 24, width: 70, height: 22, zIndex: 3,
                  background: `repeating-linear-gradient(45deg, ${w.r} 0 6px, color-mix(in srgb, ${w.r} 60%, transparent) 6px 12px)`,
                  transform: "rotate(8deg)", boxShadow: "0 2px 4px rgba(40,30,20,.18)",
                }} />

                {/* Edit / delete buttons, left of the → circle */}
                {canEdit && (
                  <div
                    className="absolute z-10 flex gap-0.5"
                    style={{ bottom: 24, right: 58 }}
                    onClick={(e) => e.preventDefault()}
                  >
                    <EditBtn onClick={(e) => openEdit(trip, e)} />
                    <DeleteBtn onClick={(e) => handleDelete(trip, e)} />
                  </div>
                )}

                {/* Cover */}
                <div className="relative overflow-hidden rounded-sm" style={{ height: 170 }}>
                  <img
                    src={trip.snapshot ? `${import.meta.env.BASE_URL}${trip.snapshot}` : trip.coverImage}
                    alt={trip.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <div aria-hidden style={{
                    position: "absolute", inset: 0,
                    backgroundImage: "radial-gradient(rgba(255,255,255,.16) 1px,transparent 1px)",
                    backgroundSize: "8px 8px", mixBlendMode: "overlay",
                  }} />
                  <span
                    className="font-hand font-bold absolute right-3 top-3 z-10"
                    style={{ fontSize: "1rem", color: "#fff", background: "rgba(0,0,0,.35)", padding: "2px 10px", borderRadius: 12, transform: "rotate(3deg)" }}
                  >
                    {seasonTag(trip.startDate)}
                  </span>
                </div>

                {/* Meta */}
                <div style={{ padding: "12px 6px 0" }}>
                  <div className="font-hand font-bold leading-none" style={{ fontSize: "2.05rem", letterSpacing: "-0.01em", color: "var(--ink)" }}>
                    {trip.name}
                  </div>
                  <div className="font-hand flex items-center gap-2 mt-1.5" style={{ fontSize: "1.1rem", color: "var(--ink-soft)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>{trip.startDate} → {trip.endDate}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-2.5 px-1.5">
                  <span className="font-mono" style={{ fontSize: ".7rem", color: "var(--ink-soft)", letterSpacing: ".05em" }}>
                    {trip.startDate.slice(0, 4)} · {calcDays(trip.startDate, trip.endDate)} DAYS
                  </span>
                  <span
                    className="font-hand font-bold flex items-center justify-center"
                    aria-hidden
                    style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ink)", color: "var(--paper)", fontSize: 20 }}
                  >
                    →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Add button, where it can be reached without scrolling */}
      {editable && editing && (
        <BottomBar>
          <div className="flex-1 flex justify-center">
            {canEdit && <AddBtn onClick={openAdd} label="新增旅程" bar />}
          </div>
        </BottomBar>
      )}

      {/* Add / edit modal */}
      {canEdit && (
        <EditModal
          title={adding ? "新增旅行" : "編輯旅行"}
          open={adding || Boolean(editTarget)}
          onClose={closeModal}
          onSave={handleSave}
        >
          <FieldInput label="旅行名稱" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="福岡・熊本" />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="開始日期" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v }))} type="date" />
            <FieldInput label="結束日期" value={draft.endDate} onChange={(v) => setDraft((d) => ({ ...d, endDate: v }))} type="date" />
          </div>
          <FieldInput label="封面圖 URL" value={draft.coverImage} onChange={(v) => setDraft((d) => ({ ...d, coverImage: v }))} placeholder="https://..." type="url" />
          <FieldInput label="快照圖路徑（選填）" value={draft.snapshot} onChange={(v) => setDraft((d) => ({ ...d, snapshot: v }))} placeholder="data/kyushu-2024/snapshot.jpg" />
        </EditModal>
      )}
    </div>
  );
};

export default Home;
