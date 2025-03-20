// completed-submissions.js - Run with: node completed-submissions.js [optional-limit]
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Get optional limit from command line
const limit = parseInt(process.argv[2]) || 10;

// MongoDB connection string from .env file
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: No MongoDB URI provided in environment variables');
  process.exit(1);
}

// Create the submission schema
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
  // Add any other fields that might exist
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

// Function to get all completed submissions
async function getCompletedSubmissions(limit) {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000
    });
    
    console.log(`Connected to MongoDB successfully`);
    
    // Fetch all submissions, sorted by receivedAt (newest first)
    const allSubmissions = await Submission.find({})
      .sort({ receivedAt: -1 })
      .limit(limit * 3); // Fetch more than needed since we'll filter
    
    console.log(`Found ${allSubmissions.length} total submissions, filtering for completed ones...`);
    
    // Process each submission to get complete data and filter for completed ones
    const completedSubmissions = [];
    
    for (const submission of allSubmissions) {
      // Get the raw document
      const rawData = submission.toObject ? submission.toObject() : JSON.parse(JSON.stringify(submission));
      
      // Get the submissionId
      const submissionId = rawData.submissionId;
      if (!submissionId) continue;
      
      // Check filesystem for additional data
      let filesystemData = {};
      try {
        // Check multiple possible paths
        const possiblePaths = [
          path.join(__dirname, `data/ERC_Disallowances/${submissionId}/submission_info.json`),
          path.join(__dirname, `data/ERC_Disallowances/ERC-${submissionId.replace(/^ERC-/, '')}/submission_info.json`),
          path.join(__dirname, `data/ERC_Disallowances/${submissionId.replace(/^ERC-/, '')}/submission_info.json`),
          path.join(__dirname, `server/data/ERC_Disallowances/${submissionId}/submission_info.json`),
          path.join(__dirname, `server/data/ERC_Disallowances/ERC-${submissionId.replace(/^ERC-/, '')}/submission_info.json`),
          path.join(__dirname, `server/data/ERC_Disallowances/${submissionId.replace(/^ERC-/, '')}/submission_info.json`)
        ];
        
        for (const jsonPath of possiblePaths) {
          try {
            if (fs.existsSync(jsonPath)) {
              const jsonData = fs.readFileSync(jsonPath, 'utf8');
              filesystemData = JSON.parse(jsonData);
              break;
            }
          } catch (fileError) {
            // Silent error
          }
        }
      } catch (fileError) {
        // Silent error
      }
      
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
      } else if (filesystemData.timePeriods && Array.isArray(filesystemData.timePeriods) && filesystemData.timePeriods.length > 0) {
        quarterCount = filesystemData.timePeriods.length;
      } else {
        // Default to 3 if nothing else
        quarterCount = 3;
      }
      
      // Skip if we don't have processed quarters data or quarterCount is 0
      if (processedQuarters.length === 0 || quarterCount === 0) continue;
      
      // IMPORTANT: Skip if not all quarters are processed (we want only completed submissions)
      if (processedQuarters.length < quarterCount) {
        console.log(`Skipping ${submissionId}: ${processedQuarters.length}/${quarterCount} quarters processed`);
        continue;
      }
      
      // IMPROVED: Get ZIP file links with better logic to ensure all quarters have links
      const zipLinks = {};
      
      // 1. First check MongoDB quarter-specific ZIP files
      if (rawData.submissionData?.quarterZips) {
        Object.assign(zipLinks, rawData.submissionData.quarterZips);
      }
      
      // 2. Check MongoDB submissionData.zipPaths if it exists (alternate format)
      if (rawData.submissionData?.zipPaths) {
        Object.assign(zipLinks, rawData.submissionData.zipPaths);
      }
      
      // 3. Check for general zipPath in MongoDB data
      const mongoZipPath = rawData.zipPath || rawData.submissionData?.zipPath || null;
      
      // 4. Check filesystem data for specific quarters
      if (filesystemData.processedQuarters && filesystemData.zipPath) {
        // If filesystem knows about specific processed quarter
        if (filesystemData.processedQuarter) {
          zipLinks[filesystemData.processedQuarter] = filesystemData.zipPath;
        }
      }
      
      // 5. For any processed quarters WITHOUT zip links, fill in with available data
      const missingQuarters = processedQuarters.filter(q => !zipLinks[q]);
      if (missingQuarters.length > 0 && (filesystemData.zipPath || mongoZipPath)) {
        const zipPath = filesystemData.zipPath || mongoZipPath;
        
        // Use the same zip for any quarters missing links
        missingQuarters.forEach(quarter => {
          zipLinks[quarter] = zipPath;
          console.log(`Added missing zip link for ${submissionId}, quarter ${quarter} from general zipPath`);
        });
      }
      
      // 6. Final fallback - if we still have missing quarters but have at least one zip link,
      // duplicate an existing zip link for all missing quarters
      if (Object.keys(zipLinks).length > 0) {
        const existingZipLink = Object.values(zipLinks)[0]; // Get any existing zip link
        
        processedQuarters.forEach(quarter => {
          if (!zipLinks[quarter]) {
            zipLinks[quarter] = existingZipLink;
            console.log(`Using fallback zip link for ${submissionId}, quarter ${quarter}`);
          }
        });
      }
      
      // For business name, try multiple sources
      const businessName = rawData.businessName || filesystemData.businessName || 
        `Business #${submissionId.substring(0, 8)}`;
      
      // Try to find Excel file
      let excelFilePath = null;
      let excelFileFound = false;
      
      // Check if we have a report path
      if (rawData.report && rawData.report.path) {
        excelFilePath = rawData.report.path;
      } else if (filesystemData.reportPath) {
        excelFilePath = filesystemData.reportPath;
      } else if (rawData.submissionData?.report?.path) {
        excelFilePath = rawData.submissionData.report.path;
      }
      
      if (excelFilePath) {
        try {
          // Try different paths
          const pathsToTry = [
            excelFilePath,
            path.join(__dirname, excelFilePath),
            excelFilePath.startsWith('/app/') ? path.join(__dirname, excelFilePath.substring(5)) : excelFilePath,
            path.join(__dirname, 'server', excelFilePath)
          ];
          
          for (const pathToTry of pathsToTry) {
            try {
              if (fs.existsSync(pathToTry)) {
                excelFileFound = true;
                break;
              }
            } catch (pathError) {
              // Silent error
            }
          }
        } catch (excelError) {
          // Silent error
        }
      }
      
      // THIS IS A COMPLETED SUBMISSION - add it to our results
      completedSubmissions.push({
        submissionId,
        businessName,
        status: rawData.status || filesystemData.status || 'unknown',
        processedQuarters,
        quarterCount,
        isComplete: processedQuarters.length >= quarterCount,
        hasZipFiles: Object.keys(zipLinks).length > 0,
        zipLinks,
        receivedAt: rawData.receivedAt,
        hasExcelFile: excelFileFound,
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
        
        // Include relevant filesystem data
        filesystemData: {
          status: filesystemData.status,
          googleDriveLink: filesystemData.googleDriveLink,
          protestLetterPath: filesystemData.protestLetterPath,
          zipPath: filesystemData.zipPath
        }
      });
      
      // If we have enough completed submissions, stop
      if (completedSubmissions.length >= limit) break;
    }
    
    return completedSubmissions;
  } catch (error) {
    console.error('Error:', error);
    return [];
  } finally {
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
  }
}

// Run the query
(async () => {
  try {
    console.log(`Fetching up to ${limit} completed submissions...`);
    const completedSubmissions = await getCompletedSubmissions(limit);
    
    if (completedSubmissions.length > 0) {
      console.log(`\nFound ${completedSubmissions.length} completed submissions:\n`);
      
      // Display a summary table
      console.log('='.repeat(100));
      console.log('ID'.padEnd(15) + '| ' + 'Business'.padEnd(25) + '| ' + 'Status'.padEnd(12) + '| ' + 
                 'Quarters'.padEnd(15) + '| ' + 'ZIP Files'.padEnd(10) + '| ' + 'Date');
      console.log('-'.repeat(100));
      
      completedSubmissions.forEach(item => {
        const date = new Date(item.receivedAt).toLocaleDateString();
        console.log(
          item.submissionId.substring(0, 13).padEnd(15) + '| ' +
          item.businessName.substring(0, 23).padEnd(25) + '| ' +
          (item.status || 'unknown').padEnd(12) + '| ' +
          `${item.processedQuarters.length}/${item.quarterCount}`.padEnd(15) + '| ' +
          (item.hasZipFiles ? 'Yes' : 'No').padEnd(10) + '| ' +
          date
        );
      });
      
      console.log('='.repeat(100));
      
      // Output full data to a file
      const outputFile = 'completed_submissions.json';
      fs.writeFileSync(outputFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        count: completedSubmissions.length,
        submissions: completedSubmissions
      }, null, 2));
      console.log(`\nComplete data written to ${outputFile}`);
      
      // Give some stats
      console.log('\nStatistics:');
      console.log(`- Submissions with ZIP files: ${completedSubmissions.filter(s => s.hasZipFiles).length}/${completedSubmissions.length}`);
      console.log(`- Submissions with Excel files: ${completedSubmissions.filter(s => s.hasExcelFile).length}/${completedSubmissions.length}`);
      console.log(`- Status breakdown: ${JSON.stringify(completedSubmissions.reduce((acc, cur) => {
        acc[cur.status || 'unknown'] = (acc[cur.status || 'unknown'] || 0) + 1;
        return acc;
      }, {}))}`);
      
      // List missing or incomplete data
      console.log('\nSubmissions with missing data:');
      const missingData = completedSubmissions.filter(s => !s.hasZipFiles || !s.hasExcelFile);
      if (missingData.length > 0) {
        missingData.forEach(s => {
          console.log(`- ${s.submissionId} (${s.businessName}): ${!s.hasZipFiles ? 'Missing ZIP files' : ''} ${!s.hasExcelFile ? 'Missing Excel file' : ''}`);
        });
      } else {
        console.log('None - all completed submissions have complete data');
      }
      
      // Show all zip links for each submission
      console.log('\nZIP Links per Submission:');
      completedSubmissions.forEach(submission => {
        console.log(`\n${submission.submissionId} (${submission.businessName}):`);
        if (Object.keys(submission.zipLinks).length === 0) {
          console.log('  No ZIP links found');
        } else {
          Object.entries(submission.zipLinks).forEach(([quarter, link]) => {
            console.log(`  ${quarter}: ${link}`);
          });
        }
      });
    } else {
      console.error('No completed submissions found');
    }
  } catch (error) {
    console.error('Error running query:', error);
  }
})();