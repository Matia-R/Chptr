import * as React from "react"

import { formControlClassName } from "~/lib/form-control-styles"
import { cn } from "~/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md px-3 py-2 text-sm",
                    formControlClassName,
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
