export default function HistoryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="glass-panel h-36 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-panel h-28 rounded-2xl" />
        ))}
      </div>
      <div className="glass-panel h-16 rounded-2xl" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass-panel h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
