# Simple Scrum
## Product Breakdown Structure + Page Architecture + UI System

### 1. Product vision

یک ابزار مدیریت پروژه‌ی داخلی، سریع و بسیار ساده که به‌جای تقلید از Jira، روی چهار سؤال اصلی تیم تمرکز دارد:

1. چه کارهایی داریم؟ → **Backlog**
2. در Sprint کجای کاریم؟ → **Sprint**
3. امروز هرکس چه کرده و چه می‌کند؟ → **Daily**
4. این Task واقعاً چند Point است؟ → **Planning Poker**

اصل محصول:

> اطلاعات مهم باید بدون جستجو و با یک نگاه دیده شوند.

هدف این نیست که محصول همه‌چیز داشته باشد. هدف این است که چرخه‌ی اصلی Scrum با کمترین اصطکاک انجام شود.

---

# 2. Information Architecture

```text
App
│
├── Auth
│   ├── Login
│   └── Register
│
├── Projects
│   ├── Project List
│   └── Create Project
│
└── Project
    │
    ├── Sprint                ← صفحه‌ی اصلی پروژه
    │
    ├── Backlog
    │
    ├── Daily
    │
    ├── Planning Poker
    │   ├── Sessions
    │   ├── Poker Room
    │   └── Estimate Review
    │
    └── Settings
        ├── General
        ├── Members
        └── GitHub
```

Navigation اصلی پروژه:

```text
[ Project Name ]

● Sprint
☰ Backlog
☀ Daily
♠ Planning Poker

─────────────

⚙ Settings
```

Sprint باید Landing Page پروژه باشد.

---

# 3. Product Breakdown Structure

```text
Simple Scrum
│
├── 1. Identity
│   ├── Authentication
│   ├── User Profile
│   └── Session Management
│
├── 2. Project Management
│   ├── Project Creation
│   ├── Project Members
│   └── Project Settings
│
├── 3. Backlog
│   ├── Task Creation
│   ├── Task Editing
│   ├── Task Prioritization
│   ├── Sprint Assignment
│   └── Point Assignment
│
├── 4. Sprint
│   ├── Sprint Setup
│   ├── Sprint Header
│   ├── Sprint Metrics
│   ├── Progress vs Expected
│   ├── Kanban Board
│   └── Task Detail
│
├── 5. Daily
│   ├── Daily Submission
│   ├── Member Status Matrix
│   ├── Daily Reports
│   └── Sprint Health
│
├── 6. Planning Poker
│   ├── Session Creation
│   ├── Participant Lobby
│   ├── Task Voting
│   ├── Reveal
│   ├── Discussion / Revote
│   ├── Accept Estimate
│   └── Estimate Review
│
├── 7. GitHub Integration
│   ├── PR Attachment
│   ├── PR Metadata
│   └── PR Status
│
└── 8. Shared UI System
    ├── App Shell
    ├── Navigation
    ├── Task Components
    ├── Status Components
    ├── Dialogs
    ├── Drawers
    ├── Toasts
    └── Design Tokens
```

---

# 4. Global App Shell

ساختار Desktop:

```text
┌───────────────────────────────────────────────────────┐
│ Project / Sprint 24              Search     Avatar    │
├──────────────┬────────────────────────────────────────┤
│              │                                        │
│   Sidebar    │            Page Content                │
│              │                                        │
│              │                                        │
└──────────────┴────────────────────────────────────────┘
```

کامپوننت‌ها:

```text
AppShell
├── ProjectSidebar
│   ├── ProjectSwitcher
│   ├── NavigationItem
│   └── UserMenu
│
├── TopBar
│   ├── Breadcrumb
│   ├── QuickCreate
│   └── AvatarMenu
│
└── MainContent
```

---

# 5. Sprint Bar

Sprint Bar یکی از مهم‌ترین کامپوننت‌های کل محصول است.

در بالای صفحات اصلی پروژه دیده شود.

```text
Sprint 24                    Day 6 / 10

████████████████░░░░

38 / 55 pts     Expected 33     +5 ahead
```

کامپوننت:

```text
SprintBar
├── SprintTitle
├── SprintDayCounter
├── SprintProgress
├── ActualPoints
├── ExpectedPoints
└── DeltaBadge
```

Status:

```text
+5 Ahead
0 On track
-7 Behind
```

رنگ‌ها باید فقط نقش semantic داشته باشند.

سبز:
Ahead

زرد:
Slightly behind

قرمز:
Significantly behind

Neutral:
On track

---

# 6. Sprint Page

این صفحه مرکز فرمان پروژه است.

ساختار:

```text
Sprint 24
────────────────────────────────────

38 / 55 pts
Expected: 33
Ahead: +5

[ Sprint progress chart ]

8 Tasks Done
5 In Progress
3 Review
7 Todo

────────────────────────────────────

TODO        IN PROGRESS      REVIEW       DONE
────        ───────────      ──────       ────
Task        Task             Task         Task
Task        Task             Task         Task
Task
```

### Sprint Metrics

```text
SprintMetrics
├── CompletedPoints
├── TotalPoints
├── ExpectedPoints
├── Delta
├── RemainingPoints
└── AddedAfterSprintStart
```

Actual progress فقط بر اساس Done Point محاسبه شود.

Task پنج Point که In Progress است:

```text
Progress contribution = 0
```

نه ۲ یا ۳ Point.

---

# 7. Sprint Progress Chart

دو Line:

```text
Expected
Actual
```

Expected به‌صورت پیش‌فرض بر اساس روزهای Sprint محاسبه شود.

مثلاً:

```text
Sprint = 10 working days
Total = 50 points

Expected end of day 4 = 20 points
```

Actual یک Step Line بر اساس Taskهایی باشد که Done شده‌اند.

نمودار باید بسیار سبک باشد.

بدون:
- glow
- gradient
- complex SVG effects
- animation سنگین

---

# 8. Kanban Board

Workflow اولیه ثابت:

```text
Todo
In Progress
Review
Done
```

Custom workflow فعلاً وجود نداشته باشد.

کامپوننت:

```text
KanbanBoard
├── KanbanColumn
│   ├── ColumnHeader
│   ├── TaskCount
│   └── TaskCard[]
```

Task Card:

```text
┌────────────────────────────┐
│ Implement login flow       │
│                            │
│ ● Reza                 5   │
│                            │
│ PR #182 · Open             │
└────────────────────────────┘
```

TaskCard فقط اطلاعات ضروری:

```text
Title
Assignee
Point
PR status
Optional priority
```

---

# 9. Task Detail

کلیک روی Task صفحه‌ی جدید باز نکند.

یک Side Drawer باز شود.

```text
TaskDrawer
├── TaskTitle
├── Description
├── StatusSelector
├── AssigneeSelector
├── PointSelector
├── SprintSelector
├── PullRequestSection
└── Activity
```

هدف:

Task editing سریع و بدون خروج از context.

---

# 10. Backlog

Backlog بیشتر شبیه Table/List باشد تا Card.

```text
Backlog

+ Add task

─────────────────────────────────────────────
Task                     Point  Owner  Sprint
─────────────────────────────────────────────
Login page                 3     Ali     24
Search API                 5     Reza    24
Offline downloads          8     —       —
Fix empty state            2     Sara    24
```

قابلیت‌ها:

```text
Inline edit
Quick create
Multi-select
Assign to sprint
Change point
Change assignee
Reorder
```

Task creation باید بسیار سریع باشد.

مثلاً:

```text
+ Add task
```

کلیک:

```text
[ Write task title...                     ]
```

Enter:

Task ساخته شود.

---

# 11. Daily

Daily از دو بخش تشکیل شود:

```text
Sprint Health
+
Team Daily
```

بالا:

```text
SPRINT HEALTH

38 / 55 pts

Expected        33
Actual          38
Difference      +5

██████████████████░░░░
```

پایین:

```text
TEAM DAILY

              Sat   Sun   Mon   Tue   Wed
Ali            ✓     ✓     ✓     ✓     ✓
Reza           ✓     ✓     ○     ✓     ○
Sara           ✓     ✓     ✓     ✓     ⏳
Mahdi          ✓     ○     ✓     ✓     ✓
```

Legend:

```text
✓ Submitted
⏳ Pending today
○ Not submitted
```

وضعیت عدم گزارش باید کاملاً واضح باشد ولی UI نباید تحقیرکننده یا aggressive باشد.

هدف:

شفافیت.

نه gamification منفی.

---

# 12. Daily Report

کلیک روی Cell:

```text
Ali
Tuesday

Yesterday
Completed authentication callback.

Today
Implement login validation.

Blockers
Waiting for backend endpoint.

Related tasks
#124 Login flow
#131 Validation
```

فرم ثبت Daily:

```text
DailyForm
├── YesterdayField
├── TodayField
├── BlockersField
├── TaskMention
└── SubmitButton
```

فرم باید در کمتر از یک دقیقه قابل تکمیل باشد.

---

# 13. Planning Poker — Entry

صفحه اصلی:

```text
Planning Poker

[ + Start session ]

Recent sessions
──────────────────────────────
Sprint 24 Planning     Completed
Sprint 23 Planning     Completed
```

شروع Session:

```text
Session name
Sprint
Tasks
Participants

[ Start session ]
```

---

# 14. Poker Lobby

Facilitator:

```text
Sprint 24 Planning

Participants

✓ Ali
✓ Reza
✓ Sara
✓ Mahdi
○ Hassan

5 / 6 joined

[ Start voting ]
```

Participant روی موبایل با URL یا QR وارد شود.

برای MVP می‌توان participant را login-required نگه داشت.

---

# 15. Poker Room

Facilitator view:

```text
Implement offline audio download

4 / 5 voted

Ali      ✓
Reza     ✓
Sara     ✓
Mahdi    ○
Hassan   ✓

[ Reveal votes ]
```

Participant Mobile:

```text
Implement offline audio download


[ 1 ]   [ 2 ]   [ 3 ]

[ 5 ]   [ 8 ]   [ 13 ]

[ 21 ]  [ ? ]   [ ☕ ]
```

Card انتخاب‌شده واضح باشد.

رأی افراد تا Reveal مخفی بماند.

---

# 16. Vote Reveal

```text
Implement offline audio download

Ali       5
Reza      8
Sara      5
Mahdi     13
Hassan    5

────────────────────

Median       5
Average      7.2
Range        8

Lowest       5
Highest      13
```

Extreme votes مشخص شوند.

مثلاً:

```text
5     lowest
13    highest
```

Actions:

```text
Discuss
Revote
Accept estimate
```

Accept:

```text
Set task point

[ 5 ]

[ Save & Next Task ]
```

---

# 17. Planning Poker State Machine

```text
Draft
   ↓
Lobby
   ↓
Voting
   ↓
Reveal
   ├── Revote ──────┐
   │                │
   └── Accept       │
        ↓           │
     Next Task ◄────┘
        ↓
Estimate Review
        ↓
Finalized
```

این State Machine باید در مدل داده و UI واضح باشد.

---

# 18. Estimate Review / Calibration

بعد از تمام شدن رأی‌گیری Taskها، Session هنوز تمام نشده است.

مرحله نهایی:

```text
Estimate Review
```

صفحه:

```text
1 POINT
──────────────────
Fix tooltip


2 POINTS
──────────────────
Empty state
Update icon


3 POINTS
──────────────────
Search filter
Avatar upload      ⚠


5 POINTS
──────────────────
Login flow
Export report      ⚠


8 POINTS
──────────────────
Offline download
Database migration


13 POINTS
──────────────────
Permission system
```

هدف:

بررسی consistency تخمین‌های همان Session.

سؤال ذهنی:

> آیا Taskهای داخل یک Point bucket واقعاً تقریباً هم‌اندازه‌اند؟

---

# 19. Estimate Review Interactions

Taskها قابل Drag بین Point Bucketها باشند.

مثلاً:

```text
Export report

5 → 3
```

Point Task بلافاصله تغییر کند.

اما history تخمین حفظ شود.

Taskهایی با اختلاف رأی بالا:

```text
⚠ High disagreement
```

کلیک:

```text
Votes

3
5
5
8
13

Median: 5
Average: 6.8
```

Actions:

```text
Revote
Move point
Keep estimate
```

آخر صفحه:

```text
[ Finalize estimates ]
```

---

# 20. Reference Tasks

نسخه‌ی اولیه می‌تواند این قابلیت را نداشته باشد.

نسخه‌ی بعد:

هر Point Level چند Task مرجع داشته باشد.

```text
3 points

Reference:
Simple CRUD form
Basic filter
Small API endpoint
```

وقتی Task جدید سه Point می‌گیرد:

```text
Compare with previous 3-point tasks
```

هدف این قابلیت جلوگیری از Drift در Story Pointهای تیم است.

---

# 21. GitHub Pull Request

داخل Task:

```text
Development

PR #182
feat: implement login callback

Open
```

MVP:

کاربر PR URL را Paste می‌کند.

```text
https://github.com/org/repo/pull/182
```

سیستم Metadata را ذخیره/نمایش می‌دهد:

```text
PR number
Title
Repository
State
URL
```

در MVP اتصال GitHub نباید پیچیده شود.

Automationهایی مثل:

```text
PR opened → Review
PR merged → Done
```

برای نسخه بعدی باشند.

---

# 22. Project Settings

```text
Settings
│
├── General
├── Members
└── GitHub
```

General:

```text
Project name
Sprint duration
Working days
Default poker cards
```

Members:

```text
Member
Role
Remove
Invite
```

Roleهای MVP:

```text
Admin
Member
```

بیشتر از این لازم نیست.

---

# 23. Core Data Model

```text
User
├── id
├── name
├── avatar
└── email


Project
├── id
├── name
└── settings


ProjectMember
├── projectId
├── userId
└── role


Sprint
├── id
├── projectId
├── name
├── startDate
├── endDate
└── status


Task
├── id
├── projectId
├── sprintId?
├── title
├── description
├── point?
├── status
├── assigneeId?
└── priority?


DailyReport
├── id
├── sprintId
├── userId
├── date
├── yesterday
├── today
└── blockers


PokerSession
├── id
├── projectId
├── sprintId?
├── status
└── facilitatorId


PokerSessionTask
├── sessionId
├── taskId
├── finalPoint?
└── status


PokerVote
├── sessionTaskId
├── userId
└── value


PullRequest
├── taskId
├── provider
├── repository
├── number
├── title
├── url
└── status
```

---

# 24. Shared Components

```text
UI
│
├── Button
├── IconButton
├── Input
├── Textarea
├── Select
├── Avatar
├── AvatarGroup
├── Badge
├── StatusDot
├── Tabs
├── SegmentedControl
├── Modal
├── Drawer
├── Dropdown
├── Tooltip
├── Toast
├── EmptyState
├── Skeleton
└── ConfirmDialog
```

Domain components:

```text
TaskCard
TaskRow
TaskDrawer
PointBadge
UserBadge
PRBadge

SprintBar
SprintMetric
SprintProgressChart

DailyMatrix
DailyCell
DailyReportCard

PokerCard
PokerDeck
VoteStatus
VoteReveal
VoteStatistics

PointBucket
EstimateReviewCard
```

---

# 25. Visual Direction

ظاهر محصول:

**Modern + playful + clean + lightweight**

نه Enterprise خشک.

نه کودکانه.

نه Dashboard شلوغ SaaS.

شخصیت بصری:

```text
Soft
Friendly
Fast
Clear
Colorful in small doses
Highly readable
```

---

# 26. Design Language

به‌جای Shadow و Gradient:

از این‌ها استفاده شود:

```text
1px borders
surface color differences
soft tinted backgrounds
rounded corners
typography hierarchy
spacing
semantic color
icons
```

Card:

```text
border: 1px solid surface-border
border-radius: 14px
background: surface
```

نه:

```text
box-shadow: ...
filter: blur(...)
backdrop-filter: blur(...)
gradient(...)
```

---

# 27. Shape Language

Radiusها هماهنگ باشند:

```text
Small control      8px
Button/Input      10px
Card              14px
Large panel       18px
Pill              999px
```

ظاهر کلی کمی نرم و ژیگولی باشد ولی نه bubble-heavy.

مثلاً Poker Card می‌تواند Radius بیشتری داشته باشد.

Task Table کمتر.

---

# 28. Color Strategy

یک Accent اصلی.

بقیه رنگ‌ها semantic.

```text
Accent
Neutral
Success
Warning
Danger
Info
```

رنگ نباید همه‌جا استفاده شود.

مثلاً Kanban columnها نباید چهار پس‌زمینه‌ی جیغ مختلف داشته باشند.

بهتر:

```text
Todo          gray dot
In Progress   blue dot
Review        orange dot
Done          green dot
```

Surface همچنان تقریباً neutral بماند.

---

# 29. Point Identity

Story Point می‌تواند یکی از عناصر شخصیت بصری محصول باشد.

مثلاً:

```text
[ 1 ]
[ 2 ]
[ 3 ]
[ 5 ]
[ 8 ]
[ 13 ]
```

هر PointBadge:

```text
rounded
compact
high contrast
monospaced/tabular number
```

Poker Card نسخه بزرگ همین زبان بصری را داشته باشد.

---

# 30. Typography

Hierarchy باید واضح‌تر از Decoration باشد.

مثلاً:

```text
Page title       24–28
Section title    18–20
Body             14–16
Metadata         12–13
Metric           24–32
```

اعداد Sprint و Metrics:

```text
font-variant-numeric: tabular-nums
```

تا تغییر عدد باعث پرش بصری نشود.

---

# 31. Motion

Animation کم ولی دقیق.

مجاز:

```text
opacity
transform
small scale
position transitions
```

مثلاً انتخاب Poker Card:

```text
scale(1.04)
translateY(-2px)
```

مدت:

```text
120–200ms
```

نباید از animationهایی استفاده شود که layout سنگین ایجاد می‌کنند.

---

# 32. Mobile

مهم‌ترین Mobile flow:

```text
Planning Poker
Daily submission
Task viewing
```

Kanban روی Mobile می‌تواند horizontal-scroll داشته باشد و لازم نیست تجربه Desktop کاملاً بازسازی شود.

Poker باید mobile-first باشد.

مثلاً:

```text
┌───────────────────────┐
│ Offline download      │
│                       │
│  1     2      3       │
│                       │
│  5     8      13      │
│                       │
│ 21     ?      ☕      │
└───────────────────────┘
```

Tap target حداقل حدود 44px.

---

# 33. Empty States

Empty stateها بخشی از شخصیت محصول باشند.

مثلاً Backlog خالی:

```text
Nothing in the backlog yet.

Add the first thing your team wants to build.

[ + Add task ]
```

Poker:

```text
No planning session yet.

Grab the team and estimate some work.

[ Start planning ]
```

متن‌ها کوتاه و انسانی باشند.

---

# 34. Performance Rules

UI عمداً سبک طراحی شود.

Avoid:

```text
backdrop-filter
blur
complex gradients
large shadows
animated SVG backgrounds
canvas decoration
heavy chart libraries where unnecessary
```

Prefer:

```text
CSS borders
flat surfaces
SVG icons
CSS transitions
small inline charts
transform/opacity animations
```

---

# 35. MVP Scope

## P0 — Must Have

```text
Authentication

Projects

Tasks

Backlog

Sprint creation

Kanban board

Sprint progress

Expected vs Actual points

Daily reports

Daily matrix

Planning Poker

Vote reveal

Median

Average

Revote

Accept estimate

Estimate Review

GitHub PR URL
```

## P1 — Next

```text
Reference tasks

Sprint projection

GitHub API sync

Task activity history

Poker session history

Notifications

Keyboard shortcuts
```

## P2 — Later

```text
PR automations

Advanced analytics

Sprint retrospectives

Custom workflows

Custom fields
```

---

# 36. Explicit Non-Goals

نسخه اولیه نباید شامل این موارد باشد:

```text
Epic
Subtask
Gantt
Roadmap
Wiki
File manager
Time tracking
Custom workflow
Custom fields
Complex permissions
Dashboard builder
Dependency graph
Advanced notification system
```

اگر یکی از این قابلیت‌ها باعث پیچیده‌شدن Architecture اولیه شود، حذف شود.

---

# 37. Recommended Build Order

```text
Phase 1
Auth
Project
Task
Backlog

Phase 2
Sprint
Kanban
Task Drawer

Phase 3
Sprint Metrics
Expected vs Actual
Sprint Bar

Phase 4
Daily
Daily Matrix

Phase 5
Planning Poker
Voting
Reveal

Phase 6
Estimate Review
Calibration

Phase 7
GitHub PR

Phase 8
Polish
Responsive
Empty states
Keyboard UX
```

---

# 38. Product Rule of Thumb

برای تصمیمات طراحی آینده، این قانون ملاک باشد:

> اگر قابلیتی برای فهمیدن «الآن تیم کجاست؟» یا انجام یکی از Ritualهای اصلی Scrum لازم نیست، احتمالاً هنوز نباید وارد محصول شود.

و برای UI:

> اطلاعات مهم باید برجسته باشند؛ خود Interface نباید برای جلب توجه با اطلاعات رقابت کند.

---

# 39. Core Product Experience

در نهایت کاربر باید بتواند این چرخه را با کمترین اصطکاک طی کند:

```text
Backlog
   ↓
Planning Poker
   ↓
Estimate Review
   ↓
Sprint
   ↓
Daily
   ↓
Done
```

این Loop هسته‌ی کل محصول است.

هر قابلیت جدید باید بتواند جای خودش را در این Loop توجیه کند.