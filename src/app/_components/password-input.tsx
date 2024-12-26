"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "~/lib/utils"
import { Input } from "./input"

const PasswordInput = React.forwardRef<
    HTMLInputElement,
    Omit<React.ComponentProps<typeof Input>, "type">
>(({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
        <div className="relative">
            <Input
                type={showPassword ? "text" : "password"}
                className={cn("pr-10", className)}
                ref={ref}
                {...props}
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
            >
                {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                )}
            </button>
        </div>
    )
})
PasswordInput.displayName = "PasswordInput"

export { PasswordInput } 