from fastapi.testclient import TestClient

from vio_backend.main import app


def test_liveness_is_available_without_database():
    with TestClient(app) as client:
        response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_readiness_fails_closed_without_database_configuration():
    with TestClient(app) as client:
        response = client.get("/health/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "service_unavailable"
    assert body["error"]["message"] == "Database is not configured"
    assert "request_id" in body["error"]


def test_catalogue_endpoint_fails_closed_without_database_configuration():
    with TestClient(app) as client:
        response = client.get("/api/v1/universities")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"


def test_academic_sessions_endpoint_fails_closed_without_database_configuration():
    with TestClient(app) as client:
        response = client.get("/api/v1/academic-sessions")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"


def test_email_challenge_fails_closed_without_database_configuration():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/student/email-challenges",
            json={"university_id": "00000000-0000-0000-0000-000000000000", "email": "surnametl.26@student.funaab.edu.ng"},
        )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"


def test_session_summary_fails_closed_without_database_configuration():
    with TestClient(app) as client:
        response = client.get("/api/v1/auth/session")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"


def test_student_profile_fails_closed_without_database_configuration():
    with TestClient(app) as client:
        response = client.get("/api/v1/student/profile")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"


def test_unknown_route_is_not_found():
    with TestClient(app) as client:
        response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
