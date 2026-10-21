

import app from "./app.js";
import { env } from "./config/env.js";
import { orderService } from "./modules/orders/services/order.service.js";
import { startMeetingProvisioningWorker } from "./integrations/google-calendar/meeting-provisioning.worker.js";

const ORDER_EXPIRY_CLEANUP_INTERVAL_MS = 60_000;
let cleanupRunning = false;

const runExpiredOrderCleanup = async () => {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try {
    await orderService.cleanupExpiredUnpaidOrders();
  } catch (error) {
    console.error("Expired order cleanup failed:", error);
  } finally {
    cleanupRunning = false;
  }
};

void runExpiredOrderCleanup();
const orderCleanupTimer = setInterval(
  () => void runExpiredOrderCleanup(),
  ORDER_EXPIRY_CLEANUP_INTERVAL_MS,
);
orderCleanupTimer.unref();
const stopMeetingWorker = startMeetingProvisioningWorker();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received. Closing server...`);
  clearInterval(orderCleanupTimer);
  stopMeetingWorker();

  server.close((error) => {
    if (error) {
      console.error("Failed to close server:", error);
      process.exitCode = 1;
      return;
    }

    console.log("Server closed successfully.");
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
