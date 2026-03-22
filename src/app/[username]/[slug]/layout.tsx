import "@blocknote/core/style.css";

import "~/app/_components/editor/style.css";

import { PublishedScrollRoot } from "./published-scroll-root";

/** Runs before paint so wheel scrolling works before React hydrates (class pairs with globals.css). */
const publishedScrollBootstrap = `(function(){document.documentElement.classList.add("published-page-scroll")})();`;

export default function PublishedDocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: publishedScrollBootstrap }} />
      <PublishedScrollRoot>{children}</PublishedScrollRoot>
    </>
  );
}
