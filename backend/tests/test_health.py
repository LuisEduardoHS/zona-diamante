from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_deployment_version_exposes_only_valid_revision(monkeypatch):
    monkeypatch.setenv('RENDER_GIT_COMMIT', 'a' * 40)
    assert client.get('/version').json() == {'revision': 'a' * 40}
    monkeypatch.setenv('RENDER_GIT_COMMIT', 'not-a-revision')
    assert client.get('/version').json() == {'revision': None}
