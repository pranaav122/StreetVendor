import type { SharingController } from "./controller";
export async function revalidateSharing(options: {
  controller: SharingController;
  requiresBackground: boolean;
  permissions(): Promise<{ foreground: boolean; background: boolean }>;
  business(): Promise<{ is_available: boolean }>;
  disableBackground(): void;
}) {
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
    if (current() && !business.is_available)
      await options.controller.offline().catch(() => {});
  } catch {
    if (!current()) return;
    // Unknown permission/account state fails closed. Attempt immediate server
    // erasure too; the controller keeps a visible retry state if it cannot connect.
    options.disableBackground();
    await options.controller.offline().catch(() => {});
  }
}
