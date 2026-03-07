from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import settings

try:
    from jose import JWTError as JoseJWTError
    from jose import jwt as jose_jwt

    HAS_JOSE = True
except Exception:  # noqa: BLE001
    JoseJWTError = Exception
    jose_jwt = None
    HAS_JOSE = False

try:
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    HAS_PASSLIB = True
except Exception:  # noqa: BLE001
    pwd_context = None
    HAS_PASSLIB = False


class TokenDecodeError(Exception):
    pass


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if HAS_PASSLIB and pwd_context is not None:
        return pwd_context.verify(plain_password, hashed_password)

    if not hashed_password.startswith("pbkdf2$"):
        return False
    _, salt_hex, expected_hex = hashed_password.split("$", 2)
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt, 120_000).hex()
    return hmac.compare_digest(digest, expected_hex)


def get_password_hash(password: str) -> str:
    if HAS_PASSLIB and pwd_context is not None:
        return pwd_context.hash(password)

    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000).hex()
    return f"pbkdf2${salt.hex()}${digest}"


def create_access_token(subject: str, org_id: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode: dict[str, Any] = {"sub": subject, "org": org_id, "exp": expire}

    if HAS_JOSE and jose_jwt is not None:
        return jose_jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

    payload = {
        "sub": subject,
        "org": org_id,
        "exp": int(expire.timestamp()),
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = hmac.new(settings.secret_key.encode(), payload_b64.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> dict[str, Any]:
    if HAS_JOSE and jose_jwt is not None:
        try:
            return jose_jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        except JoseJWTError as exc:  # type: ignore[misc]
            raise TokenDecodeError("invalid token") from exc

    try:
        payload_b64, sig_b64 = token.split(".", 1)
    except ValueError as exc:
        raise TokenDecodeError("invalid token format") from exc

    expected_sig = hmac.new(settings.secret_key.encode(), payload_b64.encode(), hashlib.sha256).digest()
    expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode().rstrip("=")
    if not hmac.compare_digest(sig_b64, expected_sig_b64):
        raise TokenDecodeError("invalid token signature")

    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
    exp = int(payload.get("exp", 0))
    if datetime.now(timezone.utc).timestamp() > exp:
        raise TokenDecodeError("token expired")
    return payload
