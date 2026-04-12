import pytest
import requests
import os

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def base_url():
    """Base URL from environment"""
    url = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    if not url:
        pytest.fail("EXPO_PUBLIC_BACKEND_URL environment variable not set")
    return url.rstrip('/')

@pytest.fixture
def test_user_credentials():
    """Test user credentials from test_credentials.md"""
    return {
        "email": "test@hustleai.com",
        "password": "Test123!",
        "name": "Test User"
    }
