import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { ConflictError } from "../../dataSource";

/**
 * Writes a draft to the API and resolves with what is now saved. A save made
 * of several requests calls `progress` after each one, so a failure halfway
 * keeps what already went through and a retry only sends the rest.
 */
export type SaveDraft<T> = (
  draft: T,
  saved: T,
  progress: (saved: T, draft: T) => void
) => Promise<T>;

export interface EditSessionOptions {
  /**
   * Called with true while editing and false afterwards, so the page around
   * can stop navigation that would lose the draft.
   */
  lockNav?: (locked: boolean) => void;
  /** Loads the page's data again; called when a save finds it changed since it was read. */
  reload?: () => void;
}

/**
 * Draft editing for a page: in edit mode every change stays on screen until
 * `finish` saves it (with a toast either way) or `cancel` drops it. When the
 * save is refused because someone else saved first (`ConflictError`), the
 * draft is dropped and the page reloads, instead of overwriting their change.
 */
export function useEditSession<T>(
  initial: T,
  save: SaveDraft<T>,
  { lockNav, reload }: EditSessionOptions = {}
) {
  const [saved, setSaved] = useState<T>(initial);
  const [draft, setDraft] = useState<T>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const dirty = draft !== saved;

  useEffect(() => {
    if (!editing || !lockNav) return;
    lockNav(true);
    return () => lockNav(false);
  }, [editing, lockNav]);

  const load = (data: T) => {
    setSaved(data);
    setDraft(data);
  };

  const cancel = () => {
    if (dirty && !confirm("確定放棄這次的變更？")) return;
    setDraft(saved);
    setEditing(false);
  };

  const finish = async () => {
    if (!dirty) {
      setEditing(false);
      return;
    }
    setSaving(true);
    let current = saved;
    try {
      const next = await save(draft, saved, (s, d) => {
        current = s;
        setSaved(s);
        setDraft(d);
      });
      load(next);
      setEditing(false);
      showToast("已儲存");
    } catch (err) {
      if (err instanceof ConflictError) {
        setDraft(current);
        setEditing(false);
        showToast("別人剛修改過，已載入最新版本", "error");
        reload?.();
      } else {
        showToast(`儲存失敗：${err instanceof Error ? err.message : err}`, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    /** The draft while editing; the saved data otherwise (they are the same then). */
    data: draft,
    setData: setDraft,
    load,
    editing,
    saving,
    start: () => setEditing(true),
    cancel,
    finish,
  };
}
