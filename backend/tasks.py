from apscheduler.schedulers.background import BackgroundScheduler
from scraper import GitHubTrendingScraper
from models import storage
from datetime import datetime
import time

scheduler = None

def _update_period(period, fetch_method, label, interval_name):
    retries = 3
    delay = 5
    MIN_REPOS = 30
    for i in range(retries):
        try:
            repos_data = fetch_method()
            if repos_data and len(repos_data) >= MIN_REPOS:
                storage.save_snapshot(period)
                storage.add_repos_batch(repos_data, period)
                print(f"[{datetime.now()}] {label} trending updated with {len(repos_data)} repos.")
                return
            elif repos_data:
                print(f"[{datetime.now()}] Only {len(repos_data)} repos fetched for {label}, need >= {MIN_REPOS}, retrying... ({i+1}/{retries})")
            else:
                print(f"[{datetime.now()}] No data fetched for {label} trending, retrying... ({i+1}/{retries})")
        except Exception as e:
            print(f"[{datetime.now()}] Error updating {label} trending: {e}, retrying... ({i+1}/{retries})")
        if i < retries - 1:
            time.sleep(delay)
    print(f"[{datetime.now()}] Failed to update {label} trending after {retries} retries. Keeping existing data.")

def start_scheduler():
    global scheduler
    if scheduler is None:
        scheduler = BackgroundScheduler()
        scheduler.add_job(lambda: _update_period('daily', lambda: GitHubTrendingScraper.fetch_trending('daily'), 'Daily', 'daily'), 'interval', hours=1)
        scheduler.add_job(lambda: _update_period('weekly', lambda: GitHubTrendingScraper.fetch_trending('weekly'), 'Weekly', 'weekly'), 'interval', hours=3)
        scheduler.add_job(lambda: _update_period('rising', GitHubTrendingScraper.fetch_rising, 'Rising', 'rising'), 'interval', hours=2)
        scheduler.add_job(lambda: _update_period('declining', GitHubTrendingScraper.fetch_declining, 'Declining', 'declining'), 'interval', hours=4)
        scheduler.start()
        print("Scheduler started successfully.")

    try:
        _update_period('daily', lambda: GitHubTrendingScraper.fetch_trending('daily'), 'Daily', 'daily')
    except Exception as e:
        print(f"Error updating daily trending: {e}")
    try:
        _update_period('weekly', lambda: GitHubTrendingScraper.fetch_trending('weekly'), 'Weekly', 'weekly')
    except Exception as e:
        print(f"Error updating weekly trending: {e}")
    try:
        _update_period('rising', GitHubTrendingScraper.fetch_rising, 'Rising', 'rising')
    except Exception as e:
        print(f"Error updating rising trending: {e}")
    try:
        _update_period('declining', GitHubTrendingScraper.fetch_declining, 'Declining', 'declining')
    except Exception as e:
        print(f"Error updating declining trending: {e}")
    return scheduler