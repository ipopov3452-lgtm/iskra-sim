# ИСКРА-ВЭД · Симулятор погрузки

## Публикация на GitHub Pages (бесплатно)

### Шаг 1 — Создай репозиторий на GitHub
1. Зайди на github.com
2. Нажми "New repository"
3. Название: `iskra-sim`
4. Оставь публичным (Public)
5. Нажми "Create repository"

### Шаг 2 — Вставь свой GitHub username в package.json
Открой файл `package.json` и замени строку:
```
"homepage": "."
```
на:
```
"homepage": "https://ТУТ_ТВОЙ_USERNAME.github.io/iskra-sim"
```

### Шаг 3 — Открой терминал в папке проекта и выполни:
```bash
npm install
```

### Шаг 4 — Инициализируй git и залей на GitHub:
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/ТУТ_ТВОЙ_USERNAME/iskra-sim.git
git push -u origin main
```

### Шаг 5 — Задеплой на GitHub Pages:
```bash
npm run deploy
```

### Готово!
Через 1-2 минуты приложение будет доступно по адресу:
`https://ТУТ_ТВОЙ_USERNAME.github.io/iskra-sim`

---

## Запуск локально
```bash
npm install
npm start
```
Откроется в браузере на http://localhost:3000
