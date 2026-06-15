// server.js
import express from "express";
import multer from "multer";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import Document from "./models/Document.js";
import {
  initiateChecker,
  checkCheckerStatus,
} from "./services/continualEngine.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err));

// Continual Engine API config
const CE_BASE = "https://api-pdfservice.continualengine.com/v1/process";
const HEADERS = {
  "api-id": process.env.PREP_API_ID,
  "app-key": process.env.PREP_API_KEY,
};

// ------------------
// 1️⃣ Upload + Auto-Tag
// ------------------
app.post("/api/upload", upload.single("pdf1"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Prepare form-data
    console.log(req.file.path);

    const formData = new FormData();
    formData.append("pdf1", fs.createReadStream(req.file.path));
    formData.append("auto_tag", "true");

    // Send file to CE Auto-Tag API
    // const ceRes = await axios.post(`${CE_BASE}/auto-tag/`, formData, {
    //   headers: { ...HEADERS, ...formData.getHeaders() },
    //   maxBodyLength: Infinity,
    // });

    // const processId = ceRes.data.id;

    const originalName = req.file.originalname;
    console.log(originalName);

    const doc = await Document.create({
      filename: req.file.originalname,
      // processId,
      status: "in-progress",
    });

    res.json({
      message: "✅ File uploaded & AutoTag initiated",
      // processId,
      document: doc,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ------------------
// 2️⃣ List Documents with updated status
// ------------------
app.get("/api/docs", async (req, res) => {
  try {
    const docs = await Document.find().sort({ uploadedAt: -1 });

    const updatedDocs = await Promise.all(
      docs.map(async (doc) => {
        try {
          const pingRes = await axios.post(
            `${CE_BASE}/ping/`,
            { processId: doc.processId },
            { headers: HEADERS }
          );

          doc.status = pingRes.data.status;
          if (pingRes.data.status === "completed")
            doc.downloadUrl = pingRes.data.url;

          await doc.save();
        } catch (err) {
          console.error("CE ping failed for", doc.filename);
        }
        return doc;
      })
    );

    res.json(updatedDocs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// ------------------
// 3️⃣ Get single document with CE status
// ------------------
app.get("/api/docs/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    try {
      const pingRes = await axios.post(
        `${CE_BASE}/ping/`,
        { processId: doc.processId },
        { headers: HEADERS }
      );
      doc.status = pingRes.data.status;
      if (pingRes.data.status === "completed")
        doc.downloadUrl = pingRes.data.url;
      await doc.save();
    } catch (err) {
      console.error("CE ping failed for", doc.filename);
    }

    res.json(doc);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch document", details: err.message });
  }
});

// ------------------
// 4️⃣ Status Check (used by Dashboard button)
// ------------------
app.post("/api/status", async (req, res) => {
  try {
    const { processId } = req.body;
    if (!processId) return res.status(400).json({ error: "Missing processId" });

    const pingRes = await axios.post(
      `${CE_BASE}/ping/`,
      { processId },
      { headers: HEADERS }
    );

    res.json(pingRes.data);
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ error: "Status check failed", details: err.message });
  }
});

// ------------------
// 5️⃣ Remediate
// ------------------
app.post("/api/remediate/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    doc.status = "remediated";
    await doc.save();

    res.json({ message: "✅ Remediation complete", document: doc });
  } catch (err) {
    res.status(500).json({ error: "Remediation failed", details: err.message });
  }
});

// ------------------
// 6️⃣ Start Server
// ------------------
const PORT = process.env.PORT || 4000;
// console.log(process.env.PREP_API_ID);
// console.log(process.env.PREP_API_KEY);

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// New Backend Route

app.post("/api/checker/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const result = await initiateChecker(`uploads/${doc.filename}`);
    doc.checkerSourceId = result.source_id;
    doc.checkerStatus = "in-progress";
    await doc.save();

    res.json({ message: "Checker initiated", document: doc });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Checker initiation failed", details: err.message });
  }
});

app.post("/api/checker-status/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc) return res.status(404).json({ error: "Checker not initiated" });

    // const result = await checkCheckerStatus(doc.checkerSourceId);
    // doc.checkerStatus = result.status;
    // if (result.status === "completed") doc.checkerReportUrl = result.file_url;
    doc.checkerStatus = "completed";
    await doc.save();

    res.json(doc);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Checker status failed", details: err.message });
  }
});
