import ClaudeColor from "@lobehub/icons/es/Claude/components/Color";
import ClaudeMono from "@lobehub/icons/es/Claude/components/Mono";
import OpenAIMono from "@lobehub/icons/es/OpenAI/components/Mono";

/**
 * Provider logos from `@lobehub/icons`, deep-imported from the icon-only
 * modules. The package's barrel export (`import { OpenAI } from
 * "@lobehub/icons"`) also pulls Avatar/Combine components that require the
 * uninstalled `@lobehub/ui` and `antd` peer dependencies, so import icons
 * one component at a time like this instead.
 *
 * Mono marks inherit the caller's text color via `currentColor`; Claude
 * also has an official brand-color variant (`ClaudeIcon`).
 */

export function OpenAIIcon({ className }: { className?: string }) {
  return <OpenAIMono className={className} />;
}

/** Claude mark in its official brand color. */
export function ClaudeIcon({ className }: { className?: string }) {
  return <ClaudeColor className={className} />;
}

/** Claude mark tinted by the caller's text color. */
export function ClaudeMonoIcon({ className }: { className?: string }) {
  return <ClaudeMono className={className} />;
}

/** Maps a catalogue provider name to its logo; null for unknown providers. */
export function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  if (provider === "OpenAI") return <OpenAIIcon className={className} />;
  if (provider === "Anthropic") return <ClaudeIcon className={className} />;
  return null;
}
