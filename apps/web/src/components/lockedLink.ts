/* Stops a link while a page is in edit mode, so its draft is not lost. */
export function lockedLink(locked: boolean) {
  return {
    "aria-disabled": locked || undefined,
    tabIndex: locked ? -1 : undefined,
    onClick: (e: React.MouseEvent) => { if (locked) e.preventDefault(); },
  };
}
