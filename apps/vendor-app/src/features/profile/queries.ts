import { ApiError, type ApiClient } from "@mystreetvendor/api-client";
import { vendorSchema } from "@mystreetvendor/shared-types";
export async function ownBusiness(client: ApiClient, signal?: AbortSignal) {
  try {
    return vendorSchema.parse(await client.request("/vendors/me", { signal }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
