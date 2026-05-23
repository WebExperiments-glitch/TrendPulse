import requests
import time

# 测试API响应时间
def test_api_performance():
    endpoints = [
        'http://localhost:5000/api/trending/daily',
        'http://localhost:5000/api/trending/weekly',
        'http://localhost:5000/api/search?q=python'
    ]
    
    for endpoint in endpoints:
        print(f"Testing {endpoint}...")
        start_time = time.time()
        try:
            response = requests.get(endpoint, timeout=30)
            response_time = time.time() - start_time
            print(f"Status code: {response.status_code}")
            print(f"Response time: {response_time:.4f} seconds")
            if response.status_code == 200:
                data = response.json()
                print(f"Data length: {len(data)}")
            print()
        except Exception as e:
            print(f"Error: {e}")
            print()

if __name__ == "__main__":
    test_api_performance()
