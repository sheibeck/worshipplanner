import { describe, expect, it } from "vitest";
import {
  EMPTY_ROLES_PLACEHOLDER,
  renderMessageTokens,
  type MessageTokenContext,
} from "./messageTokens";

// A representative context; individual tests override the fields they exercise.
function ctx(overrides: Partial<MessageTokenContext> = {}): MessageTokenContext {
  return {
    serviceDate: "Sunday, August 17, 2026",
    theirRoles: ["guitar"],
    songTitles: ["Amazing Grace", "How Great Thou Art"],
    serviceLink: "https://app.example.com/share/tok_abc",
    recipientName: "Alex Kim",
    ...overrides,
  };
}

describe("renderMessageTokens", () => {
  it("replaces {{service_date}} with the provided (already-formatted) service date", () => {
    const out = renderMessageTokens("See you on {{service_date}}.", ctx());
    expect(out).toBe("See you on Sunday, August 17, 2026.");
  });

  it("replaces {{their_roles}} with the CURRENT recipient's own roles joined with ', '", () => {
    const out = renderMessageTokens("You are scheduled for: {{their_roles}}", ctx({ theirRoles: ["sound", "livestream"] }));
    expect(out).toBe("You are scheduled for: sound, livestream");
  });

  it("R139: the SAME body template renders different {{their_roles}} for person A vs person B", () => {
    const template = "Your role(s): {{their_roles}}";
    const personA = renderMessageTokens(template, ctx({ theirRoles: ["guitar"] }));
    const personB = renderMessageTokens(template, ctx({ theirRoles: ["sound", "livestream"] }));
    expect(personA).toBe("Your role(s): guitar");
    expect(personB).toBe("Your role(s): sound, livestream");
    expect(personA).not.toBe(personB);
  });

  it("replaces {{name}} with the CURRENT recipient's own display name (R154 server)", () => {
    const out = renderMessageTokens("Hi {{name}}", ctx({ recipientName: "Alex Kim" }));
    expect(out).toBe("Hi Alex Kim");
  });

  it("R154: the SAME body template renders different {{name}} for recipient A vs recipient B", () => {
    const template = "Hi {{name}}, thanks for serving!";
    const personA = renderMessageTokens(template, ctx({ recipientName: "Alex Kim" }));
    const personB = renderMessageTokens(template, ctx({ recipientName: "Sam Lee" }));
    expect(personA).toBe("Hi Alex Kim, thanks for serving!");
    expect(personB).toBe("Hi Sam Lee, thanks for serving!");
    expect(personA).not.toBe(personB);
  });

  it("replaces every occurrence of a repeated {{name}} token, not just the first", () => {
    const out = renderMessageTokens("{{name}} — {{name}}", ctx({ recipientName: "Alex Kim" }));
    expect(out).toBe("Alex Kim — Alex Kim");
  });

  it("renders an empty {{their_roles}} list as the documented placeholder, not a bare empty string", () => {
    const out = renderMessageTokens("Your role(s): {{their_roles}}", ctx({ theirRoles: [] }));
    expect(out).toBe(`Your role(s): ${EMPTY_ROLES_PLACEHOLDER}`);
    expect(EMPTY_ROLES_PLACEHOLDER.length).toBeGreaterThan(0);
  });

  it("replaces {{song_list}} with the SONG titles in the given order, comma-joined", () => {
    const out = renderMessageTokens("Songs: {{song_list}}", ctx({ songTitles: ["First", "Second", "Third"] }));
    expect(out).toBe("Songs: First, Second, Third");
  });

  it("renders {{song_list}} as empty when there are no songs", () => {
    const out = renderMessageTokens("Songs: {{song_list}}", ctx({ songTitles: [] }));
    expect(out).toBe("Songs: ");
  });

  it("replaces {{service_link}} with the provided share URL", () => {
    const out = renderMessageTokens("Plan: {{service_link}}", ctx({ serviceLink: "https://x.test/share/z" }));
    expect(out).toBe("Plan: https://x.test/share/z");
  });

  it("substitutes '' for {{service_link}} when no share link exists (A1 empty substitution)", () => {
    const out = renderMessageTokens("Plan: {{service_link}}", ctx({ serviceLink: "" }));
    expect(out).toBe("Plan: ");
  });

  it("replaces every occurrence of a repeated token, not just the first", () => {
    const out = renderMessageTokens("{{service_date}} / {{service_date}}", ctx({ serviceDate: "D1" }));
    expect(out).toBe("D1 / D1");
  });

  it("leaves unknown {{tokens}} untouched", () => {
    const out = renderMessageTokens("Hello {{first_name}} — {{service_date}}", ctx({ serviceDate: "D1" }));
    expect(out).toBe("Hello {{first_name}} — D1");
  });

  it("is a no-op on a template containing no tokens", () => {
    const raw = "Plain text, no tokens here.";
    expect(renderMessageTokens(raw, ctx())).toBe(raw);
  });

  it("renders subject and body from the SAME raw inputs (both may carry tokens)", () => {
    const c = ctx({ serviceDate: "Aug 17", theirRoles: ["drums"], songTitles: ["S1"], serviceLink: "L" });
    const subject = renderMessageTokens("Reminder for {{service_date}}", c);
    const body = renderMessageTokens("You: {{their_roles}}. Songs: {{song_list}}. Plan: {{service_link}}", c);
    expect(subject).toBe("Reminder for Aug 17");
    expect(body).toBe("You: drums. Songs: S1. Plan: L");
  });

  it("renders all four tokens together in one template", () => {
    const c = ctx({
      serviceDate: "Aug 17",
      theirRoles: ["bass"],
      songTitles: ["A", "B"],
      serviceLink: "https://x/share/1",
    });
    const out = renderMessageTokens(
      "{{service_date}} | {{their_roles}} | {{song_list}} | {{service_link}}",
      c,
    );
    expect(out).toBe("Aug 17 | bass | A, B | https://x/share/1");
  });
});
