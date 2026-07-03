"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "~/lib/utils";
import { drawerOverlayClass, setOverlayOpen } from "./overlay-backdrop";

const Drawer = ({
  shouldScaleBackground = false,
  noBodyStyles = true,
  fixed = true,
  repositionInputs = true,
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  React.useEffect(() => {
    if (typeof open !== "boolean") return;

    setOverlayOpen(open);

    return () => {
      if (open) {
        setOverlayOpen(false);
      }
    };
  }, [open]);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOverlayOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      noBodyStyles={noBodyStyles}
      fixed={fixed}
      repositionInputs={repositionInputs}
      open={open}
      onOpenChange={handleOpenChange}
      {...props}
    />
  );
};

Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

/** Plain scrim — not Vaul/Radix overlay (opacity + RemoveScroll stacking break on iOS). */
const DrawerOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(drawerOverlayClass, className)}
    {...props}
  />
));

DrawerOverlay.displayName = "DrawerOverlay";

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
    showHandle?: boolean;
    bottomUnderlay?: boolean;
    bottomUnderlayHeight?: number;
  }
>(
  (
    {
      className,
      overlayClassName,
      showHandle = true,
      bottomUnderlay = false,
      bottomUnderlayHeight,
      children,
      ...props
    },
    ref,
  ) => (
    <DrawerPortal>
      <DrawerClose asChild>
        <DrawerOverlay className={overlayClassName} />
      </DrawerClose>

      {bottomUnderlay && bottomUnderlayHeight && bottomUnderlayHeight > 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 bg-sidebar"
          style={{ height: `${bottomUnderlayHeight}px` }}
        />
      ) : null}

      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t-[10px] border-x border-t border-sidebar-border bg-sidebar",
          className,
        )}
        {...props}
      >
        {showHandle ? (
          <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-sidebar-border" />
        ) : null}

        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  ),
);

DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);

DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);

DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));

DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));

DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
