// puppeteer-scrape.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const express = require('express');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const router = express.Router();

// Helper function to scrape PPP data using Puppeteer
async function scrapePPPData(url) {
  let browser = null;
  
  try {
    // Launch a headless browser (can be made visible for debugging)
    browser = await puppeteer.launch({
      headless: 'new', // Use 'false' for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    // Open a new page
    const page = await browser.newPage();
    
    // Set a realistic viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    
    // Visit the url
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Check if page contains a CAPTCHA or security check
    const pageTitle = await page.title();
    const pageContent = await page.content();
    
    if (pageTitle.includes('Security Check') || pageContent.includes('security check')) {
      console.log('Detected security check page. Attempting to wait for possible CAPTCHA timeout...');
      
      // Wait longer to see if the page resolves automatically (some security checks have timeouts)
      // FIXED: Using setTimeout with a Promise instead of page.waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Check again if we're still on a security page
      const newTitle = await page.title();
      if (newTitle.includes('Security Check')) {
        console.log('Still on security check page after waiting. May require manual intervention.');
        throw new Error('Security verification required. The website is blocking automated access.');
      }
    }
    
    // Wait for the content to be available
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Extract the page content
    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    
    // Close the browser
    await browser.close();
    browser = null;
    
    return {
      html: html,
      text: text,
      url: url
    };
  } catch (error) {
    console.error('Error during puppeteer scraping:', error);
    throw new Error(`Failed to scrape data from ${url}: ${error.message}`);
  } finally {
    // Ensure browser is closed even if there's an error
    if (browser) {
      await browser.close();
    }
  }
}

// Function to process scraped content with GPT
async function processWithGPT(scrapedData, businessName) {
  // Implementation remains the same as original
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
          content: `I need to extract PPP loan data from this content. The page is from ${scrapedData.url}.
          
          Here's the relevant content:
          ${scrapedData.text.substring(0, 9000)}`
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
      pppData.sourceLink = scrapedData.url;
      
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
    
    // 1. Scrape the PPP data from the link
    const scrapedData = await scrapePPPData(pppLink);
    
    // 2. Process the scraped data with GPT
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