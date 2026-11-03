let stopSharing: (() => Promise<void>) | undefined;
export function registerSharingCleanup(cleanup: () => Promise<void>) {
  stopSharing = cleanup;
  return () => {
    if (stopSharing === cleanup) stopSharing = undefined;
  };
}
export async function stopDeviceSharing() {
  await stopSharing?.();
}
