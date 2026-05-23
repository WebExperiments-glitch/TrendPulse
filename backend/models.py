# 使用内存存储结合文件持久化，解决Python 3.13兼容性问题
import json
import os
import threading
from datetime import datetime, timedelta

# 存储文件路径
STORAGE_FILE = 'github_trending_data.json'
HISTORY_DIR = 'history'

# 内存存储结合文件持久化
class MemoryStorage:
    def __init__(self):
        self.repos = []
        self.id_counter = 1
        self.lock = threading.RLock()
        self._load_from_file()
    
    def add_repo(self, repo_data):
        with self.lock:
            repo = repo_data.copy()
            repo['id'] = self.id_counter
            self.id_counter += 1
            self.repos.append(repo)
            self._save_to_file()
        return repo
    
    def get_repos_by_period(self, period):
        with self.lock:
            return [repo.copy() for repo in self.repos if repo.get('period') == period]
    
    def clear_repos_by_period(self, period):
        with self.lock:
            self.repos = [repo for repo in self.repos if repo.get('period') != period]
            self._save_to_file()
    
    def get_all_repos(self):
        with self.lock:
            return [repo.copy() for repo in self.repos]

    def save_snapshot(self, period):
        with self.lock:
            try:
                timestamp = datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
                repos = [repo.copy() for repo in self.repos if repo.get('period') == period]
                if not repos:
                    return
                os.makedirs(HISTORY_DIR, exist_ok=True)
                filename = f'{HISTORY_DIR}/{period}_{timestamp}.json'
                snapshot = {
                    'period': period,
                    'timestamp': timestamp,
                    'repos': [{'name': r.get('name', ''), 'stars': r.get('stars', 0),
                               'language': r.get('language'), 'description': r.get('description', ''),
                               'url': r.get('url', ''), 'author': r.get('author', ''),
                               'topics': r.get('topics', [])} for r in repos]
                }
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(snapshot, f, ensure_ascii=False)
            except Exception as e:
                print(f"Error saving snapshot for {period}: {e}")

    def get_history(self, repo_name, days=30):
        history = []
        try:
            if not os.path.exists(HISTORY_DIR):
                return history
            cutoff = datetime.now() - timedelta(days=days)
            files = sorted(os.listdir(HISTORY_DIR), reverse=True)
            for fname in files:
                if not fname.endswith('.json'):
                    continue
                fpath = os.path.join(HISTORY_DIR, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    ts = data.get('timestamp', '')
                    if ts:
                        dt = datetime.strptime(ts, '%Y-%m-%dT%H-%M-%S')
                        if dt < cutoff:
                            continue
                    for repo in data.get('repos', []):
                        if repo.get('name') == repo_name:
                            history.append({
                                'date': ts[:10],
                                'stars': repo.get('stars', 0),
                            })
                            break
                except Exception:
                    continue
        except Exception as e:
            print(f"Error reading history for {repo_name}: {e}")
        return history
    
    def _save_to_file(self):
        """将数据保存到文件"""
        with self.lock:
            try:
                data = {
                    'repos': self.repos,
                    'id_counter': self.id_counter
                }
                with open(STORAGE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"Error saving data to file: {e}")
    
    def _load_from_file(self):
        """从文件加载数据"""
        with self.lock:
            try:
                if os.path.exists(STORAGE_FILE):
                    with open(STORAGE_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        self.repos = data.get('repos', [])
                        self.id_counter = data.get('id_counter', 1)
            except Exception as e:
                print(f"Error loading data from file: {e}")
                # 如果加载失败，使用默认值
                self.repos = []
                self.id_counter = 1

# 创建全局存储实例
storage = MemoryStorage()