import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleRazorpayWebhook } from "../payments/webhook";
import { handleMembershipExpirySchedule } from "../scheduled/membershipExpiry";
import { handleMembershipReminderSchedule } from "../scheduled/membershipReminder";
import { backendHealth, backendReadiness } from "./health";
import { applyHttpSecurity } from "./httpSecurity";
import { enforceSensitiveMutationRateLimit } from "./rateLimit";
import { buildPublicSitemap, publicSiteOrigin } from "./sitemap";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(applyHttpSecurity);
  app.get("/api/health", (_req, res) => res.json(backendHealth()));
  app.get("/api/ready", (_req, res) => {
    const readiness = backendReadiness();
    return res.status(readiness.ok ? 200 : 503).json(readiness);
  });
  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(buildPublicSitemap(publicSiteOrigin({ protocol: req.protocol, host: req.get("host") })));
  });
  // Razorpay signatures are computed from the unparsed raw request body; this route must precede JSON parsing.
  app.post("/api/razorpay/webhook", express.raw({ type: "application/json", limit: "1mb" }), handleRazorpayWebhook);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ limit: "12mb", extended: true }));
  app.post("/api/scheduled/membership-expiry", handleMembershipExpirySchedule);
  app.post("/api/scheduled/membership-reminder", handleMembershipReminderSchedule);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use("/api/trpc", enforceSensitiveMutationRateLimit);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
