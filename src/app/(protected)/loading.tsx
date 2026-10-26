// Shown inside the app shell while the next page's server payload loads, so a
// click on the sidebar or bottom nav responds immediately instead of leaving
// the previous page on screen with no sign anything is happening.
export default function ProtectedLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5" aria-busy="true" aria-label="טוען">
      <div className="space-y-2">
        <div className="command-skeleton h-7 w-52 rounded-lg" />
        <div className="command-skeleton h-4 w-72 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="command-skeleton h-20 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="command-skeleton h-64 rounded-[var(--radius-card)]" />
    </div>
  );
}
