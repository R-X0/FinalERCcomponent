#!/usr/bin/env python3
"""
SeleniumBase script to scrape PPP loan data from various sources.
This script uses UC mode (Undetected Chrome) to bypass anti-bot measures and CAPTCHAs.
"""

import sys
import json
import argparse
from seleniumbase import SB
from datetime import datetime
from bs4 import BeautifulSoup

def extract_ppp_data_from_propublica(html_content, business_name):
    """
    Extract PPP data from ProPublica's Coronavirus Bailouts database.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Initialize data structure
    ppp_data = {
        "businessName": business_name,
        "firstDraw": {
            "amount": None,
            "date": None,
            "forgiveness": None
        },
        "secondDraw": {
            "amount": None,
            "date": None,
            "forgiveness": None
        },
        "lender": None,
        "notes": ""
    }
    
    try:
        # Find the business name (verification)
        title_element = soup.find('h1', class_='recipient-name')
        if title_element:
            ppp_data["businessName"] = title_element.text.strip()
        
        # Find loan information
        loan_sections = soup.find_all('div', class_='loan')
        
        for i, section in enumerate(loan_sections):
            # Determine if first or second draw
            draw_target = "firstDraw" if i == 0 else "secondDraw"
            
            # Extract amount
            amount_elem = section.find('span', class_='amount')
            if amount_elem:
                amount_text = amount_elem.text.strip().replace('$', '').replace(',', '')
                try:
                    ppp_data[draw_target]["amount"] = float(amount_text)
                except ValueError:
                    pass
            
            # Extract date
            date_elem = section.find(lambda tag: tag.name == 'div' and 'Approved' in tag.text)
            if date_elem:
                date_text = date_elem.text.replace('Approved', '').strip()
                # Convert date to YYYY-MM-DD format
                ppp_data[draw_target]["date"] = date_text
            
            # Extract forgiveness
            forgiveness_elem = section.find(lambda tag: tag.name == 'div' and 'Forgiveness amount' in tag.text)
            if forgiveness_elem:
                forgiveness_text = forgiveness_elem.text.replace('Forgiveness amount', '').strip()
                forgiveness_text = forgiveness_text.replace('$', '').replace(',', '')
                try:
                    ppp_data[draw_target]["forgiveness"] = float(forgiveness_text)
                except ValueError:
                    pass
            
            # Extract lender
            lender_elem = section.find(lambda tag: tag.name == 'div' and 'Lender' in tag.text)
            if lender_elem:
                lender_text = lender_elem.text.replace('Lender', '').strip()
                ppp_data["lender"] = lender_text
    
    except Exception as e:
        ppp_data["notes"] = f"Error parsing ProPublica data: {str(e)}"
    
    return ppp_data

def extract_ppp_data_from_sba(html_content, business_name):
    """
    Extract PPP data from SBA's website.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Initialize data structure
    ppp_data = {
        "businessName": business_name,
        "firstDraw": {
            "amount": None,
            "date": None,
            "forgiveness": None
        },
        "secondDraw": {
            "amount": None,
            "date": None,
            "forgiveness": None
        },
        "lender": None,
        "notes": "Data extracted from SBA website"
    }
    
    try:
        # SBA-specific parsing logic would go here
        # Since SBA structure varies, this would need customization
        
        # Example of finding table data
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 2:
                    label = cells[0].text.strip().lower()
                    value = cells[1].text.strip()
                    
                    if 'borrower' in label or 'business name' in label:
                        ppp_data["businessName"] = value
                    elif 'lender' in label:
                        ppp_data["lender"] = value
                    elif 'loan amount' in label or 'approved amount' in label:
                        try:
                            amount = float(value.replace('$', '').replace(',', ''))
                            if not ppp_data["firstDraw"]["amount"]:
                                ppp_data["firstDraw"]["amount"] = amount
                            else:
                                ppp_data["secondDraw"]["amount"] = amount
                        except ValueError:
                            pass
    
    except Exception as e:
        ppp_data["notes"] = f"Error parsing SBA data: {str(e)}"
    
    return ppp_data

def extract_ppp_data(html_content, business_name, url):
    """
    Extract PPP data based on the source website.
    """
    if "propublica.org" in url:
        return extract_ppp_data_from_propublica(html_content, business_name)
    elif "sba.gov" in url or "data.sba.gov" in url:
        return extract_ppp_data_from_sba(html_content, business_name)
    else:
        # Generic extraction attempt
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Initialize data structure
        ppp_data = {
            "businessName": business_name,
            "firstDraw": {
                "amount": None,
                "date": None,
                "forgiveness": None
            },
            "secondDraw": {
                "amount": None,
                "date": None,
                "forgiveness": None
            },
            "lender": None,
            "notes": f"Data extracted from unknown source: {url}"
        }
        
        # Save HTML for debugging/analysis
        with open(f"ppp_html_{datetime.now().strftime('%Y%m%d%H%M%S')}.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        
        return ppp_data

def scrape_ppp_data(url, business_name):
    """
    Scrape PPP loan data from the provided URL.
    Uses SeleniumBase in UC mode to bypass anti-bot measures.
    """
    try:
        # Initialize SeleniumBase in UC mode (Undetected Chrome)
        with SB(uc=True, test=True, headless=False) as sb:
            print(f"Navigating to {url}")
            
            # Handle Cloudflare sites like GitLab example in the docs
            if "cloudflare" in url or "gitlab" in url:
                sb.activate_cdp_mode(url)
                sb.uc_gui_click_captcha()
                sb.sleep(2)
            else:
                # Standard approach
                sb.open(url)
                
                # Check for Cloudflare/security challenges
                if ("Cloudflare" in sb.get_page_title() or 
                    "security check" in sb.get_page_source().lower() or
                    "challenge" in sb.get_page_source().lower()):
                    print("Detected security challenge, attempting to bypass...")
                    sb.activate_cdp_mode(url)
                    sb.uc_gui_click_captcha()
                    sb.sleep(3)
            
            # Wait for the page to fully load
            sb.wait_for_element("body", timeout=10)
            
            # Take a screenshot for debugging
            screenshot_path = f"ppp_screenshot_{datetime.now().strftime('%Y%m%d%H%M%S')}.png"
            sb.save_screenshot(screenshot_path)
            print(f"Saved screenshot to {screenshot_path}")
            
            # Get the page content
            html_content = sb.get_page_source()
            
            # Extract PPP data from the HTML
            ppp_data = extract_ppp_data(html_content, business_name, url)
            
            # Add the source link
            ppp_data["sourceLink"] = url
            ppp_data["scrapedAt"] = datetime.now().isoformat()
            
            return ppp_data
            
    except Exception as e:
        print(f"Error during scraping: {str(e)}", file=sys.stderr)
        return {
            "error": str(e),
            "businessName": business_name,
            "sourceLink": url,
            "scrapedAt": datetime.now().isoformat()
        }

def main():
    """
    Main function to parse arguments and run the scraper.
    """
    parser = argparse.ArgumentParser(description='Scrape PPP loan data.')
    parser.add_argument('--url', type=str, required=True, help='URL of the PPP loan data')
    parser.add_argument('--business-name', type=str, required=True, help='Name of the business')
    parser.add_argument('--output', type=str, default=None, help='Output file path')
    
    args = parser.parse_args()
    
    # Scrape the data
    ppp_data = scrape_ppp_data(args.url, args.business_name)
    
    # Output the data as JSON
    json_data = json.dumps(ppp_data, indent=2, default=str)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(json_data)
        print(f"Output saved to {args.output}")
    else:
        print(json_data)

if __name__ == '__main__':
    main()