/**
 * Shared password helpers for the VPS reset / reinstall flows.
 *
 * Tencent Lighthouse rejects passwords that fall outside its character class
 * and length requirements; we mirror those rules here so we can validate on
 * the client before submitting and surface a per-rule checklist to the user.
 */

const SPECIAL_CHARS = "`~!@#$%^&*()-_=+[]{};:'\",.<>?/\\|";
// Anchored test for `validateVpsPassword`; the literal alphabet drives the
// generator below.
const SPECIAL_RE = /[`~!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|]/;
const CHAR_SET_PATTERNS = [/[a-z]/, /[A-Z]/, /[0-9]/, SPECIAL_RE];

export type PasswordValidation = {
  hasLength: boolean;
  noSpaces: boolean;
  noLeadingSlash: boolean;
  hasThreeSets: boolean;
  allPassed: boolean;
};

export function validateVpsPassword(pw: string): PasswordValidation {
  const hasLength = pw.length >= 8 && pw.length <= 30;
  const noSpaces = !pw.includes(" ");
  const noLeadingSlash = !pw.startsWith("/");
  const hasThreeSets = CHAR_SET_PATTERNS.filter((r) => r.test(pw)).length >= 3;
  return {
    hasLength,
    noSpaces,
    noLeadingSlash,
    hasThreeSets,
    allPassed: hasLength && noSpaces && noLeadingSlash && hasThreeSets,
  };
}

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGIT = "0123456789";
// Drop `/` so we never produce a password that fails the leading-slash rule
// after shuffling. The remaining specials still satisfy `SPECIAL_RE`.
const SPECIAL = SPECIAL_CHARS.replace(/\//g, "");
const ALPHABET = LOWER + UPPER + DIGIT + SPECIAL;

function pick(alphabet: string): string {
  // Modulo bias is on the order of 10^-8 for our alphabet sizes — irrelevant
  // for this use case but documented so a future contributor doesn't add
  // rejection sampling and reintroduce subtle bugs.
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return alphabet[arr[0] % alphabet.length];
}

/**
 * Generate a password that is guaranteed to satisfy `validateVpsPassword`:
 * one character from each of lowercase, uppercase, digit, and special
 * (covering all four classes), then padded with the full alphabet and
 * shuffled. The final shuffle uses Fisher-Yates with `crypto.getRandomValues`.
 */
export function generateVpsPassword(length = 16): string {
  if (length < 8 || length > 30) {
    throw new Error(`generateVpsPassword: length must be 8-30, got ${length}`);
  }

  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SPECIAL)];
  while (chars.length < length) chars.push(pick(ALPHABET));

  // Fisher-Yates shuffle.
  const rand = new Uint32Array(chars.length);
  crypto.getRandomValues(rand);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = rand[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
