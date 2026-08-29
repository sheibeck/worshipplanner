# Run mode: enable automatic fullscreen for the output displays (one-time per computer)

When you **Run a service**, WorshipPlanner opens two output windows (Audience and
Confidence) and tries to put each one **fullscreen** on its assigned monitor.

Browsers only let a page enter fullscreen in response to a click **in that page**, and a
single click can only fullscreen **one** window — so two displays can't both go fullscreen
from one action. The one exception is Chrome/Edge's **"Automatic Fullscreen"** content
setting: once the app's origin is allowed on a computer, each output window can go
fullscreen on its own, with no clicking. This is a **one-time setup per presentation
computer**.

> Browser support: **Chrome / Edge (Chromium) 126+ only** — same as the rest of Run mode's
> multi-monitor features (the Window Management API is Chromium-only). Firefox/Safari are
> not supported for multi-monitor Run.

## The reliable way — the `AutomaticFullscreenAllowedForUrls` policy

Chrome does **not** let the app pop a permission prompt for this (by design), so it's set
as a browser **policy** for the app's origin. Do this once on each computer you run
services from.

Replace `ORIGIN` below with the app's real origin, e.g.
`https://worship-planner-bc515.web.app` (or your custom domain once deployed).

### Windows — Chrome (Registry)
Run once as an administrator (or import a `.reg` file):

```
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\AutomaticFullscreenAllowedForUrls" /v 1 /t REG_SZ /d "ORIGIN" /f
```

### Windows — Microsoft Edge (Registry)
```
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge\AutomaticFullscreenAllowedForUrls" /v 1 /t REG_SZ /d "ORIGIN" /f
```

Then **fully quit and reopen** the browser. Verify at `chrome://policy` (or `edge://policy`)
that `AutomaticFullscreenAllowedForUrls` lists your origin.

### macOS / Linux / managed fleets
Use the same policy name via Google's Chrome Enterprise policy templates (Group Policy on
Windows domains, a configuration profile / plist on macOS, or JSON policy on Linux). The
value is a list of URL patterns; a single origin like `https://worship-planner-bc515.web.app`
is enough.

## Verifying it worked
1. Set the policy, restart the browser.
2. Open a service and click **Go live**.
3. Both the Audience and Confidence windows should open **fullscreen on their monitors with
   no clicks**.

## If it's not set (fallbacks)
If the setting isn't enabled, Run mode still works — it just can't auto-fullscreen both
displays:
- It attempts capability delegation on Go live (may fullscreen one display).
- A **"Fullscreen displays"** button in the control header re-sends them.
- As a last resort, **tapping anywhere** on an output window makes that one fullscreen.

None of these can fullscreen *both* from one action — that's exactly why the one-time
Automatic Fullscreen setting above is the real fix.

## Note: needs a stable origin
The policy targets an **origin**, so this is meant for the **deployed** app (e.g. Firebase
Hosting over HTTPS), not a `localhost` dev server. To test locally you can point the policy
at `http://localhost:5173` (your dev port), but the durable setup uses the production origin.
