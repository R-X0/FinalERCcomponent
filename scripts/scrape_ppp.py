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
    Updated to handle the new HTML structure.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Debug: Save HTML content for inspection
    try:
        with open(f"propublica_debug_{datetime.now().strftime('%Y%m%d%H%M%S')}.html", "w", encoding="utf-8") as f:
            f.write(html_content)
    except Exception as e:
        print(f"Warning: Could not save debug HTML: {e}")
    
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
        # Extract loan amount
        loan_amount_divs = soup.select('div.f3-l.f4-m.f5.lh-title.tiempos-text.b')
        if loan_amount_divs and len(loan_amount_divs) > 0:
            amount_text = loan_amount_divs[0].text.strip().replace('$', '').replace(',', '')
            try:
                ppp_data["firstDraw"]["amount"] = float(amount_text)
            except ValueError:
                ppp_data["notes"] += "Could not parse loan amount. "
        
        # Extract forgiveness amount (usually second div with same class)
        if loan_amount_divs and len(loan_amount_divs) > 1:
            forgiveness_text = loan_amount_divs[1].text.strip().replace('$', '').replace(',', '')
            try:
                ppp_data["firstDraw"]["forgiveness"] = float(forgiveness_text)
            except ValueError:
                ppp_data["notes"] += "Could not parse forgiveness amount. "
        
        # Extract lender
        # First approach: Find title then corresponding value
        f7_divs = soup.find_all('div', class_='f7')
        for div in f7_divs:
            if div.text.strip() == 'Lender':
                next_div = div.find_next('div', class_='f4-l')
                if next_div:
                    ppp_data["lender"] = next_div.text.strip()
                    break
        
        # Extract date approved
        for div in f7_divs:
            if div.text.strip() == 'Date Approved':
                next_div = div.find_next('div', class_='f4-l')
                if next_div:
                    date_text = next_div.text.strip()
                    # Extract date from format like "May 1, 2020 (First Round)"
                    if '(' in date_text:
                        date_text = date_text.split('(')[0].strip()
                    ppp_data["firstDraw"]["date"] = date_text
                    break
        
        # Extract jobs reported (helpful info)
        jobs_reported = None
        for div in f7_divs:
            if div.text.strip() == 'Jobs Reported':
                next_div = div.find_next('div', class_='f4-l')
                if next_div:
                    jobs_reported = next_div.text.strip()
                    break
        
        if jobs_reported:
            ppp_data["notes"] += f"Jobs Reported: {jobs_reported}. "
        
        # Extract industry
        industry = None
        for div in f7_divs:
            if div.text.strip() == 'Industry':
                next_div = div.find_next('div', class_='f4-l')
                if next_div:
                    industry = next_div.text.strip()
                    break
        
        if industry:
            ppp_data["notes"] += f"Industry: {industry}. "
        
        # Extract business type
        business_type = None
        for div in f7_divs:
            if div.text.strip() == 'Business Type':
                next_div = div.find_next('div', class_='f4-l')
                if next_div:
                    business_type = next_div.text.strip()
                    break
        
        if business_type:
            ppp_data["notes"] += f"Business Type: {business_type}. "
        
        # Extract location
        location = None
        for div in f7_divs:
            if div.text.strip() == 'Location':
                next_div = div.find_next('div', class_='f4-l')
                if next_div:
                    location = next_div.text.strip()
                    break
        
        if location:
            ppp_data["notes"] += f"Location: {location}. "
            
        # Check where the money was allocated (if available in a table)
        money_allocations = {}
        for row in soup.select('.flex.bt.b--ppp-light-grey.pv1.f7'):
            category_div = row.select_one('.tiempos-text.w-50')
            amount_div = row.select_one('.tiempos-text.pl0-5')
            
            if category_div and amount_div:
                category = category_div.text.strip()
                amount_text = amount_div.text.strip().replace('$', '').replace(',', '')
                try:
                    amount = float(amount_text)
                    if amount > 0:
                        money_allocations[category] = amount
                except ValueError:
                    pass
        
        if money_allocations:
            allocations_text = ", ".join([f"{k}: {formatCurrency(v)}" for k, v in money_allocations.items() if v > 0])
            if allocations_text:
                ppp_data["notes"] += f"Money allocations: {allocations_text}. "
    
    except Exception as e:
        ppp_data["notes"] += f"Error parsing ProPublica data: {str(e)}"
    
    return ppp_data

def formatCurrency(amount):
    """Helper to format currency amounts"""
    return "${:,.0f}".format(amount)

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
        # Try ProPublica format first since it's most common
        ppp_data = extract_ppp_data_from_propublica(html_content, business_name)
        
        # If no data was extracted, try a generic approach
        if not ppp_data["firstDraw"]["amount"] and not ppp_data["lender"]:
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
            
            # Generic approach: look for $ followed by numbers
            text_with_dollar = soup.find_all(text=lambda text: text and '$' in text)
            amounts = []
            
            for text in text_with_dollar:
                text = text.strip()
                # Extract dollar amount using regex
                import re
                matches = re.findall(r'\$[\d,]+', text)
                for match in matches:
                    try:
                        amount = float(match.replace('$', '').replace(',', ''))
                        amounts.append(amount)
                    except ValueError:
                        pass
            
            # Sort amounts from largest to smallest
            amounts.sort(reverse=True)
            
            # Assume largest amount is loan, second largest is forgiveness
            if len(amounts) > 0:
                ppp_data["firstDraw"]["amount"] = amounts[0]
            if len(amounts) > 1:
                ppp_data["firstDraw"]["forgiveness"] = amounts[1]
            
            # Save HTML for debugging/analysis
            debug_path = f"ppp_html_{datetime.now().strftime('%Y%m%d%H%M%S')}.html"
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(html_content)
            ppp_data["notes"] += f" HTML saved for debug at {debug_path}."
        
        return ppp_data

def scrape_ppp_data(url, business_name):
    """
    Scrape PPP loan data from the provided URL.
    Uses SeleniumBase in UC mode to bypass anti-bot measures.
    """
    try:
        # Initialize SeleniumBase in UC mode (Undetected Chrome) with larger window size
        with SB(uc=True, test=True, headless=False, window_size="1920,1080") as sb:
            # Set a longer page load timeout
            sb.driver.set_page_load_timeout(60)
            
            print(f"Navigating to {url}")
            
            # Add more user-agent randomization
            user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            sb.driver.execute_cdp_cmd('Network.setUserAgentOverride', {"userAgent": user_agent})
            
            # Handle Cloudflare sites
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
            
            # Wait for the page to fully load - increase timeout
            sb.wait_for_element("body", timeout=15)
            
            # Handle ProPublica newsletter popup if it appears
            try:
                # First, check if the popup exists and is visible
                popup_exists = sb.execute_script("""
                    return document.querySelector('.collapsible-content.content') !== null && 
                    document.querySelector('.collapsible-content.content').offsetHeight > 0;
                """)
                
                if popup_exists:
                    print("Newsletter popup detected, attempting to close...")
                    
                    # Try the close button first
                    try:
                        sb.click('button.close-btn', timeout=3)
                        print("Closed popup using close button")
                    except Exception as e:
                        print(f"Failed to use close button: {str(e)}")
                        # Try the "No thanks" link as fallback
                        try:
                            sb.click('a[href="#newsletter-roadblock"]', timeout=3)
                            print("Closed popup using 'No thanks' link")
                        except Exception as link_e:
                            print(f"Failed to use 'No thanks' link: {str(link_e)}")
                            # As a last resort, try JavaScript to hide the popup
                            sb.execute_script("""
                                const popup = document.querySelector('.collapsible-content.content');
                                if (popup) {
                                    popup.style.display = 'none';
                                }
                            """)
                            print("Attempted to hide popup using JavaScript")
                
                # If that didn't work, try another approach with JS
                overlay_exists = sb.execute_script("""
                    const overlayElements = document.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="popup"]');
                    for (const el of overlayElements) {
                        if (el.offsetHeight > 0 && getComputedStyle(el).display !== 'none') {
                            el.style.display = 'none';
                            return true;
                        }
                    }
                    return false;
                """)
                
                if overlay_exists:
                    print("Removed overlay element using JavaScript")
            except Exception as popup_e:
                print(f"Error handling popup: {str(popup_e)}")
            
            # Extra sleep to ensure everything loads
            sb.sleep(2)
            
            # Take a screenshot for debugging
            screenshot_path = f"ppp_screenshot_{datetime.now().strftime('%Y%m%d%H%M%S')}.png"
            sb.save_screenshot(screenshot_path)
            print(f"Saved screenshot to {screenshot_path}")
            
            # Get the page content
            html_content = sb.get_page_source()
            
            # First try extracting from HTML content
            ppp_data = extract_ppp_data(html_content, business_name, url)
            
            # If we didn't get critical data, try direct DOM extraction
            if not ppp_data["firstDraw"]["amount"] or not ppp_data["lender"]:
                print("Attempting direct DOM extraction as fallback...")
                try:
                    # Try to get loan amount directly from DOM
                    loan_amount = sb.execute_script("""
                        const elements = document.querySelectorAll('.f3-l.f4-m.f5.lh-title.tiempos-text.b');
                        if (elements.length > 0) {
                            const text = elements[0].textContent.trim().replace('$', '').replace(/,/g, '');
                            return parseFloat(text);
                        }
                        return null;
                    """)
                    
                    if loan_amount and not ppp_data["firstDraw"]["amount"]:
                        ppp_data["firstDraw"]["amount"] = loan_amount
                        print(f"Found loan amount via DOM: {loan_amount}")
                    
                    # Try to get forgiveness amount
                    forgiveness = sb.execute_script("""
                        const elements = document.querySelectorAll('.f3-l.f4-m.f5.lh-title.tiempos-text.b');
                        if (elements.length > 1) {
                            const text = elements[1].textContent.trim().replace('$', '').replace(/,/g, '');
                            return parseFloat(text);
                        }
                        return null;
                    """)
                    
                    if forgiveness and not ppp_data["firstDraw"]["forgiveness"]:
                        ppp_data["firstDraw"]["forgiveness"] = forgiveness
                        print(f"Found forgiveness amount via DOM: {forgiveness}")
                    
                    # Try to get lender
                    lender = sb.execute_script("""
                        const lenderLabels = Array.from(document.querySelectorAll('.f7')).filter(el => el.textContent.trim() === 'Lender');
                        if (lenderLabels.length > 0) {
                            const parent = lenderLabels[0].parentElement;
                            const valueDiv = parent.querySelector('.f4-l.f5.lh-title.tiempos-text');
                            return valueDiv ? valueDiv.textContent.trim() : null;
                        }
                        return null;
                    """)
                    
                    if lender and not ppp_data["lender"]:
                        ppp_data["lender"] = lender
                        print(f"Found lender via DOM: {lender}")
                    
                    # Try to get date
                    date = sb.execute_script("""
                        const dateLabels = Array.from(document.querySelectorAll('.f7')).filter(el => el.textContent.trim() === 'Date Approved');
                        if (dateLabels.length > 0) {
                            const parent = dateLabels[0].parentElement;
                            const valueDiv = parent.querySelector('.f4-l.f5.lh-title.tiempos-text');
                            return valueDiv ? valueDiv.textContent.trim() : null;
                        }
                        return null;
                    """)
                    
                    if date and not ppp_data["firstDraw"]["date"]:
                        if '(' in date:
                            date = date.split('(')[0].trim()
                        ppp_data["firstDraw"]["date"] = date
                        print(f"Found date via DOM: {date}")
                        
                except Exception as dom_e:
                    print(f"Error during DOM extraction: {str(dom_e)}")
                    ppp_data["notes"] += f" DOM extraction attempt failed: {str(dom_e)}."
            
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