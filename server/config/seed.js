require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const connectDB = require("./db");
const logger = require("./logger");

const seed = async () => {
  await connectDB();

  const existing = await User.findOne({ role: "superadmin" });
  if (existing) {
    logger.info("SuperAdmin already exists — skipping seed.");
    process.exit(0);
  }

  const hashed = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12);
  await User.create({
    name: "Super Admin",
    email: process.env.SUPERADMIN_EMAIL,
    password: hashed,
    role: "superadmin",
    isActive: true,
  });

  logger.info(`SuperAdmin created: ${process.env.SUPERADMIN_EMAIL}`);
  process.exit(0);
};

seed().catch((e) => {
  logger.error(e);
  process.exit(1);
});