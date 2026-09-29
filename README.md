cd /workspaces/hbshuga
git init
git add .
git commit -m "initial invite project"
git branch -M main
git remote add origin https://github.com/hz_shuga/shuga19bd.git
git push -u origin main

## Локальный запуск

Требуется Node.js 18 или новее. Запустите сайт командой:

```sh
npm start
```

Откройте http://localhost:3000. Ответы RSVP сохраняются в `data/rsvps.json`.

Пароль админ-панели по умолчанию — `2023`. Перед публикацией задайте собственный пароль через переменную окружения `ADMIN_PASSWORD`.
