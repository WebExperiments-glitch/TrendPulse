import requests
import re
from bs4 import BeautifulSoup

url = 'https://github.com/trending?since=weekly'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
}

try:
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()  # 检查HTTP响应状态
    soup = BeautifulSoup(resp.text, 'html.parser')
    articles = soup.select('article.Box-row')
    print(f'Found {len(articles)} repositories')
    if articles:
        article = articles[0]
        print('First article:')
        print(article.prettify())
        # Test star extraction
        star_span = article.select_one('span[aria-label*="stars"]') or article.select_one('a[href*="stargazers"]')
        print('\nStar span:')
        print(star_span)
        if star_span:
            stars_text = star_span.get('aria-label') or star_span.text
            print('Stars text:', stars_text)
            stars_match = re.search(r'([\d,k,m]+)', stars_text)
            print('Stars match:', stars_match)
            if stars_match:
                print('Stars:', stars_match.group(1))
except requests.exceptions.RequestException as e:
    print(f'Error fetching GitHub trending page: {e}')
except Exception as e:
    print(f'Unexpected error: {e}')
