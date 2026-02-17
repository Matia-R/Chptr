import * as React from "react";
import { AlertCircleIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&_svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "bg-sidebar text-destructive [&_svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const AlertContext =
  React.createContext<VariantProps<typeof alertVariants>["variant"]>("default");

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant = "default", children, ...props }, ref) => (
  <AlertContext.Provider value={variant}>
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  </AlertContext.Provider>
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(AlertContext);
  const title = (
    <h5
      ref={ref}
      className={cn("mb-2 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );

  if (variant === "destructive") {
    return (
      <div className="mb-2 flex items-center gap-2 [&>*:last-child]:mb-0">
        <AlertCircleIcon className="h-4 w-4 shrink-0" aria-hidden />
        {title}
      </div>
    );
  }

  return title;
});
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(AlertContext);
  return (
    <div
      ref={ref}
      className={cn(
        "text-sm [&_p]:leading-relaxed",
        variant === "destructive" && "pl-6",
        className,
      )}
      {...props}
    />
  );
});
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
