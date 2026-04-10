require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = require("./config/db");
const logger = require("./config/logger");
const { initQueue, retryStaleSyncs } = require("./services/queueService");
const { ensureHeaders } = require("./services/sheetsService");
const socketSetup = require("./socket");

const lrRoutes = require('./routes/lrRoutes');

// ── Ensure logs dir exists ────────────────────────────────────────────────────
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ── App & HTTP server ─────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);


// Add this to handle JSON sent from your frontend
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL ,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const { buildBillingHTML } = require('./services/billingService'); // Adjust path if needed
app.get('/test-billing', (req, res) => {
    const mockData = {
        // 'record' must contain the tax rates for the header logic
        record: {
            invoiceNo: "SAL/2026-27/001",
            invoiceDate: "10/04/2026",
            location: "PITHAMPUR TO MUMBAI",
            eAckNumber: "123456789012",
            eAckDate: "10/04/2026",
            tollBillNo: "TOLL/2026/001",
            billDate: "10/04/2026",
            cgstRate: 9,   // CRITICAL: Used for taxRate calculation
            sgstRate: 9,   // CRITICAL: Used for taxRate calculation
            urbania: false,
            miscRate: 500
        },
        // 'calc' must have these exact property names (lowercase)
        calc: {
            transportationBreakdown: [
                { 
                    model: "CRUISER (6511)", 
                    qty: 2, 
                    rate: 15.50, 
                    amount: 3100.00, 
                    billingCode: "996793" 
                }
            ],
            totalQty: 2,
            miscellaneousCharges: 500.00,
            urbaniaIncentiveTotal: 0,
            transportationSubTotal: 3600.00,
            transportationCGST: 324.00,
            transportationSGST: 324.00,
            transportationFinalAmount: 4248.00,
            transportationFinalAmountInWords: "Four thousand two hundred forty eight rupees only",
            
            tollBreakdown: [
                { 
                    model: "CRUISER (6511)", 
                    qty: 2, 
                    rate: 500.00, 
                    amount: 1000.00 
                }
            ],
            tollSubTotal: 1000.00,
            tollCGST: 90.00,
            tollSGST: 90.00,
            tollFinalAmount: 1180.00,
            tollFinalAmountInWords: "One thousand one hundred eighty rupees only"
        },
        overallKm: 450,
        sheetType: 'FML' 
    };

    try {
        const html = buildBillingHTML(mockData);
        res.send(html);
    } catch (error) {
        console.error("Rendering Error:", error);
        res.status(500).send(`
            <div style="font-family:sans-serif; padding:20px; color:#721c24; background:#f8d7da; border:1px solid #f5c6cb;">
                <h3>❌ Billing Render Error</h3>
                <p>${error.message}</p>
                <pre style="background:#fff; padding:10px;">${error.stack}</pre>
            </div>
        `);
    }
});


// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());
app.use(cors({
  origin: [process.env.CLIENT_URL, "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts, please try again later." },
});

app.use(limiter);

app.use('/api/lr', lrRoutes);

// ── Body Parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── HTTP Request Logging ──────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.url === "/api/health",
  }));
}

// ── Attach Socket.IO to every request ────────────────────────────────────────
app.use((req, _, next) => {
  req.io = io;
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth/login", authLimiter);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/drivers", require("./routes/drivers"));
app.use("/api/vehicle-sheets", require("./routes/vehicleSheets"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/logistics", require("./routes/logistics"));
app.use("/api/billing", require("./routes/billing"));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max 10MB per image." });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ message: "Too many files uploaded." });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({ message: `Duplicate value for ${field}` });
  }

  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ── Socket.IO Setup ───────────────────────────────────────────────────────────
socketSetup(io);

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();

  // Init background queue (Redis-based, falls back to sync)
  initQueue();

  // Setup Google Sheets headers (non-blocking)
  ensureHeaders().catch((e) =>
    logger.warn(`Sheets header setup skipped: ${e.message}`)
  );

  // Retry any drivers that failed to sync to Sheets previously
  retryStaleSyncs().catch((e) =>
    logger.warn(`Stale sync retry skipped: ${e.message}`)
  );

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  });
};















start();