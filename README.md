# 🍬 Candy Clicker

Telegram-бот-кликер с Mini App.

## Деплой на Render

1. Render → **New +** → **Web Service** → этот репозиторий
2. Build: `pip install -r requirements.txt`
3. Start: `python main.py`
4. Environment:
   - `BOT_TOKEN` = токен от @BotFather
   - `WEBAPP_URL` = URL сервиса после деплоя (`https://....onrender.com`)
5. В BotFather → Menu Button → тот же URL

## Важно

Файлы лежат **плоско** + папка `static/` (игра).
Не удаляй папку `static`.
