<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4" data-testid="fullscreen-setup-panel">
    <h2 class="text-base font-semibold text-gray-100">Automatic fullscreen</h2>
    <p class="text-xs text-gray-500 mt-1">
      One-time setup so both displays go fullscreen on their own when you click Go live &mdash; no per-window
      clicking.
    </p>

    <!-- State 1: checking -->
    <div v-if="status === 'checking'" class="flex items-center gap-2 mt-3" data-testid="fullscreen-setup-status-checking">
      <svg class="h-4 w-4 text-gray-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V4.708A8 8 0 004 12z"
        ></path>
      </svg>
      <span class="text-sm text-gray-400">Checking this computer's setup&hellip;</span>
    </div>

    <!-- State 2: ready -->
    <div v-else-if="status === 'ready'" class="flex items-center gap-2 mt-3" data-testid="fullscreen-setup-status-ready">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-sm font-semibold text-green-400">
        This computer is set up for automatic fullscreen.
      </span>
    </div>

    <!-- State 3: not-ready -->
    <div v-else-if="status === 'not-ready'" class="mt-3" data-testid="fullscreen-setup-status-not-ready">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h3 class="text-sm font-semibold text-amber-200">One-time setup needed</h3>
      </div>
      <p class="text-sm text-gray-400 mt-1">
        This computer hasn't been set up for automatic fullscreen yet. Download the setup file below, run it
        once, then come back here.
      </p>

      <!-- Primary download -->
      <button
        type="button"
        data-testid="fullscreen-setup-download-button"
        class="mt-4 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-normal text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
        @click="onDownload"
      >
        Download setup file for {{ browserLabelText }} on {{ osLabelText }}
      </button>

      <p v-if="downloadError" class="text-red-400 text-xs mt-2" data-testid="fullscreen-setup-download-error">
        {{ downloadError }}
      </p>

      <!-- Windows-only secondary link, no admin badge/lock icon -->
      <p v-if="os === 'windows'" class="text-xs text-gray-500 mt-2">
        No admin rights on this computer?
        <button
          type="button"
          data-testid="fullscreen-setup-admin-download-link"
          class="text-gray-400 hover:text-gray-200 underline underline-offset-2"
          @click="onDownloadAdmin"
        >
          Download the admin (IT-installed) version instead
        </button>
      </p>

      <!-- Per-OS numbered instructions -->
      <ol class="text-sm text-gray-300 mt-4 space-y-2 list-decimal list-inside" data-testid="fullscreen-setup-instructions">
        <li>Download the file above.</li>
        <li v-html="stepTwoVerb"></li>
        <li>Fully quit and reopen {{ browserLabelText }} (closing the tab is not enough).</li>
        <li>Come back to this page and click <strong>Confirm fullscreen support</strong> below.</li>
      </ol>

      <!-- Honest friction caveat -->
      <p class="text-xs text-amber-300/80 mt-3" data-testid="fullscreen-setup-caveat">
        {{ caveatText }}
      </p>

      <button
        type="button"
        data-testid="fullscreen-setup-confirm-button"
        class="mt-4 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
        @click="onConfirm"
      >
        Confirm fullscreen support
      </button>

      <!-- State 3b: troubleshooting, only after a still-not-ready confirm -->
      <div
        v-if="showTroubleshooting"
        class="mt-4 pt-4 border-t border-amber-800/40"
        data-testid="fullscreen-setup-troubleshooting"
      >
        <h4 class="text-xs font-semibold text-amber-200/90 uppercase tracking-wide">Still not working?</h4>
        <ul class="text-xs text-gray-400 mt-2 space-y-1.5 list-disc list-inside">
          <li>
            Make sure you fully quit {{ browserLabelText }} (all windows) and reopened it &mdash; a policy
            change only takes effect after a full restart, not a tab refresh.
          </li>
          <li v-if="os === 'windows'">
            If your IT department locks down the registry, ask them to install the
            <button type="button" class="underline" @click="onDownloadAdmin">admin version</button>
            instead.
          </li>
          <li v-else>
            If you don't have an administrator password on this computer, ask whoever manages it to run the
            setup file.
          </li>
          <li>
            Using Firefox, Safari, or another non-Chromium browser? Automatic fullscreen setup isn't available
            there &mdash; switch to Chrome or Edge, or just tap each display to make it fullscreen when you Run
            a service.
          </li>
        </ul>
      </div>
    </div>

    <!-- State 4: unsupported -->
    <div v-else class="mt-3" data-testid="fullscreen-setup-status-unsupported">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.25 11.25l.041-.021a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <h3 class="text-sm font-semibold text-gray-300">Not available in this browser</h3>
      </div>
      <p class="text-sm text-gray-400 mt-1">
        Automatic multi-monitor fullscreen needs Chrome or Edge on this computer. You can still run services
        here &mdash; each display just needs one tap to go fullscreen.
      </p>
      <button
        type="button"
        data-testid="fullscreen-setup-confirm-button"
        class="mt-3 text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
        @click="onConfirm"
      >
        Check again
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFullscreenReadiness } from '@/composables/useFullscreenReadiness'
import { detectOS, detectBrowser, osLabel, browserLabel } from '@/utils/osDetect'
import { buildPolicyArtifact, type WindowsRegScope } from '@/utils/fullscreenPolicyFiles'
import { downloadTextFile } from '@/utils/downloadTextFile'

const { status, recheck } = useFullscreenReadiness()

// Computed once — the OS/browser this computer is running, never re-detected
// on re-render (a real change here would require an actual browser restart,
// which already drives the panel back through 'checking' via recheck()).
const os = detectOS()
const browser = detectBrowser()
const osLabelText = osLabel(os)
const browserLabelText = browserLabel(browser)

const downloadError = ref<string | null>(null)
const attempted = ref(false)

// R287: troubleshooting is a RESPONSE to an attempt, never upfront noise —
// it only mounts after at least one Confirm click has resolved to still
// not-ready, never on first paint.
const showTroubleshooting = computed(() => attempted.value && status.value === 'not-ready')

const stepTwoVerb = computed(() => {
  switch (os) {
    case 'windows':
      return 'Double-click the downloaded file. Windows/Chrome may warn that it "could be dangerous" &mdash; click <strong>Keep</strong> (or <strong>More info &rarr; Keep anyway</strong>). This is expected for a settings file like this one.'
    case 'macos':
      return 'Open the downloaded file, then finish installing it in <strong>System Settings &rarr; Profiles</strong> &mdash; you\'ll need this Mac\'s administrator password.'
    case 'linux':
      return "Move the downloaded file into Chrome's policy folder using a terminal with <code>sudo</code> (the file includes the exact path and command)."
    default:
      return 'Follow the instructions included in the downloaded file to install it on this computer.'
  }
})

const caveatText = computed(() => {
  switch (os) {
    case 'windows':
      return 'You may see a browser or Windows security warning when you open this file — that\'s expected for any downloaded settings file. Click through it, don\'t cancel.'
    case 'macos':
      return "This step needs an administrator password on this Mac. If you don't have one, ask whoever manages this computer to run it."
    case 'linux':
      return "This step needs terminal + sudo access. If that's not you, ask whoever manages this computer to run it."
    default:
      return "This step may need administrator access on this computer. If that's not you, ask whoever manages it to run the setup file."
  }
})

// R286 / CONTEXT Decision 2 / T-98-04: origin is read from
// `window.location.origin` ONLY here, at download time — never hardcoded,
// never threaded in from a route/query param or prop.
function triggerDownload(scope: WindowsRegScope): void {
  try {
    const artifact = buildPolicyArtifact(os, window.location.origin, scope)
    downloadTextFile(artifact.filename, artifact.contents, artifact.mimeType)
    downloadError.value = null
  } catch {
    downloadError.value =
      "Couldn't start the download. Try again, or copy the setup steps at docs/run-fullscreen-setup.md for a manual walkthrough."
  }
}

function onDownload(): void {
  triggerDownload('HKCU')
}

function onDownloadAdmin(): void {
  triggerDownload('HKLM')
}

async function onConfirm(): Promise<void> {
  await recheck()
  attempted.value = true
}
</script>
