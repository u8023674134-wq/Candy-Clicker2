from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from config import settings
from payments import COIN_PACKS


def main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎮 Играть",
                    web_app=WebAppInfo(url=settings.webapp_url),
                )
            ],
            [
                InlineKeyboardButton(text="💎 Купить монеты", callback_data="buychips"),
            ],
            [
                InlineKeyboardButton(text="📊 Моя статистика", callback_data="stats"),
                InlineKeyboardButton(text="ℹ️ Помощь", callback_data="help"),
            ],
        ]
    )


def back_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🏠 В меню", callback_data="menu")]
        ]
    )


def coin_shop_kb() -> InlineKeyboardMarkup:
    rows = []
    for payload, p in COIN_PACKS.items():
        eur = p["amount"] / 100
        rows.append([
            InlineKeyboardButton(
                text=f"{p['coins']:,} 🍬 — {eur:.2f} €".replace(",", " "),
                callback_data=f"buy:{payload}",
            )
        ])
    rows.append([InlineKeyboardButton(text="🏠 В меню", callback_data="menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)
