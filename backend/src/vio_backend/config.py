from dataclasses import dataclass
import os


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value else default


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    # HMAC key for student_accounts.identity_hash (email) and email_challenges
    # code_hash. Never log, commit, or expose this. Rotating it invalidates
    # every existing identity hash and challenge; see docs/DECISIONS.md.
    identity_hash_secret: str | None
    # HMAC key for student_sessions.token_hash. Separate from
    # identity_hash_secret so the two cannot be used interchangeably.
    session_secret: str | None
    smtp_host: str | None
    smtp_port: int
    smtp_username: str | None
    smtp_password: str | None
    smtp_from_address: str | None
    # Approved 2026-11-10: 10-minute expiry, 60-second resend cooldown.
    # Attempt/hourly caps are provisional defaults pending explicit
    # confirmation (see docs/DECISIONS.md, "Pending Before M2 Can Close").
    challenge_ttl_minutes: int
    challenge_resend_cooldown_seconds: int
    challenge_max_attempts: int
    challenge_max_per_hour: int
    session_ttl_days: int
    api_prefix: str = "/api/v1"

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            database_url=os.getenv("DATABASE_URL"),
            identity_hash_secret=os.getenv("IDENTITY_HASH_SECRET"),
            session_secret=os.getenv("SESSION_SECRET"),
            smtp_host=os.getenv("SMTP_HOST"),
            smtp_port=_int_env("SMTP_PORT", 587),
            smtp_username=os.getenv("SMTP_USERNAME"),
            smtp_password=os.getenv("SMTP_APP_PASSWORD"),
            smtp_from_address=os.getenv("SMTP_FROM_ADDRESS"),
            challenge_ttl_minutes=_int_env("EMAIL_CHALLENGE_TTL_MINUTES", 10),
            challenge_resend_cooldown_seconds=_int_env("EMAIL_CHALLENGE_RESEND_COOLDOWN_SECONDS", 60),
            challenge_max_attempts=_int_env("EMAIL_CHALLENGE_MAX_ATTEMPTS", 5),
            challenge_max_per_hour=_int_env("EMAIL_CHALLENGE_MAX_PER_HOUR", 5),
            session_ttl_days=_int_env("STUDENT_SESSION_TTL_DAYS", 30),
        )
