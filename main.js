/**
 * Enhanced Combat HUD — RMSS extension
 *
 * Plugs the Rolemaster Standard System (rmss) into Argon Combat HUD. Modeled directly on the
 * enhancedcombathud-rmu reference extension for the sibling Rolemaster Unified system - same
 * hook wiring, same panel-registration shape - but with RMSS's own data reads and, critically,
 * no game.system.api indirection: rmss has no such API surface, so every panel here calls the
 * system's existing service classes/item methods directly (ManeuverService.rollManeuver,
 * weapon.use(), the spell-cast services, RestService) instead of going through a wrapper.
 */

import { UIGuards, defineTooltip, defineSupportedActorTypes, registerIconSettings, migrateIconDefaults } from "./src/RMSSCore.js";
import { defineAttacksMain } from "./src/RMSSFeatures/RMSSAttacks.js";
import { defineSkillsMain } from "./src/RMSSFeatures/RMSSSkills.js";
import { defineSpellsMain } from "./src/RMSSFeatures/RMSSSpells.js";
import { defineFavoritesMain } from "./src/RMSSFeatures/RMSSFavorites.js";
import {
    defineRestMain,
    defineCombatMain,
    definePortraitPanel,
    defineMovementHud,
    defineWeaponSets,
    defineDrawerPanel,
} from "./src/RMSSFeatures/RMSSOther.js";

const VALID_ACTOR_TYPES = new Set(["character", "npc", "creature"]);

/**
 * Initializes the RMSS-specific configuration for the Argon HUD.
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
function initConfig(CoreHUD) {
    if (game.system.id !== "rmss") return;

    defineTooltip(CoreHUD);
    defineSupportedActorTypes(CoreHUD);

    definePortraitPanel(CoreHUD);
    defineMovementHud(CoreHUD);
    defineWeaponSets(CoreHUD);

    defineAttacksMain(CoreHUD);
    defineSpellsMain(CoreHUD);
    defineSkillsMain(CoreHUD);

    defineRestMain(CoreHUD);
    defineCombatMain(CoreHUD);

    // Registered last so they land at the end of the main bar (right-hand side).
    defineFavoritesMain(CoreHUD);

    defineDrawerPanel(CoreHUD);
}

Hooks.once("init", () => {
    console.info("[ECH-RMSS] Initializing RMSS extension");
    registerIconSettings();
});

Hooks.once("setup", () => {
    console.info("[ECH-RMSS] Setting up RMSS extension hooks");
    UIGuards.installGlobalHudInputGuard();
});

Hooks.on("argonInit", (CoreHUD) => initConfig(CoreHUD));

Hooks.once("ready", () => {
    console.info("[ECH-RMSS] RMSS extension is ready");
    migrateIconDefaults();
    const body = document.body;
    if (!body.classList.contains("enhancedcombathud-rmss")) {
        body.classList.add("enhancedcombathud-rmss");
    }

    // Force-unbind the HUD from actor types it doesn't support (e.g. Merchant/Loot), mirroring
    // enhancedcombathud-rmu's own guard - defineSupportedActorTypes alone just refuses to bind
    // and shows a warning; this keeps the HUD from getting stuck open on an unsupported actor.
    if (ui.ARGON?.bind) {
        const originalBind = ui.ARGON.bind;
        ui.ARGON.bind = function (token) {
            if (token?.actor && !VALID_ACTOR_TYPES.has(token.actor.type)) {
                return originalBind.apply(this, [null]);
            }
            return originalBind.apply(this, arguments);
        };
    }
});

Hooks.once("shutdown", () => {
    document.body.classList.remove("enhancedcombathud-rmss");
});

/**
 * updateVisibility() alone doesn't reliably re-show a panel whose get visible() flips true on a
 * turn change (e.g. End Turn) - confirmed by testing: it only reappears after a full
 * deselect/reselect. Force a real rebind of whatever's currently bound instead, which is exactly
 * what that manual reselect does.
 */
function refreshHud() {
    const token = ui.ARGON?._token;
    if (token) ui.ARGON?.bind?.(token);
    else ui.ARGON?.components?.main?.forEach((c) => c.updateVisibility?.());
}

Hooks.on("updateCombat", refreshHud);
Hooks.on("deleteCombat", refreshHud);
