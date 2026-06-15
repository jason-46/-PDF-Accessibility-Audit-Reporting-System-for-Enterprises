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
