import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import scrapeRoutes from "./routes/scrapeRoutes.js";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Atlas connection string

// Connect to MongoDB Atlas with proper options
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
  .then(() => {
    console.log("✅ MongoDB Atlas connected successfully");
    console.log("📊 Database:", mongoose.connection.name);
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("⚠️  Check your MongoDB Atlas:");
    console.log("   1. Network Access: Add your IP address (0.0.0.0/0 for all IPs)");
    console.log("   2. Database User: Verify username and password");
    console.log("   3. Cluster: Ensure cluster is running");
  });

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB Atlas');
});

app.use("/api/scrape", scrapeRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
