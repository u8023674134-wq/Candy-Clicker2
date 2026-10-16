from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from database import db
from webapp_auth import validate_init_data

router = APIRouter(prefix="/api")


def _user_from_init(init_data: str | None) -> dict:
    if not init_data:
        raise HTTPException(401, "Missing initData")
    data = validate_init_data(init_data)
    if not data or not data.get("user_id"):
        raise HTTPException(401, "Invalid initData")
    return data


class TapRequest(BaseModel):
    count: int = Field(ge=1, le=100)


class BuyRequest(BaseModel):
    upgrade_id: str


@router.get("/me")
async def get_me(x_telegram_init_data: str | None = Header(None)):
    tg = _user_from_init(x_telegram_init_data)
    await db.get_or_create_user(tg["user_id"], tg.get("username"), tg.get("first_name"))
    earned = await db.apply_passive(tg["user_id"])
    user = await db.get_user(tg["user_id"])
    upgrades = await db.get_all_upgrades()
    levels = await db.get_user_upgrades(tg["user_id"])

    shop = []
    for u in upgrades:
        lvl = levels.get(u["id"], 0)
        price = db.calc_price(u["base_price"], u["price_mult"], lvl)
        shop.append({
            **u,
            "level": lvl,
            "price": price,
            "owned": lvl > 0 if u["type"] == "skin" else False,
            "can_buy": lvl < u["max_level"] and (price == 0 or (user and user["coins"] + 0.01 >= price)),
        })

    return {
        "user": {
            "id": user["user_id"],
            "coins": round(user["coins"], 2),
            "total_earned": round(user["total_earned"], 2),
            "click_power": user["click_power"],
            "passive_income": round(user["passive_income"], 2),
            "skin": user["skin"],
        },
        "passive_earned": round(earned, 2),
        "shop": shop,
    }


@router.post("/tap")
async def tap(body: TapRequest, x_telegram_init_data: str | None = Header(None)):
    tg = _user_from_init(x_telegram_init_data)
    user = await db.get_or_create_user(tg["user_id"], tg.get("username"), tg.get("first_name"))
    await db.apply_passive(tg["user_id"])

    count = min(body.count, 100)
    power = max(1, int(user["click_power"]))
    gained = power * count

    user = await db.add_coins(tg["user_id"], gained)
    return {
        "ok": True,
        "gained": gained,
        "coins": round(user["coins"], 2),
        "click_power": user["click_power"],
    }


@router.post("/buy")
async def buy(body: BuyRequest, x_telegram_init_data: str | None = Header(None)):
    tg = _user_from_init(x_telegram_init_data)
    await db.get_or_create_user(tg["user_id"], tg.get("username"), tg.get("first_name"))
    await db.apply_passive(tg["user_id"])

    result = await db.buy_upgrade(tg["user_id"], body.upgrade_id)
    if not result["ok"]:
        user = await db.get_user(tg["user_id"])
        raise HTTPException(
            400,
            {
                "error": result.get("error", "buy_failed"),
                "price": result.get("price"),
                "coins": round(user["coins"], 2) if user else 0,
            },
        )

    user = result["user"]
    return {
        "ok": True,
        "upgrade_id": result["upgrade_id"],
        "new_level": result["new_level"],
        "price_paid": result["price_paid"],
        "user": {
            "coins": round(user["coins"], 2),
            "click_power": user["click_power"],
            "passive_income": round(user["passive_income"], 2),
            "skin": user["skin"],
        },
    }
