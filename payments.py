"""Пакеты монет для Telegram Payments."""
from __future__ import annotations

from aiogram.types import LabeledPrice

# payload → сколько монет начислить
# amount — в минимальных единицах валюты (евроценты): 100 = 1.00 EUR
COIN_PACKS: dict[str, dict] = {
    "coins_1000": {
        "title": "1 000 конфет 🍬",
        "description": "Пакет 1 000 монет для Candy Clicker",
        "coins": 1000,
        "amount": 99,       # 0.99 EUR
        "label": "1000 монет",
    },
    "coins_5000": {
        "title": "5 000 конфет 🍬",
        "description": "Пакет 5 000 монет для Candy Clicker",
        "coins": 5000,
        "amount": 349,      # 3.49 EUR
        "label": "5000 монет",
    },
    "coins_20000": {
        "title": "20 000 конфет 🍬",
        "description": "Пакет 20 000 монет для Candy Clicker",
        "coins": 20000,
        "amount": 999,      # 9.99 EUR
        "label": "20000 монет",
    },
}


def pack_prices(payload: str) -> list[LabeledPrice]:
    p = COIN_PACKS[payload]
    return [LabeledPrice(label=p["label"], amount=p["amount"])]
