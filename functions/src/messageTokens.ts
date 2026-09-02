/** See .planning/codebase/STACK.md (Backend Stack Notes (R318) § functions/src/messageTokens.ts) */

/** The token values a message is rendered against, for ONE recipient. */
export interface MessageTokenContext {
  /** The service date, already formatted for display by the caller. */
  serviceDate: string;
  /** THIS recipient's own resolved role names (R139) — the per-recipient field. */
  theirRoles: string[];
  /** THIS recipient's own display name (R154) — the per-recipient field. */
  recipientName: string;
  /** The service's SONG-slot titles, in service order. */
  songTitles: string[];
  /** The service's public share-link URL, or '' when none exists (A1). */
  serviceLink: string;
}

/**
 * Substituted for `{{their_roles}}` when a recipient has no matched role names
 * (e.g. someone included only as an individual). A readable placeholder rather
 * than a bare empty string so a sentence like "You are scheduled for
 * {{their_roles}}" still reads sensibly. Documented per the plan's implementer
 * discretion note.
 */
export const EMPTY_ROLES_PLACEHOLDER = "your role";

/** Escapes a literal string for safe use inside a RegExp. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces every occurrence of a literal `{{name}}` token with `value`. */
function replaceToken(template: string, name: string, value: string): string {
  const pattern = new RegExp(escapeRegExp(`{{${name}}}`), "g");
  return template.replace(pattern, value);
}

/**
 * Renders the supported merge tokens in `template` from `ctx`. PURE: no
 * side effects, no I/O. Called once per recipient by the send trigger so
 * `{{their_roles}}` and `{{name}}` are personalized. Unknown tokens are left untouched.
 */
export function renderMessageTokens(template: string, ctx: MessageTokenContext): string {
  const rolesText = ctx.theirRoles.length > 0 ? ctx.theirRoles.join(", ") : EMPTY_ROLES_PLACEHOLDER;
  const songText = ctx.songTitles.join(", ");

  let out = template;
  out = replaceToken(out, "service_date", ctx.serviceDate);
  out = replaceToken(out, "their_roles", rolesText);
  out = replaceToken(out, "name", ctx.recipientName);
  out = replaceToken(out, "song_list", songText);
  out = replaceToken(out, "service_link", ctx.serviceLink);
  return out;
}
