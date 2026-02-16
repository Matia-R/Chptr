export function DocumentLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-9 w-2/3 rounded-lg bg-muted" />
      <div className="space-y-3">
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 w-[95%] rounded bg-muted" />
        <div className="h-4 w-[90%] rounded bg-muted" />
      </div>
      <div className="space-y-3 pt-4">
        <div className="h-4 w-[85%] rounded bg-muted" />
        <div className="h-4 w-[88%] rounded bg-muted" />
        <div className="h-4 w-[92%] rounded bg-muted" />
      </div>
    </div>
  );
}
