# Трекер: GitHub Issues

Публикуй задачи и спецификации в [Issues проекта](https://github.com/troyan-dy/last-tram/issues) через `gh`. Перед первой записью проверь, что `gh repo view --json nameWithOwner` возвращает `troyan-dy/last-tram`. В другом рабочем каталоге укажи `--repo troyan-dy/last-tram` явно.

| Действие | Команда |
| --- | --- |
| Найти открытые задачи с меткой | `gh issue list --state open --label <метка>` |
| Прочитать задачу и обсуждение | `gh issue view <номер> --json number,title,body,labels,comments` |
| Создать задачу | `gh issue create --title "..." --body-file <файл>` |
| Изменить метку | `gh issue edit <номер> --add-label <метка>` или `--remove-label <метка>` |
| Объяснить результат и закрыть задачу | `gh issue comment <номер> --body "..."`, затем `gh issue close <номер>` |

Части одной спецификации связывай как подзадачи GitHub. Зависимость «нельзя начать, пока не закончена другая задача» отмечай как *blocked by*. Если такая связь недоступна, укажи `Part of #<номер>` или `Blocked by: #<номер>` в начале описания.

**PRs as a request surface: no.**
