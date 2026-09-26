import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import type { Shop } from "../types";
import type { TripOutletContext } from "./TripView";
import { apiEnabled, loadTripData, saveTripData } from "../dataSource";
import { EditModal, FieldInput, FieldTags, EditBtn, DeleteBtn, AddBtn, EditControls, ReadOnlyBanner } from "../components/editor";
import { useEditSession } from "../components/editor/useEditSession";
import { mapSearchUrl } from "../mapSearchUrl";

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

type ShopDraft = {
  name: string;
  location: string;
  tags: string[];
  businessHours: string;
};

const emptyDraft = (): ShopDraft => ({
  name: "", location: "", tags: [], businessHours: "",
});

function shopToDraft(shop: Shop): ShopDraft {
  return {
    name: shop.name,
    location: shop.location,
    tags: shop.tags,
    businessHours: shop.businessHours,
  };
}

function draftToShop(draft: ShopDraft, id: string): Shop {
  return { id, ...draft };
}

const Shops = () => {
  const { trip, editSlot, actionSlot, setNavLocked } = useOutletContext<TripOutletContext>();
  const session = useEditSession<Shop[]>(
    [],
    async (next) => {
      await saveTripData(trip.id, "shops", next);
      return next;
    },
    setNavLocked
  );
  const { data: shops, setData: setShops, load } = session;
  const [selectedTag, setSelectedTag] = useState("All");
  const [loading, setLoading] = useState(true);
  const [editable, setEditable] = useState(false);
  const canEdit = editable && session.editing && !session.saving;
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  /* Edit state */
  const [editTarget, setEditTarget] = useState<Shop | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<ShopDraft>(emptyDraft());

  useEffect(() => {
    if (!trip) return;
    loadTripData(trip.id, "shops")
      .then(({ data, editable }) => { load(data); setEditable(editable); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [trip, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const tags = useMemo(() => {
    const all = new Set(shops.flatMap((s) => s.tags));
    return ["All", ...Array.from(all)];
  }, [shops]);

  const filtered = useMemo(() => {
    if (selectedTag === "All") return shops;
    return shops.filter((s) => s.tags.includes(selectedTag));
  }, [shops, selectedTag]);

  /* Edit helpers */
  const openEdit = (shop: Shop, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(shopToDraft(shop));
    setEditTarget(shop);
  };

  const openAdd = () => {
    setDraft(emptyDraft());
    setIsAdding(true);
  };

  const closeModal = () => {
    setEditTarget(null);
    setIsAdding(false);
  };

  const handleDelete = (shopId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("確定要刪除這間店家？")) return;
    setShops(shops.filter((s) => s.id !== shopId));
  };

  const handleSave = () => {
    if (editTarget) {
      setShops(shops.map((s) => s.id === editTarget.id ? draftToShop(draft, s.id) : s));
    } else {
      setShops([...shops, draftToShop(draft, `shop-${Date.now()}`)]);
    }
    closeModal();
  };

  const isEditing = Boolean(editTarget) || isAdding;
  const modalTitle = editTarget ? "編輯店家" : "新增店家";

  return (
    <div style={{ background: "var(--bg)" }}>
      {apiEnabled && !loading && !error && !editable && <ReadOnlyBanner />}

      {editable && !loading && !error && editSlot && createPortal(
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
        <AddBtn onClick={openAdd} label="新增店家" bar />,
        actionSlot
      )}

      {/* Tag bar */}
      <div
        className="sticky top-0 z-10 flex gap-2 overflow-x-auto scrollbar-hide px-3.5 py-2.5"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="skeleton shrink-0" style={{ width: 64, height: 30, borderRadius: 18 }} />
          ))
        ) : (
          tags.map((tag) => {
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
          })
        )}
      </div>

      {/* List */}
      <div style={{ padding: "14px 18px 84px" }}>
        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 font-hand" style={{ color: "var(--ink-soft)" }}>
            <span style={{ fontSize: "2.4rem" }}>😵</span>
            <p style={{ fontSize: "1.1rem" }}>店家資訊載入失敗</p>
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

        {loading && (
          [...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{
              height: 110,
              borderRadius: 10,
              marginBottom: 14,
              transform: i % 2 === 0 ? "rotate(-.3deg)" : "rotate(.4deg)",
            }} />
          ))
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-10 font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.2rem" }}>
            找不到相關店家
          </div>
        )}

        {!loading && !error && filtered.map((shop, i) => {
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
                <div className="flex items-center gap-1 shrink-0">
                  {canEdit && (
                    <>
                      <EditBtn onClick={(e) => openEdit(shop, e)} />
                      <DeleteBtn onClick={(e) => handleDelete(shop.id, e)} />
                    </>
                  )}
                  {shop.location.trim() && (
                    <a
                      href={mapSearchUrl(shop.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="在 Google Map 查詢地點"
                      className="flex items-center justify-center transition-all duration-150 hover:rotate-[-8deg] hover:scale-105"
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

      {/* Edit / Add modal */}
      {canEdit && (
        <EditModal
          title={modalTitle}
          open={isEditing}
          onClose={closeModal}
          onSave={handleSave}
        >
          <FieldInput label="店名" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="店家名稱" />
          <FieldInput label="地點" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} placeholder="地點描述" />
          <FieldInput label="營業時間" value={draft.businessHours} onChange={(v) => setDraft((d) => ({ ...d, businessHours: v }))} placeholder="10:00 - 20:00" />
          <FieldTags label="標籤" value={draft.tags} onChange={(v) => setDraft((d) => ({ ...d, tags: v }))} placeholder="家電, 轉蛋, 美食" />        </EditModal>
      )}
    </div>
  );
};

export default Shops;
