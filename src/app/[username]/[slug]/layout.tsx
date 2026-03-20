import "@blocknote/core/style.css";

import "~/app/_components/editor/style.css";

export default function PublishedDocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
