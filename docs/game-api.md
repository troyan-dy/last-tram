# Первое утро: интерфейсы игры

`index.html` открывается локально. В браузере скрипты добавляют функции в `globalThis.LastTram`; в Node модель доступна через `require('./game/city.js')`, `require('./game/simulation.js')` и `require('./game/movement.js')`. Каждая партия независима. Карта не владеет ни часами, ни движением.

```js
const { createCity } = require('./game/city.js');
const { startGame, advance, clockMinute } = require('./game/simulation.js');
const game = startGame(createCity('Клён'));
advance(game, 240); // те же 240 одиночных тактов, что на карте
console.log(clockMinute(game), game.residents[0].currentBuildingId);
```

## География

- `createCity(seed)` → `{seed, districts, buildings, stops, edges, starterStops}`. Сид — строка; пустое значение даёт новый сид, который можно ввести снова. Массивы уже содержат **весь** город. Это справочники; не изменяйте их при открытии территории.
- Координаты `{x,y}` в единицах улицы; `x` растёт на восток, `y` — на юг. Здание: `{id, districtId, stopId, kind: 'home'|'work', name, ring, x, y, width, depth, floors, tint, entrance: {x,y}}`. `entrance` находится на фасаде. Район: `{id, ring, name}`. Остановка: `{id, districtId, name, ring, x, y, sidewalk}`; платформа `sidewalk` и ось пути `(x,y)` различны.
- `edges` — кандидаты `{id,a,b}` между соседними остановками `a,b`. Участки неориентированные, их идентификаторы лучше брать из справочника. `starterStops` — три последовательные остановки линии. Начальная зона — `ring === 0`, первое расширение — 1.

## Состояние и часы

- `startGame(city, systems = {})` создаёт `{city, lookup, openRing, tick, residents, trains, routes, trackIds, fare, cash, systems}`. `lookup.buildings/stops/edges` — `Map<id, объект справочника>`. Построенные рельсы — `Set` идентификаторов `trackIds`. Маршруты `{id,name,stopIds: string[]}`, поезда `{id,routeId,cars,position,atStopId,...}` — отдельные сущности. У начального поезда `atStopId` не `null` только во время стоянки. `index`, `direction`, `dwell` — состояние начального челнока.
- `tick` — абсолютное целое число от 0. `advance(game, ticks=1)` изменяет этот же объект и возвращает его. За такт: `++tick` → `systems.service(game)` → `systems.demand(game)` → продвижение каждого жителя. `clockMinute(game)` — абсолютные городские минуты, включая начальное 07:30 (не по модулю суток). `BALANCE` в `movement.js` содержит скорости, длительность стоянки, утренний разброс и денежные коэффициенты.
- Жители создаются сразу, в том числе жители закрытых районов. У каждого постоянны `id`, `homeId`, `workId`; возможны одинаковые имена. `currentBuildingId` указывает на фактическое здание **только внутри**, в пути — `null`. `position` — положение на карте. `onTrainId` — фактический поезд в салоне либо `null`.

## Спрос и обслуживание: точки подключения этапов 2–3

1. **Расписание спроса.** По умолчанию `game/demand.js` каждый день отправляет жителей на работу с 07:30, часть — с дневным визитом с 12:00, домой — с 17:30. С 21:30 поездки завершаются, новых отправлений нет. Каждое отправление вызывает `depart(game, resident, destinationId)` из `simulation.js`: он заново выбирает путь от фактического здания и возвращает `false`, если житель уже в пути, цель совпадает с источником или ещё закрыта. Занятый житель сохраняет своё перемещение; после прибытия может начать актуальное для данного периода, без очереди пропущенных дел. При увеличении `game.openRing` новые жители включаются со следующего такта, не меняя идентификатор и положение. Спрос можно заменить через `startGame(city, { demand })`. Для панелей `cityTime(game)` из `demand.js` возвращает `{day, period, next, nextTick}`: день от 1; периоды содержат `id`, `name`, `minute` (начало по местным часам); `nextTick` — абсолютный такт начала следующего периода. Кнопка часов доводит партию до него обычными тактами.
2. **Сеть.** Изменяйте `game.trackIds/routes/trains/fare/cash` командами, адресующими существующие ID. Начальный челнок в `starter-line.js` предоставляет заменяемые `openLine(game)` (вызывается один раз), `service(game)` (один такт), `planJourney(game, resident, fromBuilding, toBuilding)` и `stepTransit(game, resident, journey, leg)`. Передавайте одноимённые ключи в `systems` или устанавливайте их на игре. Для пустой сети при старте достаточно `openLine() {}`. Стартовая политика сравнивает ходьбу и прямой маршрут между ближайшими остановками; многомаршрутный поиск и изменение состава сети — этап 2.
3. **Перемещение.** Планировщик возвращает `{ mode:'walk'|'tram', legs:[...] }`. `depart` добавляет `originId`, `destinationId`, `startedAt`, `leg` (индекс с нуля). `mode` относится к пути целиком. `walkLeg(points)` создаёт пеший этап; `doorPath(building, stop)` строит вход → тротуар у остановки, `walkingPath(game, from, to)` — пеший путь целиком, `planWalk` — готовая альтернатива. Последний пеший этап **должен** окончиться в `destination.entrance`. Для остальных этапов диспетчер вызывает `stepTransit`; он возвращает `true` только при завершении этапа. Стартовые типы: `wait` и `ride`. Списание/доход от билета учитывает обработчик посадки в `game.cash`, не обработчик прибытия.
4. **Прибытия.** Только после последнего этапа симуляция устанавливает `currentBuildingId`, снимает `journey` и сохраняет `lastJourney: {originId, destinationId, mode, startedAt, arrivedAt}`. Затем вызывает необязательный `onArrival(game, resident, lastJourney)`. Для истории записывайте этот факт; `lastJourney` — только последняя запись. Высадка не означает прибытие.

## Карта и панели

`createMap(svg, onSelect)` → `{render(game,focus), fit(), zoomBy(factor)}`. `focus` — `null` или `{type:'resident'|'building'|'stop'|'train', id}`. Узлы объектов имеют `data-type`, `data-id`; цель клика определяется самим SVG под текущей камерой. `art.project(x,y,z=0)` — единая проекция. Статика пересчитывается при замене партии, границы, путей или последовательности остановок. `LastTram.ui.game` и `.focus` — геттеры **текущих** объектов; `ui.select(type,id)` устанавливает фокус, `ui.render()` синхронизирует панели после команды (в том числе на паузе). Не сохраняйте `ui.game` между новыми партиями. Новые команды меняют модель, а не DOM.
