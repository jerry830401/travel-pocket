import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NewTrip, Trip, TripEntry } from "../types";
import { apiEnabled, createTrip, deleteTrip, isShared, loadTrips, updateTrip, uploadCover } from "../dataSource";
import { resizeImage } from "../resizeImage";
import { EditModal, FieldInput, FieldImage, EditBtn, DeleteBtn, AddBtn, EditControls, ReadOnlyBanner } from "../components/editor";
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
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="font-hand font-bold flex items-center gap-2.5 mb-4 mx-1"
    style={{ fontSize: "1.15rem", color: "var(--red)" }}
  >
    <span style={{ display: "inline-block", width: 22, height: 2, background: "var(--red)", borderRadius: 1 }} />
    {children}
  </h2>
);

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

  /** One trip's card; `i` alternates its tilt and washi tape within its section. */
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
              {/* Only the owner deletes a trip; a member leaves it from the trip's 👥 sheet. */}
              {trip.role === "owner" && <DeleteBtn onClick={(e) => handleDelete(trip, e)} />}
            </div>
          )}

          {/* Cover */}
          <div className="relative overflow-hidden rounded-sm" style={{ height: 170 }}>
            {trip.coverImage ? (
              <img
                src={trip.coverImage}
                alt={trip.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="w-full h-full flex items-center justify-center"
                style={{ background: "var(--paper-2)", fontSize: "2.6rem" }}
              >
                🧳
              </div>
            )}
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
            {isShared(trip) && (
              <div className="font-hand flex items-center gap-1.5 mt-1" style={{ fontSize: "1rem", color: "var(--blue)" }}>
                <span aria-hidden>👥</span>
                <span className="truncate">
                  {trip.role === "member" ? `${trip.ownerEmail} 分享` : `與 ${trip.memberCount} 人共享`}
                </span>
              </div>
            )}
            {trip.pendingCount > 0 && (
              <div className="font-hand font-bold mt-1" style={{ fontSize: "1rem", color: "var(--red)" }}>
                ✋ {trip.pendingCount} 人申請加入
              </div>
            )}
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
  };

  const personal = trips.filter((trip) => !isShared(trip));
  const shared = trips.filter(isShared);

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

        <SectionLabel>個人旅程</SectionLabel>

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

        {/* Trip cards: personal ones first, then the shared ones */}
        {!loading && !error && personal.map(renderCard)}
        {!loading && !error && trips.length > 0 && personal.length === 0 && <Hint>沒有個人旅程</Hint>}

        {!loading && !error && trips.length > 0 && (apiEnabled || shared.length > 0) && (
          <>
            <SectionLabel>共享旅程</SectionLabel>
            {shared.length > 0
              ? shared.map(renderCard)
              : <Hint>還沒有共享的旅程。打開旅程，按上方的 👥 邀請同行的人一起編輯。</Hint>}
          </>
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
