// Available avatar background colors
export const AVATAR_COLORS = ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'indigo'] as const;

export type AvatarColorName = typeof AVATAR_COLORS[number];

// Map color names to hex values
export const colorNameToHex: Record<AvatarColorName, string> = {
    blue: "#60a5fa",
    green: "#4ade80",
    red: "#f87171",
    yellow: "#facc15",
    purple: "#c084fc",
    pink: "#f472b6",
    indigo: "#818cf8",
} as const;

// Map color names to Tailwind background classes
export const colorNameToTailwindClass: Record<AvatarColorName, string> = {
    blue: "bg-blue-400",
    green: "bg-green-400",
    red: "bg-red-400",
    yellow: "bg-yellow-400",
    purple: "bg-purple-400",
    pink: "bg-pink-400",
    indigo: "bg-indigo-400",
} as const;

// Default fallback color (blue)
const DEFAULT_COLOR: AvatarColorName = 'blue';
const DEFAULT_HEX = colorNameToHex[DEFAULT_COLOR];
const DEFAULT_TAILWIND_CLASS = "bg-blue-400";

/**
 * Get the hex color value for an avatar background color name.
 * Returns the default color if the provided color name is invalid.
 */
export function getAvatarColorHex(colorName: string | null | undefined): string {
    if (!colorName) {
        return DEFAULT_HEX;
    }
    return colorNameToHex[colorName as AvatarColorName] ?? DEFAULT_HEX;
}

/**
 * Get the Tailwind class for an avatar background color name.
 * Returns the default class if the provided color name is invalid.
 */
export function getAvatarColorTailwindClass(colorName: string | null | undefined): string {
    if (!colorName) {
        return DEFAULT_TAILWIND_CLASS;
    }
    return colorNameToTailwindClass[colorName as AvatarColorName] ?? DEFAULT_TAILWIND_CLASS;
}

/**
 * Get a random avatar color name.
 */
export function getRandomAvatarColor(): AvatarColorName {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? DEFAULT_COLOR;
}

