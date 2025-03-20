// server.js - Main server file
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import PPP scraper router
const pppScraperRouter = require('./api/scrape-ppp');

// Import Submission model
const Submission = require('./models/Submission');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use the PPP scraper router
app.use(pppScraperRouter);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: No MongoDB URI provided in environment variables');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 30000
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// API Routes

// Get all submissions
app.get('/api/submissions', async (req, res) => {
  try {
    // Fetch the data from completed_submissions.json if available
    const jsonPath = path.join(__dirname, 'completed_submissions.json');
    
    if (fs.existsSync(jsonPath)) {
      // If we have the pre-processed file, use it for better performance
      const jsonData = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(jsonData);
      return res.json(data);
    }
    
    // Otherwise, fetch from database (simplified - actual logic would be more complex)
    const allSubmissions = await Submission.find({})
      .sort({ receivedAt: -1 })
      .limit(50);
    
    // Process submissions (this is a simplified version)
    const processedSubmissions = allSubmissions.map(submission => {
      const doc = submission.toObject();
      return {
        submissionId: doc.submissionId,
        businessName: doc.businessName || `Business #${doc.submissionId?.substring(0, 8)}`,
        status: doc.status || 'Unknown',
        processedQuarters: doc.processedQuarters || [],
        quarterCount: doc.report?.qualificationData?.quarterAnalysis?.length || 3,
        isComplete: doc.status === 'Completed' || doc.status === 'PDF done',
        hasZipFiles: !!doc.submissionData?.quarterZips,
        zipLinks: doc.submissionData?.quarterZips || {},
        receivedAt: doc.receivedAt,
        hasExcelFile: !!doc.report?.path,
        excelPath: doc.report?.path || null,
        pppData: doc.pppData || null,
        mongoData: {
          _id: doc._id?.toString(),
          userEmail: doc.userEmail,
          report: doc.report,
          submissionData: doc.submissionData,
          originalData: doc.originalData,
          receivedFiles: doc.receivedFiles
        }
      };
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      count: processedSubmissions.length,
      submissions: processedSubmissions
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Serve Excel reports
app.get('/api/reports/:id', async (req, res) => {
  try {
    const reportId = req.params.id;
    
    // Sanitize the reportId to prevent directory traversal
    if (!reportId || reportId.includes('..') || reportId.includes('/')) {
      return res.status(400).send('Invalid report ID');
    }
    
    // Find the report file from the reports directory
    // First, try the exact path from the database if available
    let filePath = null;
    
    // Try to find the submission to get the exact file path
    try {
      const submission = await Submission.findOne({ submissionId: reportId });
      
      if (!submission) {
        // If we can't find the submission, try the default location
        filePath = path.join(__dirname, 'reports', `report_${reportId}.xlsx`);
      } else if (submission.report && submission.report.path) {
        // Use the path from the database
        filePath = submission.report.path;
        
        // If path is absolute and starts with /app/, adjust for local development
        if (filePath.startsWith('/app/')) {
          filePath = path.join(__dirname, filePath.substring(5));
        }
      } else {
        // Default path if no specific path in the database
        filePath = path.join(__dirname, 'reports', `report_${reportId}.xlsx`);
      }
      
      // Check if file exists
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          console.error(`Report file not found: ${filePath}`);
          return res.status(404).send('Report not found');
        }
        
        // Set headers for Excel file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=report_${reportId}.xlsx`);
        
        // Stream the file to the response
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      });
    } catch (error) {
      console.error('Error finding submission:', error);
      res.status(500).send('Server error');
    }
  } catch (error) {
    console.error('Error serving report:', error);
    res.status(500).send('Server error');
  }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'erc-dashboard/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'erc-dashboard/build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});