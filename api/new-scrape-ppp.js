// scrape-ppp.js
require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openAI = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

const router = express.Router();

// Helper function to run the Python SeleniumBase script
async function scrapePPPDataWithSeleniumBase(url, businessName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/scrape_ppp.py');
    
    // Create a temporary file for output
    const tempOutputFile = path.join(__dirname, `../temp/ppp_${Date.now()}.json`);
    
    // Ensure the temp directory exists
    if (!fs.existsSync(path.join(__dirname, '../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
    }
    
    console.log(`Scraping PPP data from ${url} for ${businessName}`);
    
    // Spawn the Python process
    const pythonProcess = spawn('python', [
      scriptPath,
      '--url', url,
      '--business-name', businessName,
      '--output', tempOutputFile
    ]);
    
    let stdoutData = '';
    let errorData = '';
    
    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python stdout: ${data}`);
      stdoutData += data;
    });
    
    // Collect any error output
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
      errorData += data;
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        reject(new Error(`Python script error: ${errorData}`));
        return;
      }
      
      // Read the output file
      try {
        if (fs.existsSync(tempOutputFile)) {
          const outputData = fs.readFileSync(tempOutputFile, 'utf8');
          const jsonData = JSON.parse(outputData);
          
          // Delete the temporary file
          fs.unlinkSync(tempOutputFile);
          
          resolve(jsonData);
        } else {
          // If file doesn't exist but process exited successfully,
          // try to parse stdout as JSON
          try {
            const jsonData = JSON.parse(stdoutData);
            resolve(jsonData);
          } catch (parseErr) {
            reject(new Error(`Output file not found and stdout is not valid JSON: ${stdoutData}`));
          }
        }
      } catch (err) {
        console.error('Error reading output file:', err);
        reject(err);
      }
    });
  });
}

// Function to process scraped content with GPT
async function processWithGPT(scrapedData, businessName) {
  // If OpenAI is not configured or if we already have structured data, return as is
  if (!openAI || 
      (scrapedData.businessName && 
       (scrapedData.firstDraw?.amount || scrapedData.secondDraw?.amount))) {
    return {
      ...scrapedData,
      scrapedAt: new Date(),
      sourceLink: scrapedData.sourceLink
    };
  }
  
  try {
    const response = await openAI.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant specialized in extracting structured PPP loan data from raw HTML or text content. 
          
          Extract the following information in a consistent format:
          1. Business Name
          2. First Draw PPP Loan Amount
          3. First Draw PPP Loan Date
          4. First Draw PPP Loan Forgiveness Amount
          5. Second Draw PPP Loan Amount (if applicable)
          6. Second Draw PPP Loan Date (if applicable)
          7. Second Draw PPP Loan Forgiveness Amount (if applicable)
          8. Lending Institution/Bank
          
          The expected business name is: "${businessName}"
          
          Return only a valid JSON object with the following structure:
          {
            "businessName": "string",
            "firstDraw": {
              "amount": number,
              "date": "YYYY-MM-DD",
              "forgiveness": number
            },
            "secondDraw": {
              "amount": number,
              "date": "YYYY-MM-DD",
              "forgiveness": number
            },
            "lender": "string",
            "notes": "string"
          }
          
          Use null for values that are not found. If you're uncertain about any value, use null. Include any important context or caveats in the notes field.
          DO NOT include any explanatory text, just return the valid JSON object.`
        },
        {
          role: "user",
          content: `I need to extract PPP loan data from this content. The page is from ${scrapedData.sourceLink}.
          
          Here's the relevant content:
          ${scrapedData.text || scrapedData.html || JSON.stringify(scrapedData)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 800,
    });

    const resultText = response.choices[0].message.content.trim();
    
    try {
      const jsonText = resultText.replace(/```json|```/g, '').trim();
      const pppData = JSON.parse(jsonText);
      
      pppData.scrapedAt = new Date();
      pppData.sourceLink = scrapedData.sourceLink;
      
      return pppData;
    } catch (parseError) {
      console.error('Error parsing GPT response:', parseError, resultText);
      throw new Error('Failed to parse extracted PPP data');
    }
  } catch (error) {
    console.error('Error processing with GPT:', error);
    throw new Error('Failed to process scraped data with GPT');
  }
}

// POST endpoint to scrape and process PPP data
router.post('/api/scrape-ppp', async (req, res) => {
  try {
    const { submissionId, businessName, pppLink } = req.body;
    
    if (!submissionId || !pppLink) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // 1. Scrape the PPP data from the link using SeleniumBase
    const scrapedData = await scrapePPPDataWithSeleniumBase(pppLink, businessName);
    
    // Check for errors in the scraped data
    if (scrapedData.error) {
      throw new Error(`SeleniumBase scraper error: ${scrapedData.error}`);
    }
    
    // 2. Process the scraped data with GPT if needed
    const pppData = await processWithGPT(scrapedData, businessName);
    
    // 3. Update the submission in the database
    const Submission = require('../models/Submission');
    await Submission.findOneAndUpdate(
      { submissionId: submissionId },
      { $set: { pppData: pppData } },
      { new: true }
    );
    
    // 4. Return the processed PPP data
    return res.status(200).json({
      success: true,
      message: 'PPP data successfully scraped and processed',
      pppData: pppData
    });
  } catch (error) {
    console.error('Error in PPP scraper endpoint:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while processing the PPP data'
    });
  }
});

module.exports = router;