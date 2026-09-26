import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import type { InfoItem, InfoLink } from "../types";
import type { TripOutletContext } from "./TripView";
import { apiEnabled, loadTripData, saveTripData } from "../dataSource";
import { EditModal, FieldInput, EditBtn, DeleteBtn, AddBtn, EditControls, ReadOnlyBanner } from "../components/editor";
import { useEditSession } from "../components/editor/useEditSession";

const EXT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

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
      .catch(console.error);
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

  return (
    <div style={{ padding: "18px 18px 84px", background: "var(--bg)" }}>
      {apiEnabled && !loading && !editable && <ReadOnlyBanner />}

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
        <AddBtn onClick={openAddItem} label="新增類別" bar />,
        actionSlot
      )}

      <div className="font-hand font-bold mb-3.5" style={{ fontSize: "1.6rem", color: "var(--ink)" }}>
        小筆記
      </div>

      {loading && (
        <div className="text-center py-10 font-hand" style={{ color: "var(--ink-soft)", fontSize: "1.2rem" }}>
          載入資訊中...
        </div>
      )}

      {!loading && items.map((item, i) => (
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
            <div className="font-hand font-bold flex-1" style={{ fontSize: "1.4rem", lineHeight: 1, color: "var(--ink)" }}>
              {item.title}
            </div>
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
                  padding: "12px 18px",
                  fontSize: ".92rem",
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
                <span style={{ color: "var(--ink-faint)", flexShrink: 0, marginLeft: 8 }}>{EXT}</span>
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
            <FieldInput label="圖示（emoji）" value={itemDraft.icon} onChange={(v) => setItemDraft((d) => ({ ...d, icon: v }))} placeholder="🛂" />
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
