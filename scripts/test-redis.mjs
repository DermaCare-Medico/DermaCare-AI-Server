import "dotenv/config";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

try {
  const result = await redis.ping();
  console.log("Redis connection successful:", result);
} catch (error) {
  console.error("Redis connection failed:", error);
  process.exitCode = 1;
}