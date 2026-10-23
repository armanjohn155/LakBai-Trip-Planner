/**
 * "Budgeting" panel.
 *
 * Placeholder for now. Swap the <img> for the real budget card (amount,
 * progress bar, expenses list) when it's ready — the carousel only cares that
 * the root element fills the panel card.
 */
export function BudgetPanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* TODO: use /images/panels/budgeting.png once the real artwork exists. */}
      <img
        src="/images/trip-placeholder.svg"
        alt="Preview of a white budget card showing the total amount, a progress bar, and an expenses list"
        className="h-full w-full rounded-2xl object-contain"
        loading="lazy"
      />
    </div>
  );
}
