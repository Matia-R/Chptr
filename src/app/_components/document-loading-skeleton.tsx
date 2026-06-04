import "~/app/_components/editor/document-text-column.css";

/**
 * Loading placeholder aligned to BlockNote's text column (.bn-editor inner bounds).
 * Uses the same .bn-editor wrapper + padding as the live editor.
 */
export function DocumentLoadingSkeleton() {
  return (
    <div className="bn-editor">
      <div className="document-loading-skeleton animate-pulse space-y-4">
        <div className="h-9 w-2/3 max-w-full rounded-lg bg-muted" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-[92%] rounded bg-muted" />
        </div>
        <div className="space-y-3 pt-4">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-[96%] rounded bg-muted" />
          <div className="h-4 w-[88%] rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
