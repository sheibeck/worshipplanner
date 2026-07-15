"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useUnsavedGuard = useUnsavedGuard;
var vue_1 = require("vue");
/**
 * Tracks a baseline snapshot of a drawer's editable form state (captured when
 * the drawer opens) and exposes a reactive dirty-check plus a
 * confirm-before-discard guard for Cancel / backdrop / × close actions.
 *
 * `isDirty` is a reactive computed (true when the current form state differs
 * from the captured baseline) so it can drive Save-button styling in templates,
 * mirroring ServiceEditorView's dirty-aware Save affordance.
 *
 * Usage:
 *   const guard = useUnsavedGuard(() => ({ ...form.value }))
 *   // after seeding form state on open:
 *   guard.capture()
 *   // in the template: :disabled="!guard.isDirty.value" (or destructured)
 *   // in the close handler:
 *   function onCancel() {
 *     if (!guard.confirmDiscard()) return
 *     emit('close')
 *   }
 */
function useUnsavedGuard(getSnapshot) {
    var baseline = (0, vue_1.ref)('');
    function capture() {
        baseline.value = JSON.stringify(getSnapshot());
    }
    var isDirty = (0, vue_1.computed)(function () { return JSON.stringify(getSnapshot()) !== baseline.value; });
    function confirmDiscard() {
        if (!isDirty.value)
            return true;
        return window.confirm('You have unsaved changes. Discard them?');
    }
    return { capture: capture, isDirty: isDirty, confirmDiscard: confirmDiscard };
}
