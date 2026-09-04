# Argon - Combat HUD (RMSS)

Plugs the `rmss` (Rolemaster Standard System) Foundry system into [Argon Combat HUD](https://github.com/theripper93/enhancedcombathud). Requires the core `enhancedcombathud` module (v5.0.0+, Foundry v14) to be installed and active.

## Panels

- **Attacks** — Melee / Ranged / Natural categories, built from the actor's currently equipped weapons and creature attacks. Clicking a weapon calls `item.use()` — the same attack pipeline (equip check, GM confirmation, ammo, fumble/critical resolution) the actor sheet already uses.
- **Skills** — accordion by skill category. Clicking a skill calls `ManeuverService.rollManeuver()` — opens the same maneuver-options dialog the sheet uses.
- **Spells** — accordion by spell list. Clicking a spell dispatches to the matching cast service (Instant / BaseElemental / DirectedElemental / Force) exactly like the sheet's own spell-cast button.
- **Rest** — opens the same hours dialog as the sheet's Long Rest button and calls `RestService.performLongRest()`.
- **Combat** — End Turn, using Foundry's native `Combat#nextTurn()`.
- **Drawer** — hotbar macros.
- **Portrait / Movement** — Hits, Power Points, level, and (character actors only, since npc/creature have no `movement_rate`) a real movement-rate widget.

Not included: a Resistance Rolls panel (rmss has no "roll my own RR" concept — RR only ever fires against whoever a caster targets) and a Special Checks panel (no rmss equivalent — the Skills panel already covers any skill, including physical/mental resistance-flavored ones).

## Icons

Placeholder line-art SVGs ship in `icons/` — reassign any of them per-world via **Configure Settings → Argon - Combat HUD (RMSS)**, or map specific spell/skill names to their own icon via the module's "Configure Icons" settings menu.
