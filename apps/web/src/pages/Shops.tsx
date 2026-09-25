import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import type { Trip, Shop } from "../types";
import { isDevMode, saveData } from "../hooks/useDataEditor";
import { EditModal, FieldInput, FieldTags, EditBtn, DeleteBtn, AddBtn, DevBanner } from "../components/editor";

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
  googleMapLink: string;
};

const emptyDraft = (): ShopDraft => ({
  name: "", location: "", tags: [], businessHours: "", googleMapLink: "",
});

function shopToDraft(shop: Shop): ShopDraft {
  return {
    name: shop.name,
    location: shop.location,
    tags: shop.tags,
    businessHours: shop.businessHours,
    googleMapLink: shop.googleMapLink,
  };
}

function draftToShop(draft: ShopDraft, id: string): Shop {
  return { id, ...draft };
}

const Shops = () => {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedTag, setSelectedTag] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  /* Edit state (dev only) */
  const [editTarget, setEditTarget] = useState<Shop | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<ShopDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trip) return;
    fetch(`${import.meta.env.BASE_URL}data/${trip.id}/shops.json`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Shop[]) => { setShops(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [trip, retry]);

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
    const next = shops.filter((s) => s.id !== shopId);
    setShops(next);
    saveData(`${trip.id}/shops`, next).catch(console.error);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let next: Shop[];
      if (editTarget) {
        next = shops.map((s) => s.id === editTarget.id ? draftToShop(draft, s.id) : s);
      } else {
        const newId = `shop-${Date.now()}`;
        next = [...shops, draftToShop(draft, newId)];
      }
      setShops(next);
      await saveData(`${trip.id}/shops`, next);
      closeModal();
    } catch (err) {
      alert(`儲存失敗：${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(editTarget) || isAdding;
  const modalTitle = editTarget ? "編輯店家" : "新增店家";

  return (
    <div style={{ background: "var(--bg)" }}>
      {isDevMode && <DevBanner />}

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
                  {isDevMode && (
                    <>
                      <EditBtn onClick={(e) => openEdit(shop, e)} />
                      <DeleteBtn onClick={(e) => handleDelete(shop.id, e)} />
                    </>
                  )}
                  {shop.googleMapLink && (
                    <a
                      href={shop.googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
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

        {/* Add button (dev only) */}
        {isDevMode && !loading && !error && (
          <div className="flex justify-center pt-2">
            <AddBtn onClick={openAdd} label="新增店家" />
          </div>
        )}
      </div>

      {/* Edit / Add modal (dev only) */}
      {isDevMode && (
        <EditModal
          title={modalTitle}
          open={isEditing}
          onClose={closeModal}
          onSave={handleSave}
          saving={saving}
        >
          <FieldInput label="店名" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="店家名稱" />
          <FieldInput label="地點" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} placeholder="地點描述" />
          <FieldInput label="營業時間" value={draft.businessHours} onChange={(v) => setDraft((d) => ({ ...d, businessHours: v }))} placeholder="10:00 - 20:00" />
          <FieldTags label="標籤" value={draft.tags} onChange={(v) => setDraft((d) => ({ ...d, tags: v }))} placeholder="家電, 轉蛋, 美食" />
          <FieldInput label="Google Map 連結" value={draft.googleMapLink} onChange={(v) => setDraft((d) => ({ ...d, googleMapLink: v }))} placeholder="https://maps.app.goo.gl/..." type="url" />
        </EditModal>
      )}
    </div>
  );
};

export default Shops;
