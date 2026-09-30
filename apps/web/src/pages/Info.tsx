import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import type { InfoItem, InfoLink } from "../types";
import type { TripOutletContext } from "./TripView";
import { apiEnabled, loadTripData, saveTripData } from "../dataSource";
import { EditModal, FieldInput, EditBtn, DeleteBtn, AddBtn, EditControls, ReadOnlyBanner } from "../components/editor";
import { useEditSession } from "../components/editor/useEditSession";
import { btn } from "../components/btn";
import { Icon } from "../components/icons";
import { infoIconName } from "../infoIcon";

/* A card's icon: a line icon for a known name ("Plane"), else the text as typed (an emoji). */
function InfoIcon({ icon }: { icon: string }) {
  const name = infoIconName(icon);
  return name ? <Icon name={name} size={19} /> : <>{icon}</>;
}

/* Edit state discriminated union */
type EditState =
  | { type: "editItem"; item: InfoItem }
  | { type: "addItem" }
  | { type: "editLink"; itemId: string; linkIdx: number; link: InfoLink }
  | { type: "addLink"; itemId: string }
  | null;

type ItemDraft = { title: string; icon: string };
type LinkDraft = { label: string; url: string };

const Info = () => {
  const { trip, editSlot, actionSlot, setNavLocked } = useOutletContext<TripOutletContext>();
  const [reloads, setReloads] = useState(0);
  // The version the info was read at, which a save must name.
  const version = useRef(0);
  const session = useEditSession<InfoItem[]>(
    [],
    async (next) => {
      version.current = await saveTripData(trip.id, "info", next, version.current);
      return next;
    },
    { lockNav: setNavLocked, reload: () => setReloads((r) => r + 1) }
  );
  const { data: items, setData: setItems, load } = session;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editable, setEditable] = useState(false);
  const canEdit = editable && session.editing && !session.saving;

  /* Edit state */
  const [editState, setEditState] = useState<EditState>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft>({ title: "", icon: "" });
  const [linkDraft, setLinkDraft] = useState<LinkDraft>({ label: "", url: "" });

  useEffect(() => {
    if (!trip) return;
    loadTripData(trip.id, "info")
      .then(({ data, editable, version: read }) => {
        version.current = read ?? 0;
        load(data);
        setEditable(editable);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [trip, reloads]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── InfoItem actions ── */
  const openEditItem = (item: InfoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemDraft({ title: item.title, icon: item.icon });
    setEditState({ type: "editItem", item });
  };

  const openAddItem = () => {
    setItemDraft({ title: "", icon: "" });
    setEditState({ type: "addItem" });
  };

  const handleDeleteItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("確定要刪除這個資訊類別？")) return;
    setItems(items.filter((it) => it.id !== itemId));
  };

  /* ── InfoLink actions ── */
  const openEditLink = (itemId: string, linkIdx: number, link: InfoLink, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLinkDraft({ label: link.label, url: link.url });
    setEditState({ type: "editLink", itemId, linkIdx, link });
  };

  const openAddLink = (itemId: string) => {
    setLinkDraft({ label: "", url: "" });
    setEditState({ type: "addLink", itemId });
  };

  const handleDeleteLink = (itemId: string, linkIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("確定要刪除這個連結？")) return;
    setItems(items.map((it) =>
      it.id === itemId
        ? { ...it, links: it.links.filter((_, i) => i !== linkIdx) }
        : it
    ));
  };

  /* ── Apply the modal to the draft ── */
  const handleSave = () => {
    if (!editState) return;
    let next: InfoItem[];

    if (editState.type === "editItem") {
      next = items.map((it) =>
        it.id === editState.item.id ? { ...it, ...itemDraft } : it
      );
    } else if (editState.type === "addItem") {
      next = [...items, { id: `info-${Date.now()}`, ...itemDraft, links: [] }];
    } else if (editState.type === "editLink") {
      next = items.map((it) =>
        it.id === editState.itemId
          ? { ...it, links: it.links.map((l, i) => (i === editState.linkIdx ? { ...linkDraft } : l)) }
          : it
      );
    } else {
      // addLink
      next = items.map((it) =>
        it.id === editState.itemId
          ? { ...it, links: [...it.links, { ...linkDraft }] }
          : it
      );
    }

    setItems(next);
    setEditState(null);
  };

  const isItemModal = editState?.type === "editItem" || editState?.type === "addItem";
  const isLinkModal = editState?.type === "editLink" || editState?.type === "addLink";

  const modalTitle = (() => {
    if (!editState) return "";
    if (editState.type === "editItem") return "編輯資訊類別";
    if (editState.type === "addItem") return "新增資訊類別";
    if (editState.type === "editLink") return "編輯連結";
    return "新增連結";
  })();

  const retry = () => {
    setLoading(true);
    setError(false);
    setReloads((r) => r + 1);
  };
  const linkCount = items.reduce((n, it) => n + it.links.length, 0);

  return (
    <div style={{ padding: "20px 18px 84px", background: "var(--bg)" }}>
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
        <AddBtn onClick={openAddItem} label="新增類別" bar />,
        actionSlot
      )}

      <div className="flex items-baseline justify-between mb-3.5 mx-0.5">
        <div className="font-hand font-bold" style={{ fontSize: "1.75rem", lineHeight: 1, color: "var(--ink)" }}>
          小筆記
        </div>
        {!loading && !error && items.length > 0 && (
          <span className="font-mono" style={{ fontSize: ".7rem", letterSpacing: ".1em", color: "var(--ink-soft)" }}>
            {items.length} 類 · {linkCount} 個連結
          </span>
        )}
      </div>

      {loading && (
        [...Array(2)].map((_, i) => (
          <div key={i} className="skeleton" style={{
            height: i === 0 ? 180 : 130,
            borderRadius: 12,
            marginBottom: 16,
            transform: i % 2 === 0 ? "rotate(-.2deg)" : "rotate(.2deg)",
          }} />
        ))
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 font-hand" style={{ color: "var(--ink-soft)" }}>
          <span className="st-fd flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%" }}>
            <Icon name="cloudOff" size={24} strokeWidth={1.8} />
          </span>
          <p style={{ fontSize: "1.2rem", color: "var(--ink)" }}>資訊載入失敗</p>
          <button onClick={retry} className="font-hand font-bold" style={btn("primary")}>
            重試
          </button>
        </div>
      )}

      {!loading && !error && items.map((item, i) => (
        <div
          key={item.id}
          style={{
            background: "var(--paper)",
            border: "1px solid color-mix(in srgb, var(--rule) 55%, transparent)",
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
            boxShadow: "2px 2px 0 var(--rule)",
            transform: i % 2 === 0 ? "rotate(-.2deg)" : "rotate(.2deg)",
          }}
        >
          {/* Card header */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1.5px dashed var(--rule)" }}
          >
            <div
              className="st-in flex items-center justify-center font-hand font-bold shrink-0"
              style={{
                width: 40, height: 40, borderRadius: "50%",
                fontSize: 18,
                transform: "rotate(-3deg)",
              }}
            >
              <InfoIcon icon={item.icon} />
            </div>
            <div className="font-hand font-bold flex-1" style={{ fontSize: "1.45rem", lineHeight: 1, color: "var(--ink)" }}>
              {item.title}
            </div>
            {!canEdit && (
              <span className="font-mono" style={{ fontSize: ".7rem", color: "var(--ink-faint)" }}>{item.links.length}</span>
            )}
            {canEdit && (
              <div className="flex gap-0.5">
                <EditBtn onClick={(e) => openEditItem(item, e)} />
                <DeleteBtn onClick={(e) => handleDeleteItem(item.id, e)} />
              </div>
            )}
          </div>

          {/* Links */}
          {item.links.map((link, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between transition-all duration-150"
              style={{
                borderBottom: idx < item.links.length - 1 ? "1px dashed var(--rule)" : "none",
              }}
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between flex-1 min-w-0"
                style={{
                  minHeight: 46,
                  padding: "0 18px",
                  fontSize: ".95rem",
                  color: "var(--ink)",
                  textDecoration: "none",
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
                <span className="truncate">{link.label}</span>
                <span style={{ color: "var(--ink-faint)", flexShrink: 0, marginLeft: 8, display: "flex" }}><Icon name="external" size={14} /></span>
              </a>
              {canEdit && (
                <div className="flex gap-0.5 px-2 shrink-0">
                  <EditBtn onClick={(e) => openEditLink(item.id, idx, link, e)} />
                  <DeleteBtn onClick={(e) => handleDeleteLink(item.id, idx, e)} />
                </div>
              )}
            </div>
          ))}

          {/* Add link button */}
          {canEdit && (
            <div
              className="flex justify-center py-2"
              style={{ borderTop: item.links.length > 0 ? "1px dashed var(--rule)" : "none" }}
            >
              <AddBtn onClick={() => openAddLink(item.id)} label="新增連結" />
            </div>
          )}
        </div>
      ))}

      {/* InfoItem modal */}
      {canEdit && (
        <>
          <EditModal
            title={modalTitle}
            open={isItemModal}
            onClose={() => setEditState(null)}
            onSave={handleSave}
          >
            <FieldInput label="標題" value={itemDraft.title} onChange={(v) => setItemDraft((d) => ({ ...d, title: v }))} placeholder="資訊類別名稱" />
            <FieldInput label="圖示（Plane、Landmark 等名稱或 emoji）" value={itemDraft.icon} onChange={(v) => setItemDraft((d) => ({ ...d, icon: v }))} placeholder="Plane" />
          </EditModal>

          <EditModal
            title={modalTitle}
            open={isLinkModal}
            onClose={() => setEditState(null)}
            onSave={handleSave}
          >
            <FieldInput label="連結名稱" value={linkDraft.label} onChange={(v) => setLinkDraft((d) => ({ ...d, label: v }))} placeholder="網站名稱" />
            <FieldInput label="URL" value={linkDraft.url} onChange={(v) => setLinkDraft((d) => ({ ...d, url: v }))} placeholder="https://..." type="url" />
          </EditModal>
        </>
      )}
    </div>
  );
};

export default Info;
