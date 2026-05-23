from apscheduler.schedulers.background import BackgroundScheduler
from scraper import GitHubTrendingScraper
from models import storage
from datetime import datetime
import time

# 全局scheduler实例
scheduler = None

def update_daily_trending():
    retries = 3
    delay = 5
    MIN_REPOS = 30
    for i in range(retries):
        try:
            repos_data = GitHubTrendingScraper.fetch_trending('daily')
            if repos_data and len(repos_data) >= MIN_REPOS:
                storage.save_snapshot('daily')
                storage.clear_repos_by_period('daily')
                for data in repos_data:
                    storage.add_repo(data)
                print(f"[{datetime.now()}] Daily trending updated with {len(repos_data)} repositories.")
                return
            elif repos_data:
                print(f"[{datetime.now()}] Only {len(repos_data)} repos fetched for daily, need >= {MIN_REPOS}, retrying... ({i+1}/{retries})")
            else:
                print(f"[{datetime.now()}] No data fetched for daily trending, retrying... ({i+1}/{retries})")
        except Exception as e:
            print(f"[{datetime.now()}] Error updating daily trending: {e}, retrying... ({i+1}/{retries})")
        if i < retries - 1:
            time.sleep(delay)
    print(f"[{datetime.now()}] Failed to update daily trending after {retries} retries. Keeping existing data.")

def update_weekly_trending():
    retries = 3
    delay = 5
    MIN_REPOS = 30
    for i in range(retries):
        try:
            repos_data = GitHubTrendingScraper.fetch_trending('weekly')
            if repos_data and len(repos_data) >= MIN_REPOS:
                storage.save_snapshot('weekly')
                storage.clear_repos_by_period('weekly')
                for data in repos_data:
                    storage.add_repo(data)
                print(f"[{datetime.now()}] Weekly trending updated with {len(repos_data)} repositories.")
                return
            elif repos_data:
                print(f"[{datetime.now()}] Only {len(repos_data)} repos fetched for weekly, need >= {MIN_REPOS}, retrying... ({i+1}/{retries})")
            else:
                print(f"[{datetime.now()}] No data fetched for weekly trending, retrying... ({i+1}/{retries})")
        except Exception as e:
            print(f"[{datetime.now()}] Error updating weekly trending: {e}, retrying... ({i+1}/{retries})")
        if i < retries - 1:
            time.sleep(delay)
    print(f"[{datetime.now()}] Failed to update weekly trending after {retries} retries. Keeping existing data.")

def update_rising_trending():
    retries = 3
    delay = 5
    MIN_REPOS = 30
    for i in range(retries):
        try:
            repos_data = GitHubTrendingScraper.fetch_rising()
            if repos_data and len(repos_data) >= MIN_REPOS:
                storage.save_snapshot('rising')
                storage.clear_repos_by_period('rising')
                for data in repos_data:
                    storage.add_repo(data)
                print(f"[{datetime.now()}] Rising trending updated with {len(repos_data)} repositories.")
                return
            elif repos_data:
                print(f"[{datetime.now()}] Only {len(repos_data)} repos fetched for rising, need >= {MIN_REPOS}, retrying... ({i+1}/{retries})")
            else:
                print(f"[{datetime.now()}] No data fetched for rising trending, retrying... ({i+1}/{retries})")
        except Exception as e:
            print(f"[{datetime.now()}] Error updating rising trending: {e}, retrying... ({i+1}/{retries})")
        if i < retries - 1:
            time.sleep(delay)
    print(f"[{datetime.now()}] Failed to update rising trending after {retries} retries. Keeping existing data.")

def update_declining_trending():
    retries = 3
    delay = 5
    MIN_REPOS = 30
    for i in range(retries):
        try:
            repos_data = GitHubTrendingScraper.fetch_declining()
            if repos_data and len(repos_data) >= MIN_REPOS:
                storage.save_snapshot('declining')
                storage.clear_repos_by_period('declining')
                for data in repos_data:
                    storage.add_repo(data)
                print(f"[{datetime.now()}] Declining trending updated with {len(repos_data)} repositories.")
                return
            elif repos_data:
                print(f"[{datetime.now()}] Only {len(repos_data)} repos fetched for declining, need >= {MIN_REPOS}, retrying... ({i+1}/{retries})")
            else:
                print(f"[{datetime.now()}] No data fetched for declining trending, retrying... ({i+1}/{retries})")
        except Exception as e:
            print(f"[{datetime.now()}] Error updating declining trending: {e}, retrying... ({i+1}/{retries})")
        if i < retries - 1:
            time.sleep(delay)
    print(f"[{datetime.now()}] Failed to update declining trending after {retries} retries. Keeping existing data.")

def start_scheduler():
    global scheduler
    if scheduler is None:
        # 创建并配置scheduler
        scheduler = BackgroundScheduler()
        scheduler.add_job(update_daily_trending, 'interval', hours=1)
        scheduler.add_job(update_weekly_trending, 'interval', hours=3)
        scheduler.add_job(update_rising_trending, 'interval', hours=2)
        scheduler.add_job(update_declining_trending, 'interval', hours=4)
        scheduler.start()
        print("Scheduler started successfully.")
    
    # 立即执行一次，获取初始数据
    try:
        update_daily_trending()
    except Exception as e:
        print(f"Error updating daily trending: {e}")
    try:
        update_weekly_trending()
    except Exception as e:
        print(f"Error updating weekly trending: {e}")
    try:
        update_rising_trending()
    except Exception as e:
        print(f"Error updating rising trending: {e}")
    try:
        update_declining_trending()
    except Exception as e:
        print(f"Error updating declining trending: {e}")
    return scheduler