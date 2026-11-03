import { adminServer } from "../../../src/server/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return adminServer().session(request);
}
export async function POST(request: Request) {
  return adminServer().session(request);
}
export async function DELETE(request: Request) {
  return adminServer().session(request);
}
