import * as React from "react"

import { formControlClassName } from "~/lib/form-control-styles"
import { cn } from "~/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md px-3 py-2 text-base md:text-sm",
        formControlClassName,
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
