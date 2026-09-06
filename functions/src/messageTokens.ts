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
  /** R375: THIS recipient's personal, server-minted magic sign-in link
   * (getAuth().generateSignInWithEmailLink) — the per-recipient field. */
  rehearseLink: string;
}

/**
 * Substituted for `{{their_roles}}` when a recipient has no matched role names
 * (e.g. someone included only as an individual). A readable placeholder rather
 * than a bare empty string so a sentence like "You are scheduled for
 * {{their_roles}}" still reads sensibly. Documented per the plan's implementer
 * discretion note.
 */
export const EMPTY_ROLES_PLACEHOLDER = "your role";

/** Matches a literal `{{token_name}}` placeholder; the capture group is the name. */
const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Renders the supported merge tokens in `template` from `ctx`. PURE: no
 * side effects, no I/O. Called once per recipient by the send trigger so
 * `{{their_roles}}` and `{{name}}` are personalized. Unknown tokens are left untouched.
 *
 * IN-01 (125-REVIEW.md): every token is resolved in a SINGLE pass over the
 * ORIGINAL template, rather than cascading `.replace()` calls where each pass
 * re-scans the PREVIOUS pass's already-substituted output. Chained passes let
 * an inserted, editor/roster-controlled value (e.g. a recipient name or song
 * title) that happens to literally contain `{{rehearse_link}}` get
 * re-substituted by a later pass — reinjecting a personal auth link into what
 * was meant to be a literal string. A single pass over the original text can
 * never re-scan a substituted value, because String.replace with a global
 * regex only visits the input once, left to right.
 */
export function renderMessageTokens(template: string, ctx: MessageTokenContext): string {
  const rolesText = ctx.theirRoles.length > 0 ? ctx.theirRoles.join(", ") : EMPTY_ROLES_PLACEHOLDER;
  const songText = ctx.songTitles.join(", ");

  const values: Record<string, string> = {
    service_date: ctx.serviceDate,
    their_roles: rolesText,
    name: ctx.recipientName,
    song_list: songText,
    service_link: ctx.serviceLink,
    rehearse_link: ctx.rehearseLink,
  };

  return template.replace(TOKEN_PATTERN, (match, tokenName: string) =>
    Object.prototype.hasOwnProperty.call(values, tokenName) ? values[tokenName]! : match,
  );
}
