const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../config/logger");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user._id);
    logger.info(`Login: ${user.email} (${user.role})`);

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/auth/register
 * Body: { name, email, password, role }
 * Protected: superadmin can create any role; admin can create manager/user
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Role hierarchy enforcement — superadmin can create any role including superadmin
    const roleHierarchy = { superadmin: 4, admin: 3, manager: 2, user: 1 };
    const requesterLevel = roleHierarchy[req.user.role] || 0;
    const targetLevel = roleHierarchy[role] || 0;

    // superadmin can create superadmin; others cannot create equal or higher
    if (req.user.role !== "superadmin" && targetLevel >= requesterLevel) {
      return res.status(403).json({
        message: `You cannot create a user with role '${role}'`,
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "user",
      createdBy: req.user._id,
    });

    logger.info(`Register: ${user.email} (${user.role}) by ${req.user.email}`);

    res.status(201).json({
      message: "User registered successfully",
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error(`Register error: ${err.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/auth/me
 * Returns current user profile
 */
const me = async (req, res) => {
  res.json({ user: req.user });
};

/**
 * GET /api/auth/users
 * List all users (superadmin/admin only)
 */
const listUsers = async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/auth/users/:id/toggle
 * Activate or deactivate a user
 */
const toggleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "superadmin") {
      return res.status(403).json({ message: "Cannot deactivate superadmin" });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: `User ${user.isActive ? "activated" : "deactivated"}`, user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login, register, me, listUsers, toggleUser };
