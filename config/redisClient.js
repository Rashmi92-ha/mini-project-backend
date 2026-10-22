const { createClient } = require("redis");

console.log(
  "Redis URL available in redisClient.js:",
  Boolean(process.env.REDIS_URL)
);

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  console.error("Redis connection error:", error);
});

redisClient.on("connect", () => {
  console.log("Redis connection established.");
});

redisClient.on("ready", () => {
  console.log("Redis client is ready.");
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

module.exports = { redisClient, connectRedis };