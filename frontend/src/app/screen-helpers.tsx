
/*
 * Page shell. PAGE carries the rhythm as a container gap, so nothing
 * inside sets an outer margin against a sibling — a heading that pushes
 * its neighbour away and a container that also spaces its children give
 * a gap nobody chose. PAGE_TITLE therefore has no margin of its own.
 * The text-box trim matters: without it a declared vertical 40 renders
 * a few px larger than the horizontal 40 beside it.
 */
export const PAGE = "@container grid gap-page content-start";
// The type of a title, on its own. Split out for the login screen, which is
// outside the shell and so has no sticky head to defer to on mobile.
export const TITLE_TYPE =
  "m-0 [text-box:trim-both_cap_alphabetic] text-title font-bold tracking-tight text-text";
// Hidden on mobile: the shell's sticky head names the page there, and two
// titles on one screen is one title too many.
export const PAGE_TITLE = `${TITLE_TYPE} max-mobile:hidden`;

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-2 my-3">
      <p className="text-control font-semibold text-text m-0">{title}</p>
      <p className="max-w-[60ch] text-control text-muted leading-normal m-0">{description}</p>
    </div>
  );
}
