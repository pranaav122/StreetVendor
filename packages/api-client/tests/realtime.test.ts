import assert from "node:assert/strict";
import { test } from "node:test";
import { RealtimeClient, type SocketLike } from "../src/realtime.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
class FakeSocket implements SocketLike {
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: Record<string, unknown>[] = [];
  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }
  close() {
    this.readyState = 3;
  }
}
const authenticate = (socket: FakeSocket) =>
  socket.onmessage?.({
    data: JSON.stringify({
      type: "AUTHENTICATED",
      connection_id: requestId,
      expires_at: Date.now() / 1000 + 600,
      resync_required: true,
    }),
  });

test("socket authenticates in a frame and resynchronizes subscriptions", async () => {
  const socket = new FakeSocket();
  let url = "";
  let resyncs = 0;
  const client = new RealtimeClient({
    baseUrl: "https://api.example.com",
    session: {
      session: async () => ({ access_token: "private-token" }),
      refreshAccess: async () => "rotated",
    },
    createSocket: (value) => {
      url = value;
      return socket;
    },
    makeId: () => requestId,
    onMessage: () => {},
    onResync: () => {
      resyncs++;
    },
  });
  client.subscribe(requestId);
  await client.start();
  socket.onopen?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(url, "wss://api.example.com/api/v1/ws");
  assert.ok(!url.includes("private-token"));
  assert.equal(socket.sent[0]?.type, "AUTHENTICATE");
  assert.equal(socket.sent[0]?.access_token, "private-token");
  authenticate(socket);
  assert.equal(resyncs, 1);
  assert.equal(socket.sent[1]?.type, "SUBSCRIBE_REQUEST");
  client.stop();
  assert.equal(socket.readyState, 3);
});

test("unsubscribed coordinates are ignored even if already in flight", async () => {
  const socket = new FakeSocket();
  let delivered = 0;
  const client = new RealtimeClient({
    baseUrl: "https://api.example.com",
    session: {
      session: async () => ({ access_token: "private-token" }),
      refreshAccess: async () => "rotated",
    },
    createSocket: () => socket,
    makeId: () => requestId,
    onMessage: () => {
      delivered++;
    },
    onResync: () => {},
  });
  client.subscribe(requestId);
  await client.start();
  authenticate(socket);
  client.unsubscribe(requestId);
  socket.onmessage?.({
    data: JSON.stringify({
      type: "VENDOR_LOCATION_UPDATED",
      event_id: requestId,
      request_id: requestId,
      request_version: 2,
      occurred_at: new Date().toISOString(),
      data: {
        latitude: 13.08,
        longitude: 80.27,
        accuracy_m: 10,
        captured_at: new Date().toISOString(),
      },
    }),
  });
  assert.equal(delivered, 0);
  client.stop();
});

test("stopping during secure-store read prevents an old connection opening", async () => {
  let release!: (value: { access_token: string }) => void;
  let opened = 0;
  const pending = new Promise<{ access_token: string }>((resolve) => {
    release = resolve;
  });
  const client = new RealtimeClient({
    baseUrl: "https://api.example.com",
    session: { session: () => pending, refreshAccess: async () => "rotated" },
    createSocket: () => {
      opened++;
      return new FakeSocket();
    },
    makeId: () => requestId,
    onMessage: () => {},
    onResync: () => {},
  });
  const starting = client.start();
  client.stop();
  release({ access_token: "old-token" });
  await starting;
  assert.equal(opened, 0);
});
