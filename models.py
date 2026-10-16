from __future__ import annotations

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id     INTEGER PRIMARY KEY,
    username    TEXT,
    first_name  TEXT,
    coins       REAL NOT NULL DEFAULT 0,
    total_earned REAL NOT NULL DEFAULT 0,
    click_power INTEGER NOT NULL DEFAULT 1,
    passive_income REAL NOT NULL DEFAULT 0,
    skin        TEXT NOT NULL DEFAULT 'candy',
    last_passive_at REAL,
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS upgrades (
    id          TEXT PRIMARY KEY,
    name_ru     TEXT NOT NULL,
    name_en     TEXT NOT NULL,
    description TEXT,
    type        TEXT NOT NULL,          -- click | passive | skin
    base_price  REAL NOT NULL,
    price_mult  REAL NOT NULL DEFAULT 1.5,
    effect      REAL NOT NULL,          -- сколько даёт за уровень
    max_level   INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS user_upgrades (
    user_id     INTEGER NOT NULL,
    upgrade_id  TEXT NOT NULL,
    level       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, upgrade_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (upgrade_id) REFERENCES upgrades(id)
);

CREATE INDEX IF NOT EXISTS idx_user_upgrades_user ON user_upgrades(user_id);
"""

# Стартовый набор апгрейдов
DEFAULT_UPGRADES = [
    {
        "id": "click_power",
        "name_ru": "Сила клика",
        "name_en": "Click Power",
        "description": "+1 монета за клик за уровень",
        "type": "click",
        "base_price": 15,
        "price_mult": 1.55,
        "effect": 1,
        "max_level": 100,
    },
    {
        "id": "auto_clicker",
        "name_ru": "Автокликер",
        "name_en": "Auto Clicker",
        "description": "+0.5 монет/сек за уровень",
        "type": "passive",
        "base_price": 50,
        "price_mult": 1.6,
        "effect": 0.5,
        "max_level": 50,
    },
    {
        "id": "golden_tap",
        "name_ru": "Золотой тап",
        "name_en": "Golden Tap",
        "description": "+3 к силе клика за уровень",
        "type": "click",
        "base_price": 200,
        "price_mult": 1.7,
        "effect": 3,
        "max_level": 30,
    },
    {
        "id": "farm",
        "name_ru": "Ферма конфет",
        "name_en": "Candy Farm",
        "description": "+2 монеты/сек за уровень",
        "type": "passive",
        "base_price": 500,
        "price_mult": 1.65,
        "effect": 2,
        "max_level": 25,
    },
    # Скины (разовые покупки)
    {
        "id": "skin_candy",
        "name_ru": "Конфета",
        "name_en": "Candy",
        "description": "Классическая конфета",
        "type": "skin",
        "base_price": 0,
        "price_mult": 1,
        "effect": 0,
        "max_level": 1,
    },
    {
        "id": "skin_cookie",
        "name_ru": "Печенька",
        "name_en": "Cookie",
        "description": "Хрустящая печенька",
        "type": "skin",
        "base_price": 300,
        "price_mult": 1,
        "effect": 0,
        "max_level": 1,
    },
    {
        "id": "skin_star",
        "name_ru": "Звезда",
        "name_en": "Star",
        "description": "Светящаяся звезда",
        "type": "skin",
        "base_price": 1500,
        "price_mult": 1,
        "effect": 0,
        "max_level": 1,
    },
    {
        "id": "skin_rocket",
        "name_ru": "Ракета",
        "name_en": "Rocket",
        "description": "Космическая ракета",
        "type": "skin",
        "base_price": 5000,
        "price_mult": 1,
        "effect": 0,
        "max_level": 1,
    },
]
