"use client";

import * as React from "react";

interface ScrollContextType {
  isScrolled: boolean;
  setIsScrolled: (value: boolean) => void;
}

const ScrollContext = React.createContext<ScrollContextType | undefined>(
  undefined
);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = React.useState(false);

  return (
    <ScrollContext.Provider value={{ isScrolled, setIsScrolled }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  const context = React.useContext(ScrollContext);
  if (context === undefined) {
    throw new Error("useScroll must be used within a ScrollProvider");
  }
  return context;
}

