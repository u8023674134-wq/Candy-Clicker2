from __future__ import annotations

import time
from typing import Any

import aiosqlite

from config import settings
from models import DEFAULT_UPGRADES, SCHEMA


class Database:
    def __init__(self, path: str = settings.db_path):
        self.path = path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._conn = await aiosqlite.connect(self.path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.executescript(SCHEMA)
        await self._seed_upgrades()
        await self._conn.commit()

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if not self._conn:
            raise RuntimeError("Database not connected")
        return self._conn

    async def _fetchone(self, sql: str, params: tuple = ()) -> aiosqlite.Row | None:
        async with self.conn.execute(sql, params) as cur:
            return await cur.fetchone()

    async def _fetchall(self, sql: str, params: tuple = ()) -> list[aiosqlite.Row]:
        async with self.conn.execute(sql, params) as cur:
            return await cur.fetchall()

    async def _seed_upgrades(self) -> None:
        for u in DEFAULT_UPGRADES:
            await self.conn.execute(
                """
                INSERT OR IGNORE INTO upgrades
                (id, name_ru, name_en, description, type, base_price, price_mult, effect, max_level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    u["id"], u["name_ru"], u["name_en"], u["description"],
                    u["type"], u["base_price"], u["price_mult"], u["effect"], u["max_level"],
                ),
            )

    # ── users ──────────────────────────────────────────────────────────────

    async def get_or_create_user(
        self,
        user_id: int,
        username: str | None = None,
        first_name: str | None = None,
    ) -> dict[str, Any]:
        row = await self._fetchone("SELECT * FROM users WHERE user_id = ?", (user_id,))
        now = time.time()
        if row:
            await self.conn.execute(
                "UPDATE users SET username = ?, first_name = ?, updated_at = ? WHERE user_id = ?",
                (username, first_name, now, user_id),
            )
            await self.conn.commit()
            return dict(row)

        await self.conn.execute(
            """
            INSERT INTO users
            (user_id, username, first_name, coins, total_earned, click_power, passive_income, skin, last_passive_at, created_at, updated_at)
            VALUES (?, ?, ?, 0, 0, 1, 0, 'candy', ?, ?, ?)
            """,
            (user_id, username, first_name, now, now, now),
        )
        await self.conn.execute(
            "INSERT OR IGNORE INTO user_upgrades (user_id, upgrade_id, level) VALUES (?, 'skin_candy', 1)",
            (user_id,),
        )
        await self.conn.commit()
        row = await self._fetchone("SELECT * FROM users WHERE user_id = ?", (user_id,))
        return dict(row)  # type: ignore

    async def get_user(self, user_id: int) -> dict[str, Any] | None:
        row = await self._fetchone("SELECT * FROM users WHERE user_id = ?", (user_id,))
        return dict(row) if row else None

    async def apply_passive(self, user_id: int) -> float:
        """Начисляет пассивный доход. Возвращает сколько начислили."""
        user = await self.get_user(user_id)
        if not user or user["passive_income"] <= 0:
            return 0.0

        now = time.time()
        last = user["last_passive_at"] or now
        elapsed = max(0.0, min(now - last, 8 * 3600))  # макс 8 часов
        earned = user["passive_income"] * elapsed

        if earned > 0:
            await self.conn.execute(
                """
                UPDATE users
                SET coins = coins + ?, total_earned = total_earned + ?, last_passive_at = ?, updated_at = ?
                WHERE user_id = ?
                """,
                (earned, earned, now, now, user_id),
            )
        else:
            await self.conn.execute(
                "UPDATE users SET last_passive_at = ? WHERE user_id = ?",
                (now, user_id),
            )
        await self.conn.commit()
        return earned

    async def add_coins(self, user_id: int, amount: float) -> dict[str, Any]:
        now = time.time()
        await self.conn.execute(
            """
            UPDATE users
            SET coins = coins + ?, total_earned = total_earned + ?, updated_at = ?
            WHERE user_id = ?
            """,
            (amount, amount, now, user_id),
        )
        await self.conn.commit()
        return await self.get_user(user_id)  # type: ignore

    async def spend_coins(self, user_id: int, amount: float) -> bool:
        user = await self.get_user(user_id)
        if not user or user["coins"] + 0.01 < amount:
            return False
        await self.conn.execute(
            "UPDATE users SET coins = coins - ?, updated_at = ? WHERE user_id = ?",
            (amount, time.time(), user_id),
        )
        await self.conn.commit()
        return True

    async def set_skin(self, user_id: int, skin: str) -> None:
        await self.conn.execute(
            "UPDATE users SET skin = ?, updated_at = ? WHERE user_id = ?",
            (skin, time.time(), user_id),
        )
        await self.conn.commit()

    async def recalculate_stats(self, user_id: int) -> None:
        rows = await self._fetchall(
            """
            SELECT u.type, u.effect, uu.level
            FROM user_upgrades uu
            JOIN upgrades u ON u.id = uu.upgrade_id
            WHERE uu.user_id = ? AND uu.level > 0 AND u.type IN ('click', 'passive')
            """,
            (user_id,),
        )
        click = settings.base_click_power
        passive = settings.base_passive
        for r in rows:
            if r["type"] == "click":
                click += r["effect"] * r["level"]
            elif r["type"] == "passive":
                passive += r["effect"] * r["level"]

        await self.conn.execute(
            "UPDATE users SET click_power = ?, passive_income = ?, updated_at = ? WHERE user_id = ?",
            (int(click), passive, time.time(), user_id),
        )
        await self.conn.commit()

    # ── upgrades ───────────────────────────────────────────────────────────

    async def get_all_upgrades(self) -> list[dict[str, Any]]:
        rows = await self._fetchall("SELECT * FROM upgrades ORDER BY base_price")
        return [dict(r) for r in rows]

    async def get_user_upgrades(self, user_id: int) -> dict[str, int]:
        rows = await self._fetchall(
            "SELECT upgrade_id, level FROM user_upgrades WHERE user_id = ?",
            (user_id,),
        )
        return {r["upgrade_id"]: r["level"] for r in rows}

    async def get_upgrade_level(self, user_id: int, upgrade_id: str) -> int:
        row = await self._fetchone(
            "SELECT level FROM user_upgrades WHERE user_id = ? AND upgrade_id = ?",
            (user_id, upgrade_id),
        )
        return int(row["level"]) if row else 0

    def calc_price(self, base: float, mult: float, level: int) -> float:
        return round(base * (mult ** level), 2)

    async def buy_upgrade(self, user_id: int, upgrade_id: str) -> dict[str, Any]:
        upg_row = await self._fetchone("SELECT * FROM upgrades WHERE id = ?", (upgrade_id,))
        if not upg_row:
            return {"ok": False, "error": "upgrade_not_found"}

        upg = dict(upg_row)
        level = await self.get_upgrade_level(user_id, upgrade_id)

        # Уже купленный скин — просто надеть
        if upg["type"] == "skin" and level >= 1:
            skin_name = upgrade_id.replace("skin_", "")
            await self.set_skin(user_id, skin_name)
            user = await self.get_user(user_id)
            return {
                "ok": True,
                "upgrade_id": upgrade_id,
                "new_level": level,
                "price_paid": 0,
                "user": user,
                "equipped": True,
            }

        if level >= upg["max_level"]:
            return {"ok": False, "error": "max_level"}

        price = self.calc_price(upg["base_price"], upg["price_mult"], level)
        if price > 0:
            ok = await self.spend_coins(user_id, price)
            if not ok:
                return {"ok": False, "error": "not_enough_coins", "price": price}

        await self.conn.execute(
            """
            INSERT INTO user_upgrades (user_id, upgrade_id, level)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, upgrade_id) DO UPDATE SET level = level + 1
            """,
            (user_id, upgrade_id),
        )
        await self.conn.commit()

        if upg["type"] == "skin":
            skin_name = upgrade_id.replace("skin_", "")
            await self.set_skin(user_id, skin_name)
        else:
            await self.recalculate_stats(user_id)

        user = await self.get_user(user_id)
        return {
            "ok": True,
            "upgrade_id": upgrade_id,
            "new_level": level + 1,
            "price_paid": price,
            "user": user,
        }


db = Database()
