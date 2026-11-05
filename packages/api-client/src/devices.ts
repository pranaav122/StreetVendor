import { z } from "zod";
import type { ApiClient } from "./index";

export interface PushDriver {
  platform: "android" | "ios" | "web";
  physical: boolean;
  nativeBuild: boolean;
  projectId: string | null;
  permission(ask: boolean): Promise<boolean>;
  token(projectId: string): Promise<string>;
  installation(): Promise<string>;
}
type Registration = {
  state: "ENABLED" | "DISABLED" | "UNAVAILABLE" | "DENIED";
  message: string;
};
export async function registerInstallation(
  client: ApiClient,
  device: PushDriver,
  appKind: "customer" | "vendor",
  askPermission: boolean,
): Promise<Registration> {
  const visitsDestination = appKind === "vendor" ? "Customers" : "Your visits";
  if (device.platform === "web" || !device.physical || !device.nativeBuild)
    return {
      state: "UNAVAILABLE",
      message: `Remote notifications are unavailable in this preview. Check ${visitsDestination} for updates.`,
    };
  const project = z.string().uuid().safeParse(device.projectId);
  // Avoid a permission prompt when this build cannot obtain a usable address.
  if (!project.success)
    return {
      state: "UNAVAILABLE",
      message: `Notifications are unavailable in this version. Check ${visitsDestination} for updates.`,
    };
  if (!(await device.permission(askPermission)))
    return {
      state: "DENIED",
      message:
        "Notification permission is off. You can change it in device settings.",
    };
  const token = await device.token(project.data),
    installation = z
      .string()
      .uuid()
      .parse(await device.installation());
  const response = z.object({ delivery_enabled: z.boolean() }).parse(
    await client.request(`/devices/${installation}`, {
      method: "PUT",
      body: {
        app_kind: appKind,
        platform: device.platform,
        project_id: project.data,
        token,
      },
    }),
  );
  return response.delivery_enabled
    ? {
        state: "ENABLED",
        message:
          "Device registered. Notifications depend on your connection and device settings.",
      }
    : {
        state: "DISABLED",
        message: "Device registered. Server notification delivery is disabled.",
      };
}
