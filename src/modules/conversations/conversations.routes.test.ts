import assert from "node:assert/strict";
import test from "node:test";
import routes from "./conversations.routes.js";
import { messageListQuerySchema, sendMessageSchema } from "./conversations.validation.js";

test("mounts appointment conversation and REST message APIs", () => {
  const mounted = (routes as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route!.methods)[0]!.toUpperCase()} ${layer.route!.path}`);
  assert.deepEqual(mounted, [
    "GET /conversations/appointment/:appointmentId",
    "GET /conversations/:conversationId/messages",
    "POST /conversations/:conversationId/messages",
  ]);
});

test("message input and polling cursor are bounded", () => {
  assert.equal(sendMessageSchema.safeParse({ content: "   " }).success, false);
  assert.equal(sendMessageSchema.safeParse({ content: "x".repeat(2001) }).success, false);
  assert.deepEqual(sendMessageSchema.parse({ content: "  hello  " }), { content: "hello" });
  assert.equal(messageListQuerySchema.parse({}).limit, 20);
  assert.equal(messageListQuerySchema.safeParse({ limit: 51 }).success, false);
});
