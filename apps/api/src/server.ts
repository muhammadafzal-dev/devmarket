import { env } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
import { createPaymentGateway } from "./payments/gateway.js";
const prisma = new PrismaClient();
const app = createApp(prisma, createPaymentGateway(env));
const server = app.listen(
  Number(env.API_PORT || env.PORT || 4000),
  env.API_HOST || "127.0.0.1",
  () => console.log("DevMarket API listening"),
);
process.on("SIGTERM", () => {
  server.close();
  void prisma.$disconnect();
});
