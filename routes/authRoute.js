const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Tenant = require("../models/Tenant");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

// REGISTER — create a new user
router.post("/register", async (req, res) => {
  try {
    const { companyName, username, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Check if company already exists
    const existingTenant = await Tenant.findOne({
      name: companyName,
    });
    if (existingTenant) {
      return res.status(400).json({ message: "Company already exists" });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    //Create the Tenant
    const tenant = await Tenant.create({
      name: companyName,
    });

    const newUser = new User({
      username,
      password: hashedPassword,
      role: "Admin",
      tenantId: tenant._id,
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/users", auth, admin, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    //Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    //validate role
    const allowedRoles = ["Admin", "User"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid Role",
      });
    }
    //Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    //Create User
    const newUser = new User({
      username,
      password: hashedPassword,
      role,
      tenantId: req.user.tenantId,
    });
    await newUser.save();
    res.status(201).json({
      message: "User created successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

router.get("/users", auth, admin, async (req, res) => {
  try {
    const users = await User.find(
      {
        tenantId: req.user.tenantId,
      },
      "-password -refreshToken",
    );
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

router.get("/users/:id", auth, admin, async (req, res) => {
  try {
    const user = await User.findOne(
      {
        _id: req.params.id,
        tenantId: req.user.tenantId,
      },
      "-password -refreshToken",
    );
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// Update User (Admin only)
router.put("/users/:id", auth, admin, async (req, res) => {
  try {
    const { username, role } = req.body;

    // Validate role
    const allowedRoles = ["Admin", "User"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.user.tenantId,
      },
      {
        username,
        role,
      },
      {
        new: true,
      },
    ).select("-password -refreshToken");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// Delete User (Admin only)
router.delete("/users/:id", auth, admin, async (req, res) => {
  try {
    // Find user belonging to the same tenant
    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Prevent admin from deleting their own account
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        message: "You cannot delete your own account.",
      });
    }

    // Prevent deleting the last admin
    if (user.role === "Admin") {
      const adminCount = await User.countDocuments({
        tenantId: req.user.tenantId,
        role: "Admin",
      });

      if (adminCount === 1) {
        return res.status(400).json({
          message: "Cannot delete the last admin user.",
        });
      }
    }

    await user.deleteOne();

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
});

// LOGIN — verify credentials and return JWT
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Generate real JWT token
    const accesstoken = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1m" },
    );

    // Refresh token — long-lived, only used to get new access tokens
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // Save refresh token to DB so we can validate/revoke it later
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token: accesstoken,
      refreshToken,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res
        .status(403)
        .json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(payload.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Refresh token not recognized" });
    }

    const newAccessToken = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );

    res.json({ token: newAccessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await User.findOneAndUpdate({ refreshToken }, { refreshToken: null });
    res.json({ message: "Logged out" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;
