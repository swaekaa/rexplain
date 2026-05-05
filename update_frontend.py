import re
import os

def html_to_jsx(html):
    # Replace class= with className=
    html = re.sub(r'\bclass=', 'className=', html)
    # Replace for= with htmlFor=
    html = re.sub(r'\bfor=', 'htmlFor=', html)
    # Fix self closing tags
    html = re.sub(r'<(input|img|br|hr)([^>]*?)(?<!/)>', r'<\1\2 />', html)
    # Replace style="..." with empty or remove style since we'll rely on tailwind
    # Actually wait, there might be important styles. But the downloaded HTML has very few inline styles.
    # We will let React complain if there are style strings, but the HTML here has no inline styles (only in <style> block).
    
    # Remove HTML comments
    html = re.sub(r'<!--(.*?)-->', '', html, flags=re.DOTALL)
    
    return html

def extract_body(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract body content
    body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL)
    if not body_match:
        return ""
    
    body_content = body_match.group(1)
    
    # Remove script tags
    body_content = re.sub(r'<script.*?>.*?</script>', '', body_content, flags=re.DOTALL)
    
    return html_to_jsx(body_content.strip())

def update_app_js():
    landing_jsx = extract_body('landing.html')
    loading_jsx = extract_body('loading.html')
    analysis_jsx = extract_body('analysis_split.html')
    
    # We also need to extract <style> from landing and analysis to put in index.css
    with open('landing.html', 'r', encoding='utf-8') as f:
        landing_content = f.read()
    
    with open('analysis_split.html', 'r', encoding='utf-8') as f:
        analysis_content = f.read()
        
    style_match = re.search(r'<style>(.*?)</style>', landing_content, re.DOTALL)
    landing_style = style_match.group(1) if style_match else ""
    
    style_match = re.search(r'<style>(.*?)</style>', analysis_content, re.DOTALL)
    analysis_style = style_match.group(1) if style_match else ""
    
    print("Extracted HTML successfully")

if __name__ == "__main__":
    update_app_js()
