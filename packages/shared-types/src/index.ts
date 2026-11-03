import { z } from "zod";

export const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.literal("bearer"),
  expires_in: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof tokenSchema>;
export const pointSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export type Point = z.infer<typeof pointSchema>;
export const fixSchema = pointSchema.extend({
  accuracy_m: z.number().finite().nonnegative().max(100),
  captured_at: z.string().datetime({ offset: true }),
});
export type LocationFix = z.infer<typeof fixSchema>;
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  role: z.enum(["customer", "vendor", "admin"]),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
  display_name: z.string(),
  preferred_language: z.enum(["en", "ta"]),
  created_at: z.string(),
  email_verified_at: z.string().nullable(),
});
export type User = z.infer<typeof userSchema>;
export const categorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name_en: z.string(),
  name_ta: z.string(),
});
export type Category = z.infer<typeof categorySchema>;
export const vendorSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  description: z.string(),
  verification_status: z.enum(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]),
  is_available: z.boolean(),
  categories: z.array(categorySchema),
  location_sharing_enabled: z.boolean().optional(),
});
export type Vendor = z.infer<typeof vendorSchema>;
export const nearbySchema = z
  .object({
    vendor_id: z.string().uuid(),
    display_name: z.string(),
    approximate_location: pointSchema.extend({ radius_m: z.number() }),
    distance_band_m: z.object({ min: z.number(), max: z.number() }),
  })
  .passthrough();
export type NearbyVendor = z.infer<typeof nearbySchema>;
export const visitStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "APPROACHING",
  "ARRIVED",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
]);
export const visitSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  customer_name: z.string(),
  vendor_name: z.string(),
  status: visitStatusSchema,
  version: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string(),
  closed_at: z.string().nullable(),
  meeting_point: pointSchema.nullable(),
  meeting_label: z.string().nullable(),
  reason: z.string().nullable(),
  allowed_actions: z.array(
    z.enum(["accept", "decline", "approach", "complete", "cancel"]),
  ),
});
export type Visit = z.infer<typeof visitSchema>;
export const activeVisitStatuses = new Set<Visit["status"]>([
  "PENDING",
  "ACCEPTED",
  "APPROACHING",
  "ARRIVED",
]);
export const trackableVisitStatuses = new Set<Visit["status"]>([
  "ACCEPTED",
  "APPROACHING",
  "ARRIVED",
]);

const id = z.string().uuid();
const version = z.number().int().positive();
const eventBase = z.object({
  event_id: id,
  request_id: id,
  request_version: version,
  occurred_at: z.string(),
});
const stateEvent = eventBase.extend({
  type: z.enum([
    "REQUEST_CREATED",
    "REQUEST_ACCEPTED",
    "REQUEST_APPROACHING",
    "VENDOR_ARRIVED",
    "REQUEST_COMPLETED",
    "REQUEST_DECLINED",
    "REQUEST_CANCELLED",
    "REQUEST_EXPIRED",
  ]),
  data: z.object({ status: visitStatusSchema }),
});
const locationEvent = eventBase.extend({
  type: z.literal("VENDOR_LOCATION_UPDATED"),
  data: fixSchema,
});
const ownLocationEvent = z.object({
  type: z.literal("VENDOR_LOCATION_UPDATED"),
  event_id: id,
  request_id: z.null(),
  vendor_id: id,
  occurred_at: z.string(),
  data: fixSchema,
});
const serverMessageSchema = z.union([
  stateEvent,
  locationEvent,
  ownLocationEvent,
  z.object({
    type: z.literal("AUTHENTICATED"),
    connection_id: id,
    expires_at: z.union([z.string(), z.number()]),
    resync_required: z.boolean(),
  }),
  z.object({ type: z.literal("PONG"), id }),
  z.object({ type: z.literal("RESYNC_REQUIRED") }),
  z.object({
    type: z.enum(["SUBSCRIBED_REQUEST", "UNSUBSCRIBED_REQUEST"]),
    request_id: id,
    request_version: version.optional(),
  }),
  z.object({
    type: z.enum(["VENDOR_ONLINE", "VENDOR_OFFLINE"]),
    event_id: id,
    data: z.object({
      vendor_id: id,
      is_available: z.boolean(),
      location_sharing_enabled: z.boolean(),
    }),
  }),
  z.object({ type: z.literal("ERROR"), code: z.string().max(100) }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export function parseServerMessage(raw: string): ServerMessage | null {
  if (raw.length > 16384) return null;
  try {
    const result = serverMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
