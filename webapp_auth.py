"""Проверка Telegram WebApp initData."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from config import settings


def validate_init_data(init_data: str, max_age_sec: int = 86400) -> dict | None:
    """
    Возвращает распарсенные данные пользователя или None, если подпись невалидна.
    """
    if not init_data or not settings.bot_token:
        return None

    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # data_check_string
    check_list = [f"{k}={v}" for k, v in sorted(parsed.items())]
    data_check_string = "\n".join(check_list)

    secret_key = hmac.new(
        b"WebAppData",
        settings.bot_token.encode(),
        hashlib.sha256,
    ).digest()

    calculated = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated, received_hash):
        return None

    # проверка свежести
    auth_date = int(parsed.get("auth_date", 0))
    if abs(time.time() - auth_date) > max_age_sec:
        return None

    user_raw = parsed.get("user")
    if not user_raw:
        return None

    try:
        user = json.loads(user_raw)
    except json.JSONDecodeError:
        return None

    return {
        "user_id": user.get("id"),
        "username": user.get("username"),
        "first_name": user.get("first_name"),
        "language_code": user.get("language_code"),
        "raw": parsed,
    }
