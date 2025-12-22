"use client";

import * as React from "react";

interface FocusModeContextProps {
  isFocusMode: boolean;
  setIsFocusMode: (enabled: boolean) => void;
  previousSidebarOpen: boolean | null;
  setPreviousSidebarOpen: (open: boolean | null) => void;
}

const FocusModeContext = React.createContext<FocusModeContextProps | undefined>(
  undefined,
);

export function useFocusMode() {
  const context = React.useContext(FocusModeContext);
  if (!context) {
    throw new Error("useFocusMode must be used within a FocusModeProvider");
  }
  return context;
}

interface FocusModeProviderProps {
  children: React.ReactNode;
}

export function FocusModeProvider({ children }: FocusModeProviderProps) {
  const [isFocusMode, setIsFocusMode] = React.useState(false);
  const [previousSidebarOpen, setPreviousSidebarOpen] = React.useState<boolean | null>(null);

  const value = React.useMemo(
    () => ({
      isFocusMode,
      setIsFocusMode,
      previousSidebarOpen,
      setPreviousSidebarOpen,
    }),
    [isFocusMode, previousSidebarOpen],
  );

  return (
    <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>
  );
}

