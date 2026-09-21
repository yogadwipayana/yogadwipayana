import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  lg: "h-12 w-12 text-[18px]",
} as const;

/**
 * Up to two uppercase initials: first and last word of the display name
 * ("Yoga Dwipayana" → "YD"), otherwise the first character of the email.
 * `Array.from` keeps a name that starts with an emoji or other astral
 * character from being split mid code point.
 */
export function getInitials(
  name?: string | null,
  email?: string | null,
): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  const fromName = picked.map((word) => Array.from(word)[0]).join("");
  if (fromName) return fromName.toUpperCase();

  const fromEmail = email ? Array.from(email.trim())[0] : undefined;
  return fromEmail ? fromEmail.toUpperCase() : "?";
}

/**
 * Initials avatar in the brand gradient. Decorative only (`aria-hidden`):
 * the surrounding button or text is responsible for naming the user.
 */
export function Avatar({
  name,
  email,
  size = "sm",
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-[#3ecf8e] to-[#24b47e] font-mono font-medium leading-none text-[#171717]",
        SIZES[size],
        className,
      )}
    >
      {getInitials(name, email)}
    </span>
  );
}
