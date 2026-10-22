

import app from "./app.js";
import { env } from "./config/env.js";
import { orderService } from "./modules/orders/services/order.service.js";
import { appointmentService } from "./modules/appointments/services/appointment.service.js";
import { prisma } from "./lib/prisma.js";
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

const APPOINTMENT_EXPIRY_CLEANUP_INTERVAL_MS = 60_000;
let appointmentCleanupRunning = false;

const runExpiredAppointmentCleanup = async () => {
  if (appointmentCleanupRunning) return;
  appointmentCleanupRunning = true;
  try {
    await appointmentService.cleanupExpiredAppointments();
  } catch (error) {
    console.error("Expired appointment cleanup failed:", error);
  } finally {
    appointmentCleanupRunning = false;
  }
};

void runExpiredAppointmentCleanup();
const appointmentCleanupTimer = setInterval(
  () => void runExpiredAppointmentCleanup(),
  APPOINTMENT_EXPIRY_CLEANUP_INTERVAL_MS,
);
appointmentCleanupTimer.unref();

const stopMeetingWorker = startMeetingProvisioningWorker();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received. Closing server...`);
  clearInterval(orderCleanupTimer);
  clearInterval(appointmentCleanupTimer);
  stopMeetingWorker();

  server.close(async (error) => {
    if (error) {
      console.error("Failed to close server:", error);
      process.exitCode = 1;
    }

    try {
      await prisma.$disconnect();
      console.log("Database disconnected successfully.");
    } catch (dbError) {
      console.error("Error disconnecting database:", dbError);
    }

    console.log("Server closed successfully.");
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
