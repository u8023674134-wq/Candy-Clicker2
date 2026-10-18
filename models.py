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
    skin        TEXT NOT NULL DEFAULT 'lollipop',
    last_passive_at REAL,
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS upgrades (
    id          TEXT PRIMARY KEY,
    name_ru     TEXT NOT NULL,
    name_en     TEXT NOT NULL,
    description TEXT,
    type        TEXT NOT NULL,
    base_price  REAL NOT NULL,
    price_mult  REAL NOT NULL DEFAULT 1.5,
    effect      REAL NOT NULL,
    max_level   INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS user_upgrades (
    user_id     INTEGER NOT NULL,
    upgrade_id  TEXT NOT NULL,
    level       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, upgrade_id)
);

CREATE INDEX IF NOT EXISTS idx_user_upgrades_user ON user_upgrades(user_id);
"""

DEFAULT_UPGRADES = [
    {"id": "click_power", "name_ru": "Сила клика", "name_en": "Click Power", "description": "+1 монета за клик", "type": "click", "base_price": 15, "price_mult": 1.55, "effect": 1, "max_level": 100},
    {"id": "golden_tap", "name_ru": "Золотой тап", "name_en": "Golden Tap", "description": "+3 к силе клика", "type": "click", "base_price": 200, "price_mult": 1.7, "effect": 3, "max_level": 30},
    {"id": "rainbow_tap", "name_ru": "Радужный тап", "name_en": "Rainbow Tap", "description": "+8 к силе клика", "type": "click", "base_price": 2500, "price_mult": 1.75, "effect": 8, "max_level": 20},
    {"id": "shop_candy", "name_ru": "Лавка конфет", "name_en": "Candy Shop", "description": "+0.5 монет/сек", "type": "passive", "base_price": 50, "price_mult": 1.55, "effect": 0.5, "max_level": 50},
    {"id": "factory_candy", "name_ru": "Фабрика конфет", "name_en": "Candy Factory", "description": "+2 монеты/сек", "type": "passive", "base_price": 400, "price_mult": 1.6, "effect": 2, "max_level": 40},
    {"id": "pastry", "name_ru": "Кондитерская", "name_en": "Pastry Shop", "description": "+5 монет/сек", "type": "passive", "base_price": 1500, "price_mult": 1.65, "effect": 5, "max_level": 30},
    {"id": "bakery", "name_ru": "Пекарня", "name_en": "Bakery", "description": "+4 монеты/сек", "type": "passive", "base_price": 900, "price_mult": 1.58, "effect": 4, "max_level": 35},
    {"id": "fruit_farm", "name_ru": "Фруктовая ферма", "name_en": "Fruit Farm", "description": "+8 монет/сек", "type": "passive", "base_price": 3500, "price_mult": 1.6, "effect": 8, "max_level": 30},
    {"id": "sweet_castle", "name_ru": "Сладкий замок", "name_en": "Sweet Castle", "description": "+12 монет/сек", "type": "passive", "base_price": 8000, "price_mult": 1.7, "effect": 12, "max_level": 25},
    {"id": "candy_mine", "name_ru": "Рудник сладостей", "name_en": "Candy Mine", "description": "+15 монет/сек", "type": "passive", "base_price": 12000, "price_mult": 1.68, "effect": 15, "max_level": 25},
    {"id": "choco_factory", "name_ru": "Шоколадная фабрика", "name_en": "Chocolate Factory", "description": "+25 монет/сек", "type": "passive", "base_price": 25000, "price_mult": 1.72, "effect": 25, "max_level": 20},
    {"id": "space_factory", "name_ru": "Космическая фабрика", "name_en": "Space Factory", "description": "+60 монет/сек", "type": "passive", "base_price": 100000, "price_mult": 1.75, "effect": 60, "max_level": 15},
    # skins — конфеты
    {"id": "skin_lollipop", "name_ru": "Леденец", "name_en": "Lollipop", "description": "Главный леденец", "type": "skin", "base_price": 0, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_candy", "name_ru": "Конфета", "name_en": "Candy", "description": "Жёлтая обёртка", "type": "skin", "base_price": 100, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_choco", "name_ru": "Шоколадка", "name_en": "Chocolate", "description": "Плитка шоколада", "type": "skin", "base_price": 300, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_heart", "name_ru": "Сердечко", "name_en": "Heart", "description": "Розовое сердце", "type": "skin", "base_price": 500, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_gummy", "name_ru": "Мишка", "name_en": "Gummy", "description": "Желейный мишка", "type": "skin", "base_price": 800, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_peppermint", "name_ru": "Мятная", "name_en": "Peppermint", "description": "Мятная конфета", "type": "skin", "base_price": 1000, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_strawberry", "name_ru": "Клубника", "name_en": "Strawberry", "description": "Клубничная конфетка", "type": "skin", "base_price": 1200, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_rainbow", "name_ru": "Радуга", "name_en": "Rainbow", "description": "Радужный леденец", "type": "skin", "base_price": 2000, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_gumdrop", "name_ru": "Мармелад", "name_en": "Gumdrop", "description": "Розовый мармелад", "type": "skin", "base_price": 1500, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_swirl", "name_ru": "Трюфель", "name_en": "Swirl", "description": "Шоколадный трюфель", "type": "skin", "base_price": 1800, "price_mult": 1, "effect": 0, "max_level": 1},
    # skins — маскоты
    {"id": "skin_cat", "name_ru": "Котик", "name_en": "Cat", "description": "Маскот-котик", "type": "skin", "base_price": 3000, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_gingerbread", "name_ru": "Пряник", "name_en": "Gingerbread", "description": "Пряничный человечек", "type": "skin", "base_price": 3500, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_cupcake", "name_ru": "Капкейк", "name_en": "Cupcake", "description": "Маскот-капкейк", "type": "skin", "base_price": 3800, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_panda", "name_ru": "Панда", "name_en": "Panda", "description": "Сладкая панда", "type": "skin", "base_price": 4000, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_raccoon", "name_ru": "Енот", "name_en": "Raccoon", "description": "Енот с конфетой", "type": "skin", "base_price": 4200, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_penguin", "name_ru": "Пингвин", "name_en": "Penguin", "description": "Пингвин с леденцом", "type": "skin", "base_price": 4500, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_bear", "name_ru": "Мишка", "name_en": "Bear", "description": "Плюшевый мишка", "type": "skin", "base_price": 4000, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_bunny", "name_ru": "Зайчик", "name_en": "Bunny", "description": "Зайчик с конфетой", "type": "skin", "base_price": 4000, "price_mult": 1, "effect": 0, "max_level": 1},
    {"id": "skin_unicorn", "name_ru": "Единорог", "name_en": "Unicorn", "description": "Радужный единорог", "type": "skin", "base_price": 10000, "price_mult": 1, "effect": 0, "max_level": 1},
]
