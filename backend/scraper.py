import requests
import re
import datetime
from bs4 import BeautifulSoup

class GitHubTrendingScraper:
    BASE_URL = 'https://github.com/trending'
    
    @staticmethod
    def parse_stars(text):
        text = text.strip().replace(',', '')
        if 'k' in text:
            return int(float(text[:-1]) * 1000)
        elif 'm' in text:
            return int(float(text[:-1]) * 1000000)
        return int(text)
    
    @staticmethod
    def fetch_trending(period='daily'):
        """period: daily, weekly, monthly"""
        url = f'{GitHubTrendingScraper.BASE_URL}?since={period}'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        repos = []
        
        # 尝试抓取GitHub趋势页面
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'html.parser')
                articles = soup.select('article.Box-row')
                
                for article in articles:
                    try:
                        # 仓库名称
                        h2 = article.select_one('h2.h3')
                        if not h2:
                            continue
                        a = h2.find('a')
                        full_name = a.get('href').strip('/')   # 格式: owner/repo
                        if '/' not in full_name:
                            continue
                        owner, repo_name = full_name.split('/', 1)
                        
                        # 星星数
                        star_span = article.select_one('span[aria-label*="stars"]') or article.select_one('a[href*="stargazers"]')
                        if star_span:
                            stars_text = star_span.get('aria-label') or star_span.text
                            # 提取数字部分
                            stars_match = re.search(r'([\d,k,m]+)', stars_text)
                            if stars_match:
                                stars = GitHubTrendingScraper.parse_stars(stars_match.group(1))
                            else:
                                stars = 0
                        else:
                            stars = 0
                        
                        # 描述
                        desc_p = article.select_one('p.col-9')
                        description = desc_p.text.strip() if desc_p else ''
                        
                        # 语言
                        lang_span = article.select_one('span[itemprop="programmingLanguage"]')
                        language = lang_span.text if lang_span else 'Unknown'
                        
                        repos.append({
                            'name': full_name,
                            'author': owner,
                            'repo_name': repo_name,
                            'url': f'https://github.com/{full_name}',
                            'description': description,
                            'stars': stars,
                            'language': language,
                            'topics': [],
                            'period': period
                        })
                    except Exception as e:
                        print(f"Error parsing repository data: {e}")
                        continue
        except requests.exceptions.RequestException as e:
            print(f"Error fetching GitHub trending data: {e}")
        except Exception as e:
            print(f"Unexpected error in fetch_trending: {e}")
        
        # 如果抓取的仓库数量不足50个，使用GitHub Search API补充
        if len(repos) < 50:
            try:
                # 使用GitHub Search API获取更多热门仓库
                search_url = 'https://api.github.com/search/repositories'
                # 计算过去的日期
                if period == 'daily':
                    days_ago = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
                elif period == 'weekly':
                    days_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
                else:
                    days_ago = (datetime.datetime.now() - datetime.timedelta(days=30)).strftime('%Y-%m-%d')
                
                # 根据时间范围构建搜索查询
                if period == 'daily':
                    q = f'stars:>1000 pushed:>={days_ago}'
                elif period == 'weekly':
                    q = f'stars:>1000 pushed:>={days_ago}'
                else:
                    q = f'stars:>1000 pushed:>={days_ago}'
                
                params = {'q': q, 'sort': 'stars', 'order': 'desc', 'per_page': 50}
                headers = {'Accept': 'application/vnd.github.v3+json'}
                
                resp = requests.get(search_url, params=params, headers=headers, timeout=15)
                if resp.status_code == 200:
                    items = resp.json().get('items', [])
                    # 转换为统一格式并去重
                    existing_repos = {repo['name'] for repo in repos}
                    
                    for item in items:
                        if item['full_name'] not in existing_repos:
                            repos.append({
                                'name': item['full_name'],
                                'author': item['owner']['login'],
                                'repo_name': item['name'],
                                'url': item['html_url'],
                                'description': item['description'] or '',
                                'stars': item['stargazers_count'],
                                'language': item['language'] or 'Unknown',
                                'topics': item.get('topics', []),
                                'pushed_at': item.get('pushed_at', ''),
                                'period': period
                            })
                            existing_repos.add(item['full_name'])
                            if len(repos) >= 50:
                                break
            except requests.exceptions.RequestException as e:
                print(f"Error fetching GitHub Search API data: {e}")
        
        # 按星星数排序并返回前50个
        sorted_repos = sorted(repos, key=lambda x: x['stars'], reverse=True)
        return sorted_repos[:50]

    @staticmethod
    def fetch_declining():
        """获取下降趋势仓库 - 曾经热门但近期活跃度下降的项目"""
        repos = []
        try:
            six_months_ago = (datetime.datetime.now() - datetime.timedelta(days=180)).strftime('%Y-%m-%d')
            search_url = 'https://api.github.com/search/repositories'

            q = f'stars:>1000 pushed:<{six_months_ago}'
            params = {'q': q, 'sort': 'stars', 'order': 'desc', 'per_page': 50}
            headers = {'Accept': 'application/vnd.github.v3+json'}

            resp = requests.get(search_url, params=params, headers=headers, timeout=15)
            if resp.status_code == 200:
                items = resp.json().get('items', [])
                for item in items:
                    repos.append({
                        'name': item['full_name'],
                        'author': item['owner']['login'],
                        'repo_name': item['name'],
                        'url': item['html_url'],
                        'description': item['description'] or '',
                        'stars': item['stargazers_count'],
                        'language': item['language'] or 'Unknown',
                        'topics': item.get('topics', []),
                        'pushed_at': item.get('pushed_at', ''),
                        'period': 'declining'
                    })
        except requests.exceptions.RequestException as e:
            print(f"Error fetching declining trending data: {e}")
        except Exception as e:
            print(f"Unexpected error in fetch_declining: {e}")

        sorted_repos = sorted(repos, key=lambda x: x['stars'], reverse=True)
        return sorted_repos[:50]

    @staticmethod
    def fetch_rising():
        """获取上升趋势热点仓库 - 最近快速增长的项目"""
        repos = []
        try:
            one_month_ago = (datetime.datetime.now() - datetime.timedelta(days=30)).strftime('%Y-%m-%d')
            search_url = 'https://api.github.com/search/repositories'

            q = f'stars:>=500 created:>={one_month_ago}'
            params = {'q': q, 'sort': 'stars', 'order': 'desc', 'per_page': 50}
            headers = {'Accept': 'application/vnd.github.v3+json'}

            resp = requests.get(search_url, params=params, headers=headers, timeout=15)
            if resp.status_code == 200:
                items = resp.json().get('items', [])
                for item in items:
                    repos.append({
                        'name': item['full_name'],
                        'author': item['owner']['login'],
                        'repo_name': item['name'],
                        'url': item['html_url'],
                        'description': item['description'] or '',
                        'stars': item['stargazers_count'],
                        'language': item['language'] or 'Unknown',
                        'topics': item.get('topics', []),
                        'pushed_at': item.get('pushed_at', ''),
                        'period': 'rising'
                    })
        except requests.exceptions.RequestException as e:
            print(f"Error fetching rising trending data: {e}")
        except Exception as e:
            print(f"Unexpected error in fetch_rising: {e}")

        sorted_repos = sorted(repos, key=lambda x: x['stars'], reverse=True)
        return sorted_repos[:50]