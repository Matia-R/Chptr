"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "~/lib/utils"

type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Viewport
> & {
  className?: string
  /**
   * Reserve a column for the vertical scrollbar so it sits flush to the
   * right of the content instead of overlaying it.
   */
  scrollbarGutter?: boolean
  /** Radix visibility: `hover` (default), `scroll`, `always`, or `auto`. */
  type?: React.ComponentPropsWithoutRef<
    typeof ScrollAreaPrimitive.Root
  >["type"]
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Viewport>,
  ScrollAreaProps
>(({ className, children, scrollbarGutter = false, type, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    type={type}
    className={cn("relative overflow-hidden", className)}
  >
    <ScrollAreaPrimitive.Viewport
      ref={ref}
      {...props}
      className="h-full w-full rounded-[inherit]"
    >
      {scrollbarGutter ? <div className="pr-2.5">{children}</div> : children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
      "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
      "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
