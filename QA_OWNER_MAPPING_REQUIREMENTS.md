# Forum Daily — Owner Mapping & QA Data Requirements

Prerequisites for running the **Full Company Forum Flow** QA (מ״כ → מ״מ → מ״פ ריכוז → הפצה).

## TL;DR

The "נדרש שיוך משתמש" blocker on most slots is a **data gap, not a code bug**. The
structured slots and the `aggregateCompanyStructured()` roll-up map platoon reports
to platoons by matching a real user. Right now only one מ״מ user (מחלקה 1) exists,
so only that slot maps. To run the full flow you must create QA users — **no SQL,
no RLS changes, no fake/unassigned owners.**

## How mapping works (verified in code)

- `loadOwnerOptions()` loads every user with `status = 'active'` **and**
  `role_approval_status = 'approved'` (plus their unit name). This is the dropdown
  and the mapping source.
- `findPlatoonSummaryOwner(owners, 'מחלקה N')` matches a user whose normalized
  `name + role + unit` contains **both** `מ"מ N` **and** `מחלקה N`
  (gershayim-normalized via `normalizeRole`).
- `aggregateCompanyStructured()` assigns a platoon report to platoon N when its
  `owner_user_id` is that mapped מ״מ, **or** as a fallback when its
  `metadata.node_label` contains `מחלקה N`. Unmatched platoon reports are preserved
  under "מחלקה לא מזוהה" (never dropped).

So a slot maps **only** when an active+approved user exists with the matching role
and unit. Today only מ״מ 1 / מחלקה 1 exists → only that slot maps; the dropdown also
shows the two מ״פ users. Everything else shows "נדרש שיוך משתמש".

## Why it cannot be faked safely

- A platoon report needs a real distinct `owner_user_id`. The table has
  `unique(report_date, report_level, owner_user_id)`, so the commander can own **one**
  platoon report per date — you cannot create platoons 2–4 under the מ״פ's own id.
- Creating reports without a valid owner, or bypassing RLS, is out of scope and risky.

## Required QA users (create via app registration + Admin approval)

Each must end up `status = active`, `role_approval_status = approved`, with the
exact role/unit naming below (so `מ"מ N` + `מחלקה N` both match):

| Purpose | role | unit |
|---|---|---|
| מ״מ מחלקה 1 (exists) | `מ"מ 1` | `מחלקה 1` |
| מ״מ מחלקה 2 | `מ"מ 2` | `מחלקה 2` |
| מ״מ מחלקה 3 | `מ"מ 3` | `מחלקה 3` |
| מ״מ מחלקה 4 | `מ"מ 4` | `מחלקה 4` |
| (optional) מ״כים | `מ"כ` | מחלקה N |
| (optional) staff | `חופ"ל` / `רס"פ` / `סמ"פ` / `ע. מ"פ` | — |

Gershayim (`"`) vs (`״`) is normalized, so either form is fine.

## Minimum to demonstrate aggregation without 4 users

The commander can already create-for-subordinate for **any** existing approved user
via "צור דוח עבור משתמש". With at least 2–3 distinct מ״מ users you can show:
present/total summed across platoons, per-platoon text roll-up, `[לא הוגש דוח]` for a
missing platoon, and `[בטיפול — טרם הוגש סופית]` for an in-progress one.

## Recommendation

Prepare the QA users above (app-level, no SQL) before the next Full Flow QA. The
matching/aggregation code is correct and does not need changes for this.
