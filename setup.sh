#!/bin/bash
# Setup script for SeleniumBase PPP scraper

echo "Setting up SeleniumBase PPP Scraper..."

# Create necessary directories
mkdir -p scripts
mkdir -p temp
mkdir -p logs

# Copy the Python script to the scripts directory
cp scrape_ppp.py scripts/
chmod +x scripts/scrape_ppp.py

# Install Python dependencies
echo "Installing Python dependencies..."
pip install seleniumbase beautifulsoup4

# Install webdrivers
echo "Installing Chrome webdriver..."
python -m seleniumbase install chromedriver

echo "Setup complete! You can now use the SeleniumBase PPP scraper."
echo "Usage: python scripts/scrape_ppp.py --url \"https://example.com/ppp-data\" --business-name \"Business Name\""