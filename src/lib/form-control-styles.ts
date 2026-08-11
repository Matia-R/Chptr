import { cn } from "~/lib/utils";

/**
 * Shared resting / interaction surface for text inputs and textareas.
 * Quiet by default; hover and focus carry the visual feedback.
 */
export const formControlClassName = cn(
  "border border-input bg-[hsl(var(--input-background))] text-foreground shadow-none",
  "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
  "placeholder:text-muted-foreground/65",
  "hover:border-foreground/20",
  "focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/10",
  "disabled:cursor-not-allowed disabled:opacity-50",
);
