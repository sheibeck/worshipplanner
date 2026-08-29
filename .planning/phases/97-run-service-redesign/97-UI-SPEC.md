# Phase 97: Run Service Redesign — UI-SPEC (design contract)

**Status:** draft (authored from the owner's approved Claude Design import, 2026-08-28)
**Source design:** `Run Service.dc.html` in claude.ai design project
`e8e6c287-3e88-402f-88e1-7ad6d5101fa2` (Nocturne design system
`nocturne-67cd9946-e94d-4ca6-a321-43b2d8edbd8f`). Re-fetch via the DesignSync tool
(`get_file`) if exact pixel values are needed; this spec distills it faithfully.

This is a REDESIGN of the Phase 95 `RunControlView.vue` + the Phase 94 `ConfidenceOutputView.vue`
plus a Run affordance on the service list, driven by owner hardware-UAT feedback. It supersedes the
Phase 95 control-screen layout and the Phase 94 vertical confidence split.

---

## Design tokens (Nocturne — use as a Run-screen-scoped palette)

The Run surfaces are a standalone full-viewport dark "control room." Adopt these exact values as
local CSS custom properties on the Run/output roots (do NOT retheme the whole app):

```
--color-bg:        #161826   (design body override: #101220 for the outer canvas; use #12131c/#101220 for the app root)
--color-surface:   #232532
--color-text:      #e9e9ed
--color-accent:    #9184d9   (blurple — the product Pro accent; replaces the app's indigo ON THIS SCREEN ONLY)
--color-accent-200:#e7e5fe  --color-accent-300:#d2cefd  --color-accent-800:#423a6a  --color-accent-900:#2b2741
--color-neutral-200:#e4e7f5 --300:#cfd3e5 --400:#b2b6ca --500:#9397ab --600:#75798c --700:#595d6c --800:#3f424d --900:#292b31
--radius-sm:4px  --radius-md:8px  --radius-lg:14px
--shadow-sm: 0 0 0 1px #3f424d
--shadow-md: 0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,.55)
Font: Inter (already loaded via slideTypography / app).
Header bar bg: #1a1c2b ; rail bg: #141624 ; slide grounds: #000 / #0a0b12.
Status colors: LIVE red #ff5964 (bg #3a1a1f, border #6d2b33, text #ff8b93); OK green #6fbf8b;
  amber/attention #e0b23c.
```

Implementation note: the design uses the blurple accent, but the owner explicitly asked the live
indicator to be GREEN once live (not red). See "Live status" below — we diverge from the design's
red on-air badge in favor of the owner's green.

---

## Three states (from design 6a / 6b / 6c)

### State A — Pre-flight ("Ready when you are") — REPLACES the corner Go-live chip (owner fix #5)
Full-viewport screen, three regions:
- **Header (58px, bg #1a1c2b):** a `REHEARSE` / status pill; service name + `date · N slides · M items`;
  right side: a **Displays cluster** (Audience + Confidence dots, AMBER/"Not open" pre-live, with a
  "Manage" link → `/monitor-setup` in a new tab) and an **Exit** button.
- **Left rail (268px, bg #141624):** "Order of service" list from `sortedSlotsWithIndex` — per item:
  right-aligned number, uppercase section label, title, slide count. Active item = accent bg/border.
  Footer note: "Nothing is on the screens yet. Slides advance only after you go live."
- **Center (radial-gradient ground):** a centered ~640px column:
  - Heading "Ready when you are" + sub "Going live opens the audience and confidence windows and puts
    slide 1 on the screens."
  - **Audience display card** + **Confidence display card**: each a row with a small preview/"no signal"
    thumbnail, the monitor name + `resolution · will open on this screen`, a "Not open" amber badge, and
    a "Change" link (→ monitor setup). Pull the real assigned monitor from `loadMapping()`/live screens.
  - A readiness checklist line (green ✓): "All N slides rendered" — drive from the assembled slides'
    `renderState` (a real, honest check; NOT the design's CCLI validation, which we omit).
  - **Buttons:** primary **"▶ Go live"** (accent outline + subtle glow) and secondary
    **"Rehearse without screens"** (owner-approved feature) + an "Enter" key hint. Go live runs the
    existing activation-correct open+place path (Phase 95 `openOutputs`); Rehearse enters the live
    state WITHOUT opening output windows.

### State B — Live (program / preview / filmstrip / transport) — the main control screen
- **Header (58px):** the **LIVE status** (see below), service name, `Item X of N · slide Y of M ·
  K slides total`; the **Clock + Elapsed** timers (owner-approved); right: the Displays cluster
  (dots GREEN when live/open, grey when off) + "Manage"; an **End service** button (→ the existing
  Escape-confirm exit).
- **Left rail (268px):** order-of-service; the ACTIVE item expands to show its slide list (section
  labels: Title, Verse 1, Chorus…), current slide highlighted. Click item → jump to its first slide;
  click a slide row → jump to that slide.
- **Center, three sub-regions top→bottom:**
  1. **Top row (flex):**
     - **Program / "On screen"** (flex ~1.55): the large current-slide preview with a live frame
       (green ring per owner; design used red) + a small "LIVE" tag; `<SlideCanvas :interactive="false">`
       showing the current slide with its background.
     - **"Next up"** (flex ~1): the next slide preview at a SMALLER font, scaled to the pane (owner
       fix #2 — the upcoming slide must render smaller to fit); a "Take →" hint; optionally a "Then"
       (next-next) one-line chip. (OMIT Key/BPM — no data.)
     - **Right column (272px):** an optional per-item **Note** card (only if the service model carries a
       note; otherwise omit); an **Output** panel with **Black** and **Clear** buttons (owner-approved
       blackout; OMIT Logo — no asset) wired to the channel `blackout` field; (OMIT the "Follow me on
       confidence" toggle and the Activity/"people watching" feed — no presence system).
  2. **In-item filmstrip** (owner-approved): "Slides in this item" — a horizontal strip of the current
     item's slides as small `SlideCanvas` thumbnails (scaled), current = live frame, next = accent
     frame, each click-to-jump; a trailing "Next item →" affordance. Built from the assembled slides
     filtered by the active `slotIndex`.
  3. **Transport bar (54px, bg #141624):** Previous / **Next slide** buttons; the keyboard legend
     (`Space` next, `↑ ↓` item, `B` black, `Esc` exit); a **Service progress** bar + `Y of M`.

### State C — Displays panel & recovery (rework of the Phase 96 recovery UI)
- A full-width **red bar** when an output closed: "The audience display closed — the congregation sees
  nothing right now" + "You won't lose your place. Reopening puts slide N back up." + a **Reopen** button.
  (This replaces the Phase 96 small amber chip; keep the Phase 96 non-destructive reopen logic + the
  position-preserved handshake.)
- A **Displays** panel (reachable from the header "Manage"): per-screen cards (Audience / Confidence /
  Stage-off) with a live thumbnail of what each output is painting, name/resolution/screen, and
  Reopen / "Move to screen…" actions. Keep the Phase 96 `screenschange` reassign + closed-poll behavior;
  this is a richer presentation of it. (Stage = a disabled/"Off" placeholder only — no 3rd-output build.)

---

## Owner fixes → where addressed
1. **Confidence left/right** — `ConfidenceOutputView`: change the 70/30 VERTICAL split to a side-by-side
   current | next (roughly 60/40 or 50/50; current dominant on the LEFT, next on the RIGHT), both
   `suppressBackground`. Keep the Phase 94 black-suppression invariant + last-slide no-reflow.
2. **Next-up smaller font** — Next-up preview (control) and the confidence next pane render at a smaller
   scale that fits the smaller pane; scaling the SlideCanvas output down is acceptable.
3. **Run on service listing** — a Run affordance on each LOCKED service row in `ServicesView`, beside the
   existing row actions (print/share/etc.); gate `isLocked && orgId` (viewer-inclusive, R275), navigates
   to `/run/:serviceId?org=`.
4. **Live status red→green** — pre-live the display dots are muted/amber "Not open"; on **Go live** the
   live state becomes real and the indicator/dots turn **GREEN** (diverging from the design's red on-air
   badge per the owner's explicit request). No alarming red dot before you are live.
5. **Go live relocated** — from a corner chip to the centered State-A pre-flight panel.
6. **Outputs default to fullscreen** — each output window (`AudienceOutputView`/`ConfidenceOutputView`)
   SELF-fullscreens on load: on mount, using the already-granted window-management permission, resolve
   its assigned screen (passed via a query param / the saved mapping) and call
   `element.requestFullscreen({ screen })` from its own context. The cross-document
   `win.document.documentElement.requestFullscreen()` the control currently attempts
   (`RunControlView.vue:980`) is unreliable — replace reliance on it with self-fullscreen. The existing
   "Re-enter fullscreen" affordance stays ONLY as a fallback (and should auto-attempt once before
   showing). NOTE: real cross-monitor fullscreen is only provable on hardware — this is a human-UAT item.

## Explicitly OMITTED (no data/system — would be fake UI)
Activity feed / "N people watching" (no presence), CCLI-number preflight validation, Key/BPM,
"Follow me on confidence", Logo-cut output (no asset), the Stage / 3rd output (v2.4 = audience+confidence).
Show "Stage" only as a disabled "Off" placeholder if it aids the Displays panel layout.

## Constraints carried from prior phases (do NOT regress)
- Single-writer channel + monotonic `seq` + `onHello` resend (Phase 95); honest open state machine
  (`idle/opening/placed/fallback/partial/blocked`) + WR-01 stale guard (Phase 95); non-destructive
  reopen + `screenschange` reassign + poll cleanup (Phase 96); confidence black-suppression + last-slide
  no-reflow (Phase 94); receive-only outputs never `postState`.
- Blackout: the channel already carries `blackout`; wiring Black/Clear posts `blackout:true/false` and
  the output windows render a black overlay when true. This is the FIRST real use of that field.
