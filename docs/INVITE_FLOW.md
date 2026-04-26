# Invite Flow — GolfWizard

> **Maintainer note:** Update this doc whenever invite logic changes in `preset.js`, `PlayersView.vue`, or `InviteWelcome.vue`.

---

## Two entry points

| Scenario | Trigger | Player has email in roster? |
|---|---|---|
| **Individual invite** | Tap 📨 next to a player in PlayersView | Required |
| **Group invite** | Tap 📨 in header → copies/shares link | N/A (no player context) |

---

## Individual invite flow (e.g. Shang Chen)

```
PlayersView
  └─ invitePlayer(player)
       └─ buildInviteEmail(player)           ← preset.js
            └─ buildInviteUrl(email, ghin, name, rid)
                 → #/invite?preset=bb
                           &email=shang@...
                           &ghin=1234567
                           &name=Shang+Chen
                           &rid=<roster_players.id>
            └─ mailto: opens in Mail.app
```

### URL params

| Param | Source | Used for |
|---|---|---|
| `preset` | hardcoded `bb` | `applyPreset()` — seeds BB roster + course into localStorage |
| `email` | `player.email` | Pre-fills AuthModal, signs them into correct account |
| `ghin` | `player.ghin_number` | Pre-fills GHIN setup step |
| `name` | `player.name` | Pre-fills `display_name` if profile has no full name yet |
| `rid` | `player.id` (roster_players PK) | Direct `profile_id` bind on auth — no fuzzy matching needed |

**Params are ephemeral.** Once signed in, the app navigates to `/#/`. The long URL is never saved to home screen.

---

## InviteWelcome.vue sequence

```
onMounted
  ├─ pre-fill ghinNum from ?ghin=
  ├─ applyPreset(false)   → seeds localStorage
  ├─ seeding spinner → welcome card
  └─ if ?email= and not authed → open AuthModal (prefilled)
       └─ onAuthClose()
            ├─ if ?rid=  → UPDATE roster_players SET profile_id = auth.user.id WHERE id = rid AND profile_id IS NULL
            ├─ if ?name= and display_name has no space → updateProfile({ display_name: name })
            ├─ if email mismatch → show yellow warning banner (non-blocking)
            └─ if no ghin_number on profile → open GHIN setup sheet
                 └─ syncGhin()
                      ├─ profiles.update({ ghin_number, ghin_password })
                      ├─ invoke ghin-sync edge function
                      ├─ updateProfile({ ghin_index })
                      └─ roster_players.update({ ghin_number, ghin_index }) WHERE email = user.email
```

After GHIN step (or skip): "Go to GolfWizard →" → `router.push('/')`

---

## Field handling: lock vs. warn vs. free

| Field | Behavior | Reason |
|---|---|---|
| Email | **Warn** if signed-in email ≠ invite email (yellow banner) | Wrong account = broken round history backfill |
| GHIN # | Pre-filled, editable. No warning on change. | User may have a different/updated number |
| Name | Pre-fills display_name only if no full name set yet | Don't clobber a name they already set |
| Roster row | Bound directly via `rid` — not overwriteable | Prevents duplicate/orphan rows |

---

## Existing roster player vs. new user

| | Existing roster player (has `rid`) | New user (no roster row) |
|---|---|---|
| Preset seeding | Same — BB group loaded | Same |
| Auth | Email pre-filled | Blank email field |
| Profile bind | `roster_players.profile_id` set via `rid` | `backfillRoundMembership()` in auth.js tries email/GHIN match on login |
| GHIN pre-fill | Yes (from `?ghin=`) | No |
| Name pre-fill | Yes (from `?name=`) | No |
| Round history | Backfilled on login via `backfillRoundMembership()` | Same |

---

## Known gaps / future work

- **No email = no 📨 button.** Roster players without an email address cannot be individually invited. Consider adding an email field prompt in the player edit modal.
- **GHIN credentials in invite URL:** we pass `ghin_number` but not `ghin_password` — user must enter password manually in GHIN setup step. This is intentional (security).
- **Group invite** (`shareGroupInvite`) passes no player context — Shang would land with no email/GHIN pre-fill. Use individual invite for best experience.
- **PWA icon:** Safari shows screenshot instead of golf ball icon after "Add to Home Screen" — needs fresh add after clearing Safari cache (known issue, in backlog).

---

## Files

| File | Role |
|---|---|
| `src/modules/preset.js` | `buildInviteUrl()`, `buildInviteEmail()`, `PRESET_PLAYERS`, `applyPreset()` |
| `src/views/PlayersView.vue` | `invitePlayer()`, `shareGroupInvite()` |
| `src/views/InviteWelcome.vue` | Landing page — seeds, auths, binds profile, GHIN setup |
| `src/stores/auth.js` | `backfillRoundMembership()` — fallback profile_id bind on every login |
| `src/stores/roster.js` | `backfill_roster_ghin_for_user` RPC called after seed |
