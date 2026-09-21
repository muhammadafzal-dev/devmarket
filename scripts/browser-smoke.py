"""Browser smoke test. Requires local API/web and Python Playwright."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local' / 'screenshots'
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    executable = os.environ.get('CHROME_EXECUTABLE')
    browser = p.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
    page = browser.new_page(viewport={'width': 1440, 'height': 1050})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(OUT / 'marketplace.png'), full_page=True)
    print(json.dumps({'title':page.title(),'headings':page.get_by_role('heading').all_text_contents(),'links':page.get_by_role('link').all_text_contents(),'errors':errors},indent=2))
    browser.close()
