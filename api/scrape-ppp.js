// api/scrape-ppp.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Create the submission schema
const submissionSchema = new mongoose.Schema({
  submissionId: String,
  // ... other fields from your schema
  pppData: {
    businessName: String,
    sourceLink: String,
    scrapedAt: Date,
    firstDraw: {
      amount: Number,
      date: Date,
      forgiveness: Number
    },
    secondDraw: {
      amount: Number,
      date: Date,
      forgiveness: Number
    },
    lender: String,
    notes: String
  }
}, { 
  strict: false // Allow any fields to be saved
});

const Submission = mongoose.model('Submission', submissionSchema);

const router = express.Router();

// Helper function to scrape PPP data using Cheerio
async function scrapePPPData(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract the raw text content from the page
    // This is a simplified approach - you'll need to customize based on the source
    const pageContent = $('body').text().replace(/\s+/g, ' ').trim();
    
    // Return both the raw HTML and extracted text for GPT processing
    return {
      html: html,
      text: pageContent,
      url: url
    };
  } catch (error) {
    console.error('Error scraping PPP data:', error);
    throw new Error(`Failed to scrape data from ${url}: ${error.message}`);
  }
}

// Function to process scraped content with GPT
async function processWithGPT(scrapedData, businessName) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // or your preferred model
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
      temperature: 0.1, // Lower temperature for more deterministic extraction
      max_tokens: 800,
    });

    const resultText = response.choices[0].message.content.trim();
    
    // Parse the JSON response from GPT
    try {
      // Sometimes GPT might include markdown code blocks, so we need to handle that
      const jsonText = resultText.replace(/```json|```/g, '').trim();
      const pppData = JSON.parse(jsonText);
      
      // Add timestamp and source
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