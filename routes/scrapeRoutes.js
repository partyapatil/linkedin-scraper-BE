import express from "express";
import mongoose from "mongoose";
import { scrapeLinkedInProfiles } from "../scraper.js";
import Profile from "../models/Profile.js";
import { Parser } from "json2csv";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Query is required" });
    }

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: "Database connection not ready. Please try again in a moment." 
      });
    }

    console.log("🔍 Starting scrape for:", query);
    const profiles = await scrapeLinkedInProfiles(query);

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({
        message: "No profiles found. Try a different search query.",
        data: [],
      });
    }

    // Clear previous data and save to MongoDB
    await Profile.deleteMany({});
    await Profile.insertMany(profiles);

    // Generate CSV
    const parser = new Parser({
      fields: ["name", "title", "location", "url"]
    });
    const csv = parser.parse(profiles);
    fs.writeFileSync("profiles.csv", csv);

    // Generate Excel file
    const worksheet = XLSX.utils.json_to_sheet(profiles);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LinkedIn Profiles");
    
    worksheet['!cols'] = [
      { wch: 30 }, 
      { wch: 40 }, 
      { wch: 20 }, 
      { wch: 60 }
    ];
    
    XLSX.writeFile(workbook, "profiles.xlsx");

    console.log(`✅ Scraped ${profiles.length} profiles successfully!`);
    console.log(`📄 Generated files: profiles.csv and profiles.xlsx`);
    
    res.json({ 
      message: `✅ Found ${profiles.length} profiles!`, 
      data: profiles 
    });

  } catch (error) {
    console.error("❌ Scraping failed:", error.message);
    res.status(500).json({ 
      message: "Error scraping data", 
      error: error.message 
    });
  }
});

router.get("/download-csv", (req, res) => {
  try {
    const csvPath = path.join(process.cwd(), "profiles.csv");
    
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ message: "No CSV file found. Run a scrape first." });
    }

    res.download(csvPath, "linkedin_profiles.csv", (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({ message: "Error downloading CSV" });
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error accessing CSV file" });
  }
});

router.get("/download-excel", (req, res) => {
  try {
    const excelPath = path.join(process.cwd(), "profiles.xlsx");
    
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ message: "No Excel file found. Run a scrape first." });
    }

    res.download(excelPath, "linkedin_profiles.xlsx", (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({ message: "Error downloading Excel file" });
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error accessing Excel file" });
  }
});

export default router;
