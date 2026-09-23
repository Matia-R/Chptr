"use client";

import { AlertCircle } from "lucide-react";

import { useToast } from "~/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="down">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            {props.variant === "destructive" ? (
              <AlertCircle className="size-4 shrink-0" aria-hidden />
            ) : null}
            <div className="grid min-w-0 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
