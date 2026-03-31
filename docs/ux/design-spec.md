# UX Design Specification — ResilienceOS
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Status:** DRAFT  

---

## 1. Design Philosophy

### 1.1 Core Principle: Operational Clarity Under Stress
ResilienceOS is used during high-stakes, time-critical events. Users are running disaster recovery exercises and real incidents — they are stressed, tired, and often operating on a phone bridge with dozens of people. The interface must:

- **Eliminate cognitive load.** Every important action must be findable in under 2 taps.
- **Communicate status instantly.** Someone should be able to glance at the screen and understand the exercise state in 3 seconds.
- **Never hide urgency.** Critical items (blocked tasks, overdue stages, failed Go/No-Go) must be visually impossible to miss.
- **Forgive mistakes.** Every destructive action requires confirmation. Nothing is permanently deleted without an explicit second confirmation.

### 1.2 Aesthetic: Professional Skeuomorphic / Operational Tool
The design language evokes purpose-built operational tools — aviation checklists, mission control dashboards, military operations centers — rather than generic SaaS dashboards.

Key characteristics:
- **Tactile depth:** Buttons and cards have visible depth with inset shadows. Interactive elements respond with satisfying visual feedback (subtle press animation).
- **High information density:** Unlike many consumer apps, users need to see many tasks at once. Dense but scannable.
- **Dark mode primary:** Operators often run exercises in the early morning (6AM start times per the Excel data). A dark/slate color scheme reduces eye strain.
- **Analog metaphors:** Task status uses badge/chip indicators that feel like physical status labels (green stamp = complete, amber stamp = in progress).

---

## 2. Color System

### 2.1 Brand Colors (Light Mode)
```
Primary:       #1E40AF  (deep blue)
Primary Light: #3B82F6  (mid blue — interactive states)
Primary Dark:  #1E3A8A  (deep navy — headers)
Accent:        #7C3AED  (purple — rollback / special states)
```

### 2.2 Brand Colors (Dark Mode — Default)
```
Background:    #0F172A  (slate-950 — page background)
Surface:       #1E293B  (slate-800 — cards, panels)
Surface High:  #334155  (slate-700 — elevated cards, modals)
Border:        #475569  (slate-600)
Text Primary:  #F1F5F9  (slate-100)
Text Secondary:#94A3B8  (slate-400)
```

### 2.3 Status Color System (WCAG AA Compliant)
```
Not Started:   #6B7280  (neutral grey)    background: #F3F4F6 / #1F2937
In Progress:   #D97706  (amber-600)       background: #FEF3C7 / #292524
Completed:     #059669  (emerald-600)     background: #D1FAE5 / #022C22
Failed:        #DC2626  (red-600)         background: #FEE2E2 / #2D1515
Delayed:       #EA580C  (orange-600)      background: #FFEDD5 / #2C1505
Optional:      #2563EB  (blue-600)        background: #DBEAFE / #172554
Cancelled:     #9CA3AF  (grey-400)        background: #F9FAFB / #111827
Blocked:       #7C3AED  (violet-600)      background: #EDE9FE / #1D1130
```

### 2.4 Severity Colors (Incidents/Risks)
```
P1 Critical:   #DC2626  (red)
P2 High:       #EA580C  (orange)
P3 Medium:     #D97706  (amber)
P4 Low:        #059669  (green)
```

---

## 3. Typography

```
Font Family:   'Inter', system-ui, -apple-system, sans-serif
Code/Mono:     'JetBrains Mono', 'Fira Code', monospace  (for task IDs, commands)

Scale:
  xs:    12px / 1.5  — metadata, timestamps, badges
  sm:    14px / 1.5  — body secondary, table cells
  base:  16px / 1.6  — body primary, form labels
  lg:    18px / 1.4  — section headers
  xl:    20px / 1.4  — page subheadings
  2xl:   24px / 1.3  — page headings
  3xl:   30px / 1.2  — exercise name/hero text
  
Weights:
  Regular: 400  — body text
  Medium:  500  — labels, secondary headers
  SemiBold: 600 — primary actions, status text
  Bold:    700  — headings, critical callouts
```

---

## 4. Component Specifications

### 4.1 Task Row Component
The primary UI element. Used in the Exercise Task Board.

**Layout (desktop):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [ID] [STATUS BADGE] [TASK NAME                              ] [TEAM] [TIME] │
│      [RESOURCE(S)]                                            [▼ EXPAND]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**States:**
- **Default (Not Started):** Neutral, clickable. ID shown in monospace.
- **Locked (Predecessor Not Met):** Slightly dimmed, lock icon overlay on status badge. Edit buttons disabled.
- **In Progress:** Amber left border accent (4px). Timer ticking.
- **Completed:** Green checkmark. Row fades to 60% opacity (de-emphasized). Still expandable.
- **Failed:** Red left border. Alert icon. Rolls up a "Trigger Rollback?" prompt if it's a gate task.
- **Optional:** Blue dashed border. "OPTIONAL" chip label visible.
- **Locked (Rollback Stage):** Orange warning icon, "Activate Rollback to unlock" tooltip.

**Expanded state (on tap/click):**
- Shows full task description/instructions
- Start time / End time datetime pickers
- Estimated Duration label
- Actual Duration (auto-calculated, displayed in minutes or HH:MM)
- Variance (+/- minutes, colored: green = ahead, red = behind)
- Notes text area (autosave)
- Evidence gallery (thumbnails + upload button)
- Predecessor list (chip per predecessor, green = complete, grey = pending)

### 4.2 Stage Header Component
Groups tasks visually. Collapses/expands.

```
┌──────────────────────────────────────────────────────────────────┐
│ ▼  PRE-VALIDATIONS          [5/8 tasks] ████████░░  63%   [12:45]│
└──────────────────────────────────────────────────────────────────┘
```

Fields shown:
- Stage name (caps, bold)
- Task completion fraction + progress bar
- Estimated stage duration (or elapsed time when active)
- Collapse/expand toggle

Rollback stage locked state:
```
┌──────────────────────────────────────────────────────────────────┐
│ 🔒  FAILOVER-ROLLBACK       [LOCKED — requires failure trigger]  │
│                             [Activate Rollback]  (Moderator only) │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Exercise Header Bar
Persistent at top of Exercise Task Board:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ResilienceOS         S4P/CFIN DR — Production      ●LIVE  07:43 elapsed     │
│                      Failover (Primary→Secondary)   Mock 3 of 3   Phase: GA │
│ [⚡ Go/No-Go Pending]  [📢 Broadcast]  [📊 Reports]  [⚙ Settings]           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Status Badge
```
Design: Rounded pill, colored background, icon + text
Size: sm (task list) | md (detail views) | lg (exercise header)

Examples:
  ● In Progress    (amber bg, pulsing dot)
  ✓ Completed      (green bg, check icon)
  ✗ Failed         (red bg, X icon)
  ⏸ On Hold        (grey bg, pause icon)
  🔒 Blocked       (violet bg, lock icon)
```

### 4.5 Go/No-Go Decision Modal
Full-screen modal overlay. Prevents any other interaction until resolved.

```
┌─────────────────────────────────────────────────────────┐
│                    🚦 GO / NO-GO DECISION                │
│                                                         │
│  Task #67 — Go/No-Go: Pre-Failover Validation Complete  │
│                                                         │
│  All pre-validation tasks: ✓ COMPLETE                   │
│  Rollback tasks: Not activated                          │
│                                                         │
│  Approver(s): Armelle Fery, Jake Rog                    │
│                                                         │
│  Justification (required for NO-GO):                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [  ✗ NO-GO — Abort  ]        [  ✓ GO — Proceed  ]      │
└─────────────────────────────────────────────────────────┘
```

### 4.6 Resource Check-In Screen (Tokenized — No Login)
Mobile-optimized, single purpose:

```
┌────────────────────────────────────┐
│  🛡️ ResilienceOS                  │
│                                    │
│  Hi, James Barrett                 │
│                                    │
│  Please confirm your availability  │
│  for the DR Exercise:              │
│                                    │
│  SAP S4P CFIN — Mock 3             │
│  📅 Apr 15, 2026  06:00–14:00 EST  │
│                                    │
│  [ ✓ I'll be available ]           │
│                                    │
│  [ ✗ I'm unavailable  ]           │
│                                    │
│  Notes (optional):                 │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
│         [ Submit ]                 │
└────────────────────────────────────┘
```

---

## 5. Navigation Structure

### 5.1 Primary Navigation (Sidebar — Desktop)
```
ResilienceOS [logo]
─────────────────
🏠 Dashboard
📋 Exercises
   ├─ Active
   ├─ Upcoming
   └─ Completed
👥 Resources
🏢 Teams
🤝 Vendors
📧 Email
   ├─ Lists
   ├─ Templates
   └─ Schedules
📊 Reports
─────────────────
⚙ Settings
❓ Help
─────────────────
[Avatar] Jake Rog  ▾
```

### 5.2 Bottom Navigation (Mobile)
```
[ 🏠 Home ]  [ 📋 Tasks ]  [ 📊 Reports ]  [ ⚙ More ]
```

### 5.3 Exercise Context Navigation
When inside an active exercise, a secondary nav appears:
```
[ Overview ] [ Failover ] [ Failback ] [ Reports ] [ Resources ]
```

---

## 6. Key Interaction Patterns

### 6.1 Task Status Update (Mobile — < 2 taps)
1. Tap task row → row expands
2. Tap status badge → inline status picker appears (segmented control)
3. Tap new status → optimistic update → confirmed via WebSocket echo

### 6.2 Evidence Upload (Mobile — Camera Capture)
1. Expand task row
2. Tap camera icon in evidence section
3. iOS/Android native camera opens
4. Take photo → confirm
5. Upload with progress ring → thumbnail appears in evidence gallery

### 6.3 Time Recording
When status changes to `In Progress`:
- **Auto-clock option (configurable):** System records current timestamp as Start Time automatically
- **Manual option:** User can tap the start time field and set it explicitly

### 6.4 Broadcast Message (Moderator)
1. Tap 📢 Broadcast button in exercise header
2. Type message (max 500 chars)
3. Tap Send
4. All connected participants receive a notification banner that stays visible for 30 seconds

---

## 7. Accessibility Requirements
- WCAG 2.1 Level AA minimum
- All color-conveyed information also conveyed by icon or text (color blindness safe)
- All interactive elements accessible via keyboard (Tab, Enter, Space, Arrow keys)
- Focus indicators clearly visible (3px solid ring, minimum 3:1 contrast)
- Screen reader: all images have alt text; all status badges have aria-label
- Text zoom: interface functional at 200% text zoom
- Minimum touch target: 44×44pt on mobile

---

## 8. PWA Requirements

### Installation
- Web app manifest with all required icon sizes (72, 96, 128, 144, 152, 192, 384, 512px)
- Splash screens for iOS (all device sizes)
- `display: standalone` mode
- `theme-color` matches primary brand color

### Offline Behavior
- Service worker caches:
  - App shell (HTML, JS, CSS) — cache-first
  - User's assigned tasks for active exercise — stale-while-revalidate
  - Evidence thumbnails — cache-first (20 most recent)
- Offline indicator: orange banner "You're offline — viewing cached data"
- Queue offline actions (status updates, notes): sync on reconnect with user confirmation if conflicts detected

### Performance Targets
- First Contentful Paint: < 1.5s on 4G
- Time to Interactive: < 3.0s on 4G
- Lighthouse PWA score: ≥ 90
- Lighthouse Performance score: ≥ 85
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
