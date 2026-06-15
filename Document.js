import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema({
  filename: String,
  processId: String,
  status: { type: String, default: "in-progress" },
  reportUrl: String,
  uploadedAt: { type: Date, default: Date.now },
  checkerSourceId: String,
  checkerStatus: { type: String, default: "not-started" },
  checkerReportUrl: String,

});

export default mongoose.model("Document", DocumentSchema);
