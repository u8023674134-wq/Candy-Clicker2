from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message

from database import db
from keyboards import back_kb, main_menu_kb

router = Router(name="start")


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user = message.from_user
    await db.get_or_create_user(user.id, user.username, user.first_name)

    text = (
        f"Йоу, {user.first_name or 'друг'}! 🍬\n\n"
        "Это <b>Candy Clicker</b> — тапай конфету, зарабатывай монеты "
        "и прокачивай апгрейды.\n\n"
        "Жми <b>Играть</b> — откроется мини-приложение."
    )
    await message.answer(text, reply_markup=main_menu_kb(), parse_mode="HTML")


@router.message(Command("help"))
@router.callback_query(F.data == "help")
async def cmd_help(event: Message | CallbackQuery) -> None:
    text = (
        "🍬 <b>Как играть</b>\n\n"
        "1. Нажми «Играть» — откроется мини-приложение\n"
        "2. Тапай по конфете и получай монеты\n"
        "3. Покупай апгрейды:\n"
        "   • сила клика\n"
        "   • автокликер (монеты в секунду)\n"
        "   • скины\n\n"
        "Монеты сохраняются даже когда ты оффлайн "
        "(пассивный доход — до 8 часов).\n\n"
        "Команды:\n"
        "/start — меню\n"
        "/stats — статистика\n"
        "/help — эта справка"
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
        f"Йоу! 🍬\n\n"
        "Тапай конфету, зарабатывай монеты и прокачивайся.\n"
        "Жми <b>Играть</b> ↓"
    )
    await callback.message.edit_text(text, reply_markup=main_menu_kb(), parse_mode="HTML")
    await callback.answer()
