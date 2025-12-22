"use client";

import * as React from "react";
import { Header } from "./header";
import { useScroll } from "./scroll-context";

export function HeaderWrapper() {
  const { isScrolled } = useScroll();
  return <Header isScrolled={isScrolled} />;
}

