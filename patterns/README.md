# Таблиці паттернів

Сід → якість паттерна для конкретної зброї та фінішу. Генерує `pnpm sync-patterns`
із зафіксованих комітів джерел (SHA записаний у кожному файлі). Руками не редагувати.

| Файл | Фініші | Джерело | Що значить число |
| --- | --- | --- | --- |
| `fade.json` | Fade (27 зброї), Amber Fade (6), Acid Fade (1) | [chescos/csgo-fade-percentage-calculator](https://github.com/chescos/csgo-fade-percentage-calculator), MIT | Fade % 80–100, з відкритого алгоритму Valve (сід → поворот паттерна). Ті самі значення показують CSFloat, Skinport, CSGOSKINS.GG |
| `blue.json` | Case Hardened (23 зброї), Heat Treated (2) | [chescos/csgo-blue-gem-calculator](https://github.com/chescos/csgo-blue-gem-calculator), MIT | % синього і золота на тій стороні, яку оцінюють (AK-47 — верх, решта — лицьова сторона), аналіз пікселів |

Перехресна перевірка: сім сідів AK-47, які SteamDB називає Tier 1 (661, 151, 955, 321, 387,
670, 179), і шість Tier 1 Karambit з csdb.gg (387, 442, 269, 853, 776, 73) — усі в тірі
«Blue Gem 90%+». Це закріплено тестами в `test/patterns.test.ts`.

Ножі та рукавички мають сід 0–999: сід 1000 дають лише контракти обміну.

## Чого немає і чому

Marble Fade (Fire & Ice), Crimson Web, Tiger Tooth, Slaughter: відкритих обчислених таблиць
не знайдено, а списки тірів (SteamDB, csdb.gg) розходяться між собою. Для таких скінів
колеса паттерна немає — сід показується лише числом. Неточна таблиця гірша, ніж відсутня.
