"use client";

import { useEffect, useState } from "react";

/** Browser `offline` / `online`. True as soon as the network is gone. */
export function useBrowserOffline() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const sync = () => setIsOffline(!navigator.onLine);
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);

  return isOffline;
}
