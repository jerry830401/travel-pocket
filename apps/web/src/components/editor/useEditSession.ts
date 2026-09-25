import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";

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

/**
 * Draft editing for a page: in edit mode every change stays on screen until
 * `finish` saves it (with a toast either way) or `cancel` drops it.
 * `lockNav` is called with true while editing and false afterwards, so the
 * page around can stop navigation that would lose the draft.
 */
export function useEditSession<T>(
  initial: T,
  save: SaveDraft<T>,
  lockNav?: (locked: boolean) => void
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
    try {
      const next = await save(draft, saved, (s, d) => {
        setSaved(s);
        setDraft(d);
      });
      load(next);
      setEditing(false);
      showToast("已儲存");
    } catch (err) {
      showToast(`儲存失敗：${err instanceof Error ? err.message : err}`, "error");
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
