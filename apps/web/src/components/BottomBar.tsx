/* The bar under a page: TripView's tabs, or the add buttons while editing.
   It keeps its height when empty (the add buttons hide while saving), so the
   page does not jump and the toast stays above it. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 flex items-center px-2 pb-3 pt-2.5 z-30"
      style={{ minHeight: 64, background: "var(--paper)", borderTop: "1.5px dashed var(--rule)" }}
    >
      {children}
    </div>
  );
}
