"use client";

import { Avatar, AvatarFallback } from "./avatar";
import { cn } from "~/lib/utils";
import {
  getAvatarColorTailwindClass,
  getAvatarColorHex,
  type AvatarColorName,
} from "~/lib/avatar-colors";

interface AvatarGroupProps {
  avatars: Array<{
    initials: string;
    color?: AvatarColorName;
  }>;
  borderColor?: "background" | "sidebar";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function AvatarGroup({
  avatars,
  borderColor = "background",
  size = "md",
  className,
}: AvatarGroupProps) {
  const defaultColors: AvatarColorName[] = [
    "blue",
    "green",
    "yellow",
    "red",
    "purple",
    "pink",
    "indigo",
  ];

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {avatars.map((avatar, index) => {
        const color = avatar.color ?? defaultColors[index % defaultColors.length];
        const colorClass = getAvatarColorTailwindClass(color);
        const colorHex = getAvatarColorHex(color);
        const sizeClass = sizeClasses[size];

        return (
          <Avatar
            key={index}
            className={cn(
              "rounded-full border-2",
              sizeClass,
              borderColor === "sidebar"
                ? "border-sidebar bg-sidebar"
                : "border-background bg-background",
            )}
          >
            <AvatarFallback
              className={cn("text-black", colorClass, size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs")}
              style={{ backgroundColor: colorHex }}
            >
              {avatar.initials}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

