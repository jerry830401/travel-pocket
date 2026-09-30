import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NewTrip, Trip, TripEntry } from "../types";
import { apiEnabled, createTrip, deleteTrip, isShared, loadTrips, updateTrip, uploadCover } from "../dataSource";
import { resizeImage } from "../resizeImage";
import { EditModal, FieldInput, FieldImage, EditBtn, DeleteBtn, AddBtn, EditControls, EditingBanner, ReadOnlyBanner } from "../components/editor";
import { lockedLink } from "../components/lockedLink";
import { circleBtn } from "../components/circleBtn";
import { btn } from "../components/btn";
import { Icon } from "../components/icons";
import { BottomBar } from "../components/BottomBar";
import { useEditSession, type SaveDraft } from "../components/editor/useEditSession";
import { dateRange, season, tripDays, tripStatus } from "../tripDates";

const WASHI = [
  { l: "var(--red)", r: "var(--blue)" },
  { l: "var(--green)", r: "var(--yel)" },
  { l: "var(--purple)", r: "var(--red)" },
];

const washi = (color: string) =>
  `repeating-linear-gradient(45deg, ${color} 0 6px, color-mix(in srgb, ${color} 60%, transparent) 6px 12px)`;

/** The postmark on a trip's cover: days until it starts, the day it is on, or 已結束. */
function Postmark({ trip }: { trip: Trip }) {
  const status = tripStatus(trip.startDate, trip.endDate);
  const color = status.kind === "upcoming" ? "var(--red)" : status.kind === "ongoing" ? "var(--green)" : "var(--ink-soft)";
  const halo = "color-mix(in srgb, var(--paper) 90%, transparent)";
  const small: React.CSSProperties = { fontSize: 11, lineHeight: 1.1 };
  const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, lineHeight: 1 };
  const sub: React.CSSProperties = { fontSize: 10, letterSpacing: ".06em", marginTop: 3 };
  return (
    <div
      className="absolute z-10 flex flex-col items-center justify-center"
      style={{
        left: 12, top: 12, width: 76, height: 76, borderRadius: "50%",
        border: `2px solid ${color}`, background: halo, color,
        transform: "rotate(-10deg)", boxShadow: `0 0 0 3px ${halo}, 0 0 0 4.5px ${color}`,
      }}
    >
      {status.kind === "upcoming" && (
        <>
          <span style={small}>還有</span>
          <span className="font-hand font-bold" style={{ fontSize: 30, lineHeight: .95 }}>{status.daysLeft}</span>
          <span style={small}>天</span>
        </>
      )}
      {status.kind === "ongoing" && (
        <>
          <span style={label}>旅行中</span>
          <span className="font-mono" style={sub}>DAY {status.day}</span>
        </>
      )}
      {status.kind === "ended" && (
        <>
          <span style={label}>已結束</span>
          <span className="font-mono" style={sub}>{trip.endDate.slice(0, 7).replace("-", ".")}</span>
        </>
      )}
    </div>
  );
}

const chip = (color: string, background: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%",
  padding: "1px 10px", borderRadius: 12, fontSize: 16, color, background,
});

type TripDraft = {
  name: string;
  startDate: string;
  endDate: string;
  coverImage: string;
};

/** Newest first by start date, then end date; trips on the same dates keep the list's order. */
const newestFirst = (a: Trip, b: Trip) =>
  b.startDate.localeCompare(a.startDate) || b.endDate.localeCompare(a.endDate);

type TripFilter = "all" | "personal" | "shared";

const FILTERS: { value: TripFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "personal", label: "個人" },
  { value: "shared", label: "共享" },
];

/* The filter is kept for the tab's session, so it survives opening a trip and
   coming back; the app opens on 全部. */
const FILTER_KEY = "home-filter";

function readFilter(): TripFilter {
  try {
    const saved = sessionStorage.getItem(FILTER_KEY);
    return FILTERS.find((f) => f.value === saved)?.value ?? "all";
  } catch {
    return "all";
  }
}

function saveFilter(filter: TripFilter) {
  try {
    sessionStorage.setItem(FILTER_KEY, filter);
  } catch {
    // Not kept; 全部 comes back next time.
  }
}

const matchesFilter = (trip: TripEntry, filter: TripFilter) =>
  filter === "all" || (filter === "shared") === isShared(trip);

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="font-hand mx-1 mb-8" style={{ fontSize: "1rem", color: "var(--ink-soft)", lineHeight: 1.4 }}>
    {children}
  </p>
);

const EMPTY_DRAFT: TripDraft = { name: "", startDate: "", endDate: "", coverImage: "" };

function tripToDraft(trip: Trip): TripDraft {
  return {
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    coverImage: trip.coverImage,
  };
}

function draftToNewTrip(draft: TripDraft): NewTrip {
  return {
    name: draft.name.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    coverImage: draft.coverImage,
  };
}

/* A cover picked in edit mode is shown from a blob: URL until 完成 uploads
   it; the image itself waits in pendingCovers, keyed by that URL. */
const isPendingCover = (coverImage: string) => coverImage.startsWith("blob:");

/* A trip added in edit mode has a placeholder id until 完成 creates it; ':'
   never appears in a real id (ID_PATTERN). */
const NEW_ID = "new:";

const sameFields = (a: Trip, b: Trip) =>
  a.name === b.name && a.startDate === b.startDate && a.endDate === b.endDate &&
  a.coverImage === b.coverImage;

/**
 * Saves the trip list in the order the API needs: deletions first, then new
 * trips (the server assigns their ids), then the picked covers, then one PUT
 * per edited trip, over the version it was read at. Each step is reported, so
 * a retry after a failure skips what went through.
 */
function makeSaveTripList(pendingCovers: Map<string, Blob>): SaveDraft<TripEntry[]> {
  return async (draft, saved, progress) => {
    let s = saved;
    let d = draft;
    for (const trip of s.filter((t) => !d.some((x) => x.id === t.id))) {
      await deleteTrip(trip.id);
      s = s.filter((t) => t.id !== trip.id);
      progress(s, d);
    }
    for (const trip of d.filter((t) => t.id.startsWith(NEW_ID))) {
      const fields = draftToNewTrip(tripToDraft(trip));
      const pending = isPendingCover(fields.coverImage);
      const created = await createTrip(pending ? { ...fields, coverImage: "" } : fields);
      s = [...s, created];
      // The picked cover stays in the draft for the upload below.
      d = d.map((t) => (t.id === trip.id ? { ...created, coverImage: trip.coverImage } : t));
      progress(s, d);
    }
    for (const trip of d.filter((t) => isPendingCover(t.coverImage))) {
      const image = pendingCovers.get(trip.coverImage);
      if (!image) throw new Error("找不到選取的封面圖");
      // The API points the saved trip at the new cover by itself, and bumps its
      // version. The draft moves on to that version only if nobody else saved
      // the trip in the meantime; otherwise its other edits are refused below.
      const { coverImage, version } = await uploadCover(trip.id, image);
      s = s.map((t) => (t.id === trip.id ? { ...t, coverImage, version } : t));
      d = d.map((t) =>
        t.id === trip.id
          ? { ...t, coverImage, version: version === t.version + 1 ? version : t.version }
          : t
      );
      progress(s, d);
    }
    for (const trip of d) {
      const before = s.find((t) => t.id === trip.id);
      if (!before || sameFields(before, trip)) continue;
      const updated = await updateTrip(trip.id, draftToNewTrip(tripToDraft(trip)), trip.version);
      s = s.map((t) => (t.id === trip.id ? updated : t));
      d = d.map((t) => (t.id === trip.id ? updated : t));
      progress(s, d);
    }
    return d;
  };
}

const Home = () => {
  const [pendingCovers] = useState(() => new Map<string, Blob>());
  const [retry, setRetry] = useState(0);
  const session = useEditSession<TripEntry[]>([], makeSaveTripList(pendingCovers), {
    reload: () => setRetry((r) => r + 1),
  });
  const { data: trips, setData: setTrips, load, editing } = session;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editable, setEditable] = useState(false);
  const canEdit = editable && editing && !session.saving;
  // Only the API has shared trips, so the static JSON always shows 全部.
  const [filter, setFilter] = useState<TripFilter>(() => (apiEnabled ? readFilter() : "all"));

  const chooseFilter = (next: TripFilter) => {
    setFilter(next);
    saveFilter(next);
  };

  /* Edit state */
  const [editTarget, setEditTarget] = useState<TripEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TripDraft>(EMPTY_DRAFT);
  const [preparingCover, setPreparingCover] = useState(false);

  // Once editing ends (saved or dropped), nothing shows the picked covers.
  useEffect(() => {
    if (editing) return;
    for (const url of pendingCovers.keys()) URL.revokeObjectURL(url);
    pendingCovers.clear();
  }, [editing, pendingCovers]);

  useEffect(() => {
    loadTrips()
      .then(({ data, editable }) => { load(data); setEditable(editable); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (trip: TripEntry, e: React.MouseEvent) => {
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

  const pickCover = async (file: File) => {
    setPreparingCover(true);
    try {
      const image = await resizeImage(file);
      const url = URL.createObjectURL(image);
      pendingCovers.set(url, image);
      setDraft((d) => ({ ...d, coverImage: url }));
    } catch {
      alert("無法讀取這張圖片，請換一張試試");
    } finally {
      setPreparingCover(false);
    }
  };

  const handleSave = () => {
    if (preparingCover) return;
    if (!draft.name.trim() || !draft.startDate || !draft.endDate) {
      alert("請填寫旅行名稱與日期");
      return;
    }
    if (adding) {
      setTrips([...trips, {
        ...draftToNewTrip(draft),
        id: `${NEW_ID}${Date.now()}`,
        version: 0, role: "owner", ownerEmail: "", memberCount: 0, pendingCount: 0,
      }]);
      // A new trip is personal; 共享 would hide it.
      if (filter === "shared") chooseFilter("all");
    } else if (editTarget) {
      setTrips(trips.map((t) => (t.id === editTarget.id ? { ...t, ...draftToNewTrip(draft) } : t)));
    }
    closeModal();
  };

  // The API deletes the trip (with its itinerary, shops and info) on 完成.
  const handleDelete = (trip: TripEntry, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`確定要刪除「${trip.name}」？行程、店家和資訊會一起刪除。`)) return;
    setTrips(trips.filter((t) => t.id !== trip.id));
  };

  /** One trip's card; `i` alternates its tilt and washi tape down the list. */
  const renderCard = (trip: TripEntry, i: number) => {
    const w = WASHI[i % WASHI.length];
    const baseRotate = i % 2 === 0 ? "rotate(-1.2deg)" : "rotate(1deg)";
    return (
      <Link
        to={`/trip/${trip.id}`}
        key={trip.id}
        // Opening a trip would drop the draft, so edit mode stays here.
        aria-disabled={editing || undefined}
        onClick={(e) => { if (editing) e.preventDefault(); }}
        className={`block mb-8 mx-1 ${editing ? "cursor-default" : "cursor-pointer"}`}
        style={{ transform: baseRotate, transition: "transform .25s cubic-bezier(.2,.8,.3,1)", display: "block" }}
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
            padding: "10px 10px 16px",
            boxShadow: "0 4px 14px var(--shadow), 0 1px 3px var(--shadow)",
          }}
        >
          {/* Washi tapes */}
          <div aria-hidden style={{
            position: "absolute", top: -10, left: 30, width: 90, height: 22, zIndex: 3,
            background: washi(w.l), transform: "rotate(-7deg)", boxShadow: "0 2px 4px var(--shadow)",
          }} />
          <div aria-hidden style={{
            position: "absolute", top: -10, right: 24, width: 70, height: 22, zIndex: 3,
            background: washi(w.r), transform: "rotate(8deg)", boxShadow: "0 2px 4px var(--shadow)",
          }} />

          {/* Edit / delete buttons, left of the → circle */}
          {canEdit && (
            <div
              className="absolute z-10 flex gap-0.5"
              style={{ bottom: 18, right: 58 }}
              onClick={(e) => e.preventDefault()}
            >
              <EditBtn onClick={(e) => openEdit(trip, e)} />
              {/* Only the owner deletes a trip; a member leaves it from the trip's 成員 sheet. */}
              {trip.role === "owner" && <DeleteBtn onClick={(e) => handleDelete(trip, e)} />}
            </div>
          )}

          {/* Cover */}
          <div className="relative overflow-hidden rounded-sm" style={{ height: 164 }}>
            {trip.coverImage ? (
              <img
                src={trip.coverImage}
                alt={trip.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="hatch-bg w-full h-full flex flex-col items-center justify-center gap-1.5"
                style={{ color: "var(--ink-faint)" }}
              >
                <Icon name="briefcase" size={34} strokeWidth={1.6} />
                <span className="font-hand" style={{ fontSize: "1rem", color: "var(--ink-soft)" }}>還沒有封面</span>
              </div>
            )}
            <Postmark trip={trip} />
            <span
              className="font-hand font-bold absolute right-3 top-3 z-10"
              style={{ fontSize: 17, color: "#fff", background: "rgba(0,0,0,.38)", padding: "1px 12px", borderRadius: 12, transform: "rotate(3deg)" }}
            >
              {season(trip.startDate)}
            </span>
          </div>

          {/* Meta */}
          <div style={{ padding: "12px 6px 0" }}>
            <div className="font-hand font-bold leading-none" style={{ fontSize: "2.1rem", letterSpacing: "-0.01em", color: "var(--ink)" }}>
              {trip.name}
            </div>
            <div className="font-hand flex items-center gap-2 mt-1.5" style={{ fontSize: "1.1rem", color: "var(--ink-soft)" }}>
              <Icon name="calendar" size={14} />
              <span>{dateRange(trip.startDate, trip.endDate)}</span>
            </div>
            {(isShared(trip) || trip.pendingCount > 0) && (
              <div className="font-hand font-bold flex flex-wrap gap-1.5 mt-2">
                {isShared(trip) && (
                  <span style={chip("var(--blue)", "var(--blue-soft)")}>
                    <Icon name="users" size={14} />
                    <span className="truncate">
                      {trip.role === "member" ? `${trip.ownerEmail} 分享` : `與 ${trip.memberCount} 人共享`}
                    </span>
                  </span>
                )}
                {trip.pendingCount > 0 && (
                  <span style={chip("var(--red)", "var(--red-soft)")}>
                    <Icon name="userPlus" size={14} />
                    <span>{trip.pendingCount} 人申請加入</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-2.5 px-1.5">
            <span className="font-mono" style={{ fontSize: ".7rem", color: "var(--ink-soft)", letterSpacing: ".08em" }}>
              {trip.startDate.slice(0, 4)} · {tripDays(trip.startDate, trip.endDate)} DAYS
            </span>
            <span
              className="flex items-center justify-center"
              aria-hidden
              style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--ink)", color: "var(--paper)" }}
            >
              <Icon name="arrowRight" size={18} strokeWidth={2.4} />
            </span>
          </div>
        </div>
      </Link>
    );
  };

  const shown = trips.filter((trip) => matchesFilter(trip, filter)).sort(newestFirst);
  const count = (f: TripFilter) => trips.filter((trip) => matchesFilter(trip, f)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 pt-safe-home pl-6 pr-5 pb-5 relative"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", top: -6, right: 120, width: 60, height: 18,
            background: "repeating-linear-gradient(45deg, color-mix(in srgb, var(--red) 80%, transparent) 0 5px, color-mix(in srgb, var(--red) 55%, transparent) 5px 10px)",
            transform: "rotate(8deg)",
            boxShadow: "0 2px 4px var(--shadow)",
          }}
        />
        <div className="flex justify-between items-start gap-3">
          <div>
            <h1
              className="font-hand font-bold leading-none"
              style={{ fontSize: "2.6rem", letterSpacing: "-0.01em", color: "var(--ink)" }}
            >
              Travel Pocket
            </h1>
            <svg width="160" height="9" viewBox="0 0 160 9" className="mt-1.5" aria-hidden>
              <path d="M2 5 Q 25 1, 45 5 T 85 5 T 125 5 T 158 5" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" />
            </svg>
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
              <Icon name="gear" size={19} />
            </Link>
          </div>
        </div>
        {/* Under the row, so the edit controls never squeeze it onto two lines */}
        <p className="font-hand italic mt-1" style={{ fontSize: "1.05rem", color: "var(--ink-soft)" }}>
          my little travel journal · 旅の記録
        </p>
      </div>

      {editing && <EditingBanner />}

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide dot-grid-bg px-4 pb-8 pt-5">
        {apiEnabled && !loading && !error && !editable && <ReadOnlyBanner />}

        {/* Filter: every trip, or only the personal or the shared ones */}
        {apiEnabled && !loading && !error && trips.length > 0 && (
          <div role="group" aria-label="篩選旅程" className="flex gap-2 mb-7 mx-1">
            {FILTERS.map(({ value, label }) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseFilter(value)}
                  className="font-hand font-bold flex items-baseline gap-1.5"
                  style={{
                    padding: "4px 16px", borderRadius: 18,
                    border: "1.5px solid var(--ink)",
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--ink)",
                    fontSize: "1.1rem", cursor: "pointer",
                    transform: active ? "rotate(-1.5deg)" : "none",
                    boxShadow: active ? "2px 2px 0 var(--red)" : "none",
                  }}
                >
                  {label}
                  <span className="font-mono" aria-hidden style={{ fontSize: 11, fontWeight: 400, opacity: .7 }}>{count(value)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 font-hand" style={{ color: "var(--ink-soft)" }}>
            <span className="st-fd flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%" }}>
              <Icon name="cloudOff" size={24} strokeWidth={1.8} />
            </span>
            <p style={{ fontSize: "1.2rem", color: "var(--ink)" }}>旅行清單載入失敗</p>
            <button
              onClick={() => { setLoading(true); setError(false); setRetry((r) => r + 1); }}
              className="font-hand font-bold"
              style={btn("primary")}
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
                className="block mb-8 mx-1"
                style={{ transform: i % 2 === 0 ? "rotate(-1.2deg)" : "rotate(1deg)" }}
              >
                <div
                  style={{
                    background: "var(--paper)",
                    padding: "10px 10px 18px",
                    borderRadius: 6,
                    boxShadow: "0 4px 14px var(--shadow)",
                  }}
                >
                  <div className="skeleton" style={{ height: 164, borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 32, width: "65%", borderRadius: 4, marginTop: 14 }} />
                  <div className="skeleton" style={{ height: 18, width: "45%", borderRadius: 4, marginTop: 8 }} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state: a new account starts without trips */}
        {!loading && !error && trips.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 font-hand text-center" style={{ color: "var(--ink-soft)" }}>
            <span className="st-in flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%" }}>
              <Icon name="briefcase" size={24} strokeWidth={1.8} />
            </span>
            <p style={{ fontSize: "1.2rem", color: "var(--ink)" }}>還沒有旅行筆記</p>
            {editable && !editing && <p style={{ fontSize: "1rem" }}>按右上角的鉛筆，新增第一趟旅程</p>}
          </div>
        )}

        {/* Trip cards, newest first; shared ones say so on the card */}
        {!loading && !error && shown.map(renderCard)}
        {!loading && !error && trips.length > 0 && shown.length === 0 && (
          <Hint>
            {filter === "shared"
              ? "還沒有共享的旅程。打開旅程，按上方的成員按鈕邀請同行的人一起編輯。"
              : "沒有個人旅程"}
          </Hint>
        )}
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
          <FieldImage
            label="封面圖"
            value={draft.coverImage}
            onPick={pickCover}
            onRemove={() => setDraft((d) => ({ ...d, coverImage: "" }))}
            busy={preparingCover}
          />
        </EditModal>
      )}
    </div>
  );
};

export default Home;
