from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message, PreCheckoutQuery

from config import settings
from database import db
from keyboards import back_kb, coin_shop_kb, main_menu_kb
from payments import COIN_PACKS, pack_prices

router = Router(name="start")


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user = message.from_user
    await db.get_or_create_user(user.id, user.username, user.first_name)

    text = (
        f"Йоу, {user.first_name or 'друг'}! 🍬\n\n"
        "Это <b>Candy Clicker</b> — тапай конфету, зарабатывай монеты "
        "и прокачивай апгрейды.\n\n"
        "Жми <b>Играть</b> — откроется мини-приложение.\n"
        "Или купи монеты кнопкой ниже."
    )
    await message.answer(text, reply_markup=main_menu_kb(), parse_mode="HTML")


@router.message(Command("help"))
@router.callback_query(F.data == "help")
async def cmd_help(event: Message | CallbackQuery) -> None:
    text = (
        "🍬 <b>Как играть</b>\n\n"
        "1. Нажми «Играть» — откроется мини-приложение\n"
        "2. Тапай по конфете и получай монеты\n"
        "3. Покупай апгрейды и скины\n"
        "4. Можно купить монеты за € — кнопка «Купить монеты»\n\n"
        "Команды:\n"
        "/start — меню\n"
        "/shop — магазин монет\n"
        "/stats — статистика\n"
        "/help — справка"
    )
    if isinstance(event, CallbackQuery):
        await event.message.edit_text(text, reply_markup=back_kb(), parse_mode="HTML")
        await event.answer()
    else:
        await event.answer(text, reply_markup=back_kb(), parse_mode="HTML")


@router.message(Command("stats"))
@router.callback_query(F.data == "stats")
async def cmd_stats(event: Message | CallbackQuery) -> None:
    user = event.from_user
    await db.apply_passive(user.id)
    u = await db.get_or_create_user(user.id, user.username, user.first_name)

    text = (
        f"📊 <b>Статистика</b>\n\n"
        f"🍬 Монеты: <b>{u['coins']:,.1f}</b>\n"
        f"📈 Всего заработано: <b>{u['total_earned']:,.1f}</b>\n"
        f"⚡ Сила клика: <b>{u['click_power']}</b>\n"
        f"⏱ Пассив: <b>{u['passive_income']:.1f}</b> / сек\n"
        f"🎨 Скин: <b>{u['skin']}</b>"
    )
    if isinstance(event, CallbackQuery):
        await event.message.edit_text(text, reply_markup=back_kb(), parse_mode="HTML")
        await event.answer()
    else:
        await event.answer(text, reply_markup=back_kb(), parse_mode="HTML")


@router.callback_query(F.data == "menu")
async def cb_menu(callback: CallbackQuery) -> None:
    text = (
        "Йоу! 🍬\n\n"
        "Тапай конфету, зарабатывай монеты и прокачивайся.\n"
        "Жми <b>Играть</b> ↓"
    )
    await callback.message.edit_text(text, reply_markup=main_menu_kb(), parse_mode="HTML")
    await callback.answer()


# ── магазин монет ──────────────────────────────────────────────────────────

@router.message(Command("shop"))
@router.callback_query(F.data == "buychips")
async def cmd_shop(event: Message | CallbackQuery) -> None:
    text = (
        "💎 <b>Магазин монет</b>\n\n"
        "Выбери пакет — оплата через Telegram.\n"
        "<i>Сейчас тестовый режим: реальные деньги не списываются.</i>"
    )
    if isinstance(event, CallbackQuery):
        await event.message.edit_text(text, reply_markup=coin_shop_kb(), parse_mode="HTML")
        await event.answer()
    else:
        await event.answer(text, reply_markup=coin_shop_kb(), parse_mode="HTML")


@router.callback_query(F.data.startswith("buy:"))
async def cb_buy_pack(callback: CallbackQuery) -> None:
    payload = callback.data.split(":", 1)[1]
    pack = COIN_PACKS.get(payload)
    if not pack:
        await callback.answer("Пакет не найден", show_alert=True)
        return

    if not settings.payment_provider_token:
        await callback.answer(
            "Оплата не настроена (нет PAYMENT_PROVIDER_TOKEN)",
            show_alert=True,
        )
        return

    await callback.answer()
    await callback.message.answer_invoice(
        title=pack["title"],
        description=pack["description"],
        payload=payload,
        provider_token=settings.payment_provider_token,
        currency="EUR",
        prices=pack_prices(payload),
    )


@router.pre_checkout_query()
async def on_pre_checkout(query: PreCheckoutQuery) -> None:
    # проверка payload
    if query.invoice_payload not in COIN_PACKS:
        await query.answer(ok=False, error_message="Неизвестный товар")
        return
    await query.answer(ok=True)


@router.message(F.successful_payment)
async def on_successful_payment(message: Message) -> None:
    sp = message.successful_payment
    payload = sp.invoice_payload
    pack = COIN_PACKS.get(payload)
    if not pack:
        await message.answer("Оплата прошла, но пакет не распознан. Напиши в поддержку.")
        return

    user = message.from_user
    await db.get_or_create_user(user.id, user.username, user.first_name)
    await db.add_coins(user.id, pack["coins"])
    u = await db.get_user(user.id)

    await message.answer(
        f"✅ Оплата прошла!\n\n"
        f"Начислено: <b>{pack['coins']:,}</b> 🍬\n"
        f"Баланс: <b>{u['coins']:,.0f}</b> 🍬\n\n"
        f"Открой игру — монеты уже на месте.",
        parse_mode="HTML",
        reply_markup=main_menu_kb(),
    )
