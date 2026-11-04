/**
 * Revalidates permissions and server availability when the app resumes.
 * Earlier consent is not proof that sharing is still authorised after suspension.
 */
import type { SharingController } from "./controller";
export async function revalidateSharing(options: {
  controller: SharingController;
  requiresBackground: boolean;
  permissions(): Promise<{ foreground: boolean; background: boolean }>;
  business(): Promise<{ is_available: boolean }>;
  disableBackground(): void;
}) {
  const wasSharing = ["ONLINE", "DEGRADED", "STARTING"].includes(
    options.controller.state.status,
  );
  // Stop callbacks and invalidate late uploads before any OS/network await.
  // A resumed screen must not claim live sharing while authority is unknown.
  if (wasSharing)
    options.controller.pause("Checking location permission and account.");
  const generation = options.controller.generation;
  const current = () => generation === options.controller.generation;
  try {
    const permission = await options.permissions();
    // A delayed OS/account read belongs to the consent that started it.
    if (!current()) return;
    if (
      !permission.foreground ||
      (options.requiresBackground && !permission.background)
    ) {
      options.disableBackground();
      await options.controller.offline().catch(() => {});
      return;
    }
    const business = await options.business();
    if (!current()) return;
    if (!business.is_available)
      await options.controller.offline().catch(() => {});
    else if (wasSharing)
      await options.controller.resumeAfterValidation(generation);
  } catch {
    if (!current()) return;
    // Unknown permission/account state fails closed. Attempt immediate server
    // erasure too; the controller keeps a visible retry state if it cannot connect.
    options.disableBackground();
    await options.controller.offline().catch(() => {});
  }
}
