// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection string from .env file
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: No MongoDB URI provided in environment variables');
  process.exit(1);
}

// Create the submission schema - using the one from your test.js
const submissionSchema = new mongoose.Schema({
  submissionId: String,
  userId: String,
  userEmail: String,
  receivedAt: Date,
  originalData: mongoose.Schema.Types.Mixed,
  receivedFiles: [{
    originalName: String,
    savedPath: String,
    size: Number,
    mimetype: String
  }],
  report: {
    generated: Boolean,
    path: String,
    qualificationData: {
      qualifyingQuarters: [String],
      quarterAnalysis: [{
        quarter: String,
        revenues: {
          revenue2019: Number,
          revenue2021: Number
        },
        change: Number,
        percentDecrease: Number,
        qualifies: Boolean
      }]
    }
  },
  status: String,
  businessName: String,
  ein: String,
  location: String,
  timePeriods: [String],
  businessWebsite: String,
  naicsCode: String,
  processedQuarters: [String],
  submissionData: mongoose.Schema.Types.Mixed
}, { 
  strict: false // Allow any fields to be saved
});

const Submission = mongoose.model('Submission', submissionSchema);

// API endpoint to get submissions from MongoDB
app.get('/api/submissions', async (req, res) => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000
    });
    
    console.log(`Connected to MongoDB successfully for API request`);
    
    // Fetch submissions, sorted by receivedAt (newest first)
    // Limit parameter can be passed as a query parameter
    const limit = parseInt(req.query.limit) || 50;
    const allSubmissions = await Submission.find({})
      .sort({ receivedAt: -1 })
      .limit(limit * 3); // Fetch more than needed since we'll filter
    
    // Process submissions (using your existing logic)
    const completedSubmissions = [];
    
    for (const submission of allSubmissions) {
      const rawData = submission.toObject ? submission.toObject() : JSON.parse(JSON.stringify(submission));
      
      const submissionId = rawData.submissionId;
      if (!submissionId) continue;
      
      // Get filesystem data - simplified for API version
      let filesystemData = {};
      
      // Get processed quarters from the best location
      const processedQuarters = 
        (rawData.submissionData?.processedQuarters && rawData.submissionData.processedQuarters.length > 0) 
          ? rawData.submissionData.processedQuarters 
          : (rawData.processedQuarters || filesystemData.processedQuarters || []);
      
      // Get quarter count - try different sources
      let quarterCount = 0;
      
      if (rawData.report?.qualificationData?.quarterAnalysis) {
        quarterCount = rawData.report.qualificationData.quarterAnalysis.length;
      } else if (rawData.submissionData?.report?.qualificationData?.quarterAnalysis) {
        quarterCount = rawData.submissionData.report.qualificationData.quarterAnalysis.length;
      } else if (Array.isArray(rawData.timePeriods) && rawData.timePeriods.length > 0) {
        quarterCount = rawData.timePeriods.length;
      } else {
        // Default to 3 if nothing else
        quarterCount = 3;
      }
      
      // Skip if we don't have processed quarters data or quarterCount is 0
      if (processedQuarters.length === 0 || quarterCount === 0) continue;
      
      // Skip if not all quarters are processed
      if (processedQuarters.length < quarterCount) {
        continue;
      }
      
      // Get ZIP file links
      const zipLinks = {};
      
      if (rawData.submissionData?.quarterZips) {
        Object.assign(zipLinks, rawData.submissionData.quarterZips);
      }
      
      if (rawData.submissionData?.zipPaths) {
        Object.assign(zipLinks, rawData.submissionData.zipPaths);
      }
      
      const mongoZipPath = rawData.zipPath || rawData.submissionData?.zipPath || null;
      
      const missingQuarters = processedQuarters.filter(q => !zipLinks[q]);
      if (missingQuarters.length > 0 && mongoZipPath) {
        missingQuarters.forEach(quarter => {
          zipLinks[quarter] = mongoZipPath;
        });
      }
      
      if (Object.keys(zipLinks).length > 0) {
        const existingZipLink = Object.values(zipLinks)[0];
        
        processedQuarters.forEach(quarter => {
          if (!zipLinks[quarter]) {
            zipLinks[quarter] = existingZipLink;
          }
        });
      }
      
      const businessName = rawData.businessName || filesystemData.businessName || 
        `Business #${submissionId.substring(0, 8)}`;
      
      // Check if Excel file exists
      const excelFilePath = rawData.report?.path || 
                           rawData.submissionData?.report?.path || 
                           null;
      
      completedSubmissions.push({
        submissionId,
        businessName,
        status: rawData.status || filesystemData.status || 'Unknown',
        processedQuarters,
        quarterCount,
        isComplete: processedQuarters.length >= quarterCount,
        hasZipFiles: Object.keys(zipLinks).length > 0,
        zipLinks,
        receivedAt: rawData.receivedAt,
        hasExcelFile: !!excelFilePath,
        excelPath: excelFilePath,
        
        // Include relevant MongoDB data
        mongoData: {
          _id: rawData._id?.toString(),
          userEmail: rawData.userEmail,
          report: rawData.report,
          submissionData: rawData.submissionData,
          originalData: rawData.originalData,
          receivedFiles: rawData.receivedFiles
        },
        
        // Include simplified filesystem data
        filesystemData: {}
      });
      
      // If we have enough completed submissions, stop
      if (completedSubmissions.length >= limit) break;
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      count: completedSubmissions.length,
      submissions: completedSubmissions
    });
    
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Server error fetching submissions' });
  } finally {
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB after API request');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
  }
});

// Serve static files for frontend if needed
app.use(express.static(path.join(__dirname, 'client/build')));

// Default route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});