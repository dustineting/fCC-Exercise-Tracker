const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB schemas
const exerciseSchema = new mongoose.Schema({
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date, required: true },
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    log: [exerciseSchema],
});

const User = mongoose.model("User", userSchema);

// Home page
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/views/index.html");
});

// 1. Create a user
app.post("/api/users", async (req, res) => {
    try {
        const user = await User.create({
            username: req.body.username,
        });

        res.json({
            username: user.username,
            _id: user._id,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not create user" });
    }
});

// 2. Get all users
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find({}, "username");

        res.json(
            users.map((user) => ({
                username: user.username,
                _id: user._id,
            })),
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not retrieve users" });
    }
});

// 3. Add an exercise
app.post("/api/users/:_id/exercises", async (req, res) => {
    try {
        const user = await User.findById(req.params._id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const description = req.body.description;
        const duration = Number(req.body.duration);
        const date = req.body.date ? new Date(req.body.date) : new Date();

        if (
            !description ||
            req.body.duration === undefined ||
            req.body.duration === "" ||
            !Number.isFinite(duration) ||
            !Number.isFinite(date.getTime())
        ) {
            return res.status(400).json({
                error: "Invalid exercise details",
            });
        }

        user.log.push({
            description,
            duration,
            date,
        });

        await user.save();

        res.json({
            _id: user._id,
            username: user.username,
            date: date.toDateString(),
            duration,
            description,
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: "Could not add exercise" });
    }
});

// 4. Get exercise logs
app.get("/api/users/:_id/logs", async (req, res) => {
    try {
        const user = await User.findById(req.params._id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let log = user.log;

        const from = req.query.from ? new Date(req.query.from) : null;

        const to = req.query.to
            ? new Date(req.query.to + "T23:59:59.999Z")
            : null;

        if (from && !Number.isFinite(from.getTime())) {
            return res.status(400).json({ error: "Invalid from date" });
        }

        if (to && !Number.isFinite(to.getTime())) {
            return res.status(400).json({ error: "Invalid to date" });
        }

        if (from) {
            log = log.filter((exercise) => exercise.date >= from);
        }

        if (to) {
            log = log.filter((exercise) => exercise.date <= to);
        }

        if (req.query.limit !== undefined) {
            const limit = Number(req.query.limit);

            if (!Number.isInteger(limit) || limit < 0) {
                return res.status(400).json({ error: "Invalid limit" });
            }

            log = log.slice(0, limit);
        }

        res.json({
            _id: user._id,
            username: user.username,
            count: log.length,
            log: log.map((exercise) => ({
                description: exercise.description,
                duration: exercise.duration,
                date: exercise.date.toDateString(),
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: "Could not retrieve logs" });
    }
});

// Start server after MongoDB connects
const port = process.env.PORT || 3000;

async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB!");

        app.listen(port, () => {
            console.log("Your app is listening on port " + port);
        });
    } catch (err) {
        console.error("MongoDB connection error:", err.message);
    }
}

startServer();
