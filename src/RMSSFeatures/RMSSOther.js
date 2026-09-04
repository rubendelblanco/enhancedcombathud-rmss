/**
 * RMSSFeatures/RMSSOther.js
 *
 * Utility panels: Portrait, Movement, WeaponSets (hidden stub - no named-loadout concept in
 * rmss), Rest, Combat (End Turn), and the macro Drawer. Combat and Drawer are 100% generic Argon
 * plumbing per the RMU reference (no system-specific data or API calls) and are ported near
 * verbatim; Portrait/Movement/Rest are rmss's own data/services.
 */

import { ICONS, RMSSUtils, SYS_PATH } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

// -----------------------------------------------------------------------------
// Portrait
// -----------------------------------------------------------------------------

export function definePortraitPanel(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.PORTRAIT?.PortraitPanel || ARGON?.HUD?.PortraitPanel || ARGON?.PortraitPanel;

    if (!Base) {
        console.warn("[ECH-RMSS] PortraitPanel base not found; skipping.");
        return;
    }

    class RMSSPortraitPanel extends Base {
        get description() {
            const a = this.actor;
            if (!a) return "";
            const level = RMSSData.getLevel(a);
            return level === null ? "" : `Lvl ${level}`;
        }

        get isDead() {
            return this.isDying;
        }

        get isDying() {
            const hits = RMSSData.getHits(this.actor);
            return hits.current <= 0;
        }

        async getStatBlocks() {
            const hits = RMSSData.getHits(this.actor);
            const pp = RMSSData.getPowerPoints(this.actor);

            return [
                [
                    { text: `${hits.current}`, color: hits.current <= 0 ? "var(--ech-danger)" : "var(--ech-success)" },
                    { text: "/" },
                    { text: `${hits.max}`, color: "var(--ech-fore)" },
                    { text: "Hits" },
                ],
                [{ text: "PP" }, { text: `${pp.current}/${pp.max}`, color: "var(--ech-movement-baseMovement-background)" }],
            ];
        }
    }
    CoreHUD.definePortraitPanel(RMSSPortraitPanel);
}

// -----------------------------------------------------------------------------
// Movement HUD
// -----------------------------------------------------------------------------

export function defineMovementHud(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.HUD?.MovementHud || ARGON?.MovementHud;

    if (!Base) return;

    // Visual bar disabled: Argon's segmented display showed the wrong number against real rmss
    // data (its exact rendering contract - squares vs feet vs remaining - isn't confirmed), so a
    // blank spacer beats a widget that visibly lies. movementMax is still supplied defensively -
    // some Argon-internal bookkeeping may read it regardless of what _renderInner draws.
    class RMSSMovementHud extends Base {
        get visible() {
            return true;
        }

        get movementMax() {
            const actor = this.actor;
            const m = actor ? RMSSData.getMovementRate(actor) : null;
            return m ? m.effective : 0;
        }

        async _renderInner() {
            if (this.element) this.element.innerHTML = "";
        }

        updateMovement() {}
    }

    CoreHUD.defineMovementHud(RMSSMovementHud);
}

// -----------------------------------------------------------------------------
// Weapon Sets (hidden stub - no named-loadout concept in rmss)
// -----------------------------------------------------------------------------

export function defineWeaponSets(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.WEAPONS?.WeaponSets || ARGON?.WeaponSets || ARGON?.HUD?.WeaponSets;
    if (!Base) {
        console.warn("[ECH-RMSS] WeaponSets base not found; skipping.");
        return;
    }

    class RMSSWeaponSets extends Base {
        get sets() {
            return [];
        }
        _onSetChange(_id) {}
        get visible() {
            return false;
        }
    }
    CoreHUD.defineWeaponSets(RMSSWeaponSets);
}

// -----------------------------------------------------------------------------
// Rest
// -----------------------------------------------------------------------------

export function defineRestMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ActionButton } = ARGON.MAIN.BUTTONS;

    class RMSSRestActionButton extends ActionButton {
        get label() {
            return "REST";
        }
        get icon() {
            return ICONS.rest;
        }
        get visible() {
            return !game.combat?.started;
        }
        get isInteractive() {
            return true;
        }
        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            return { title: "Rest", subtitle: "Recover Hits/PP", details: [{ label: "Info", value: "Choose how many hours to rest." }] };
        }
        async _renderInner() {
            await super._renderInner();
            if (this.element) {
                this.element.style.pointerEvents = "auto";
                this.element.style.cursor = "pointer";
            }
        }
        async _onMouseDown(event) {
            if (event?.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            await this._run();
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
        async _run() {
            const actor = RMSSData.getActiveActor();
            if (!actor) {
                ui.notifications?.error?.("No active token for HUD.");
                return;
            }

            new Dialog({
                title: game.i18n.localize("rmss.long_rest.dialog_title"),
                content: `<form><div class="form-group"><label>${game.i18n.localize("rmss.long_rest.dialog_hours")}</label><input type="number" name="hours" value="6" min="1" step="1" data-dtype="Number"/></div></form>`,
                buttons: {
                    rest: {
                        icon: '<i class="fas fa-bed"></i>',
                        label: game.i18n.localize("rmss.long_rest.confirm"),
                        callback: async (html) => {
                            const hours = Number(html.find('[name="hours"]').val()) || 6;
                            const { default: RestService } = await import(SYS_PATH("module/actors/services/rest_service.js"));
                            await RestService.performLongRest(actor, hours);
                        },
                    },
                },
                default: "rest",
            }, { width: 320 }).render(true);
        }
    }

    class RMSSRestActionPanel extends ActionPanel {
        get label() {
            return "REST";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSRestActionButton()];
        }
    }
    CoreHUD.defineMainPanels([RMSSRestActionPanel]);
}

// -----------------------------------------------------------------------------
// Combat (End Turn) - 100% generic, no rmss-specific data
// -----------------------------------------------------------------------------

export function defineCombatMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ActionButton } = ARGON.MAIN.BUTTONS;

    class RMSSEndTurnActionButton extends ActionButton {
        get label() {
            return "End Turn";
        }
        get icon() {
            return ICONS.combat;
        }
        get isInteractive() {
            return true;
        }
        get hasTooltip() {
            return true;
        }
        get visible() {
            const tokenId = ui.ARGON?._token?.id;
            const c = game.combat;
            if (!c?.started || !tokenId) return false;
            const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
            return activeId === tokenId;
        }

        async _onLeftClick(event) {
            event.preventDefault();
            event.stopPropagation();

            const c = game.combat;
            if (!c?.started) return;

            try {
                if (typeof c.nextTurn === "function") await c.nextTurn();
                else if (typeof c.advanceTurn === "function") await c.advanceTurn();
                else ui.notifications?.error?.("Combat API does not support advancing turns.");
            } catch (e) {
                console.error("[ECH-RMSS] End Turn failed:", e);
            }
        }
    }

    class RMSSCombatActionPanel extends ActionPanel {
        get label() {
            return "COMBAT";
        }
        get visible() {
            const c = game.combat;
            const tokenId = ui.ARGON?._token?.id;
            if (!c?.started || !tokenId) return false;
            const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
            const isActorMatch = c.combatant?.actorId && c.combatant.actorId === ui.ARGON?._token?.actor?.id;
            return activeId === tokenId || isActorMatch;
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSEndTurnActionButton()];
        }
    }
    CoreHUD.defineMainPanels([RMSSCombatActionPanel]);
}

// -----------------------------------------------------------------------------
// Macro Drawer - 100% generic, mirrors the Foundry hotbar
// -----------------------------------------------------------------------------

export function defineDrawerPanel(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const BaseDrawer = ARGON?.DRAWER?.DrawerPanel || ARGON?.HUD?.DrawerPanel || ARGON?.DrawerPanel;
    const BaseDrawerButton = ARGON?.DRAWER?.DrawerButton || ARGON?.HUD?.DrawerButton || ARGON?.DrawerButton;

    if (!BaseDrawer || !BaseDrawerButton) {
        console.warn("[ECH-RMSS] DrawerPanel or DrawerButton base not found; skipping macro drawer.");
        return;
    }

    class RMSSMacroDrawerButton extends BaseDrawerButton {
        constructor(macro) {
            const buttonParts = [
                {
                    label: macro.name,
                    onClick: () => macro.execute(),
                },
            ];
            super(buttonParts);
            this.macro = macro;
        }

        async getData() {
            const data = await super.getData();
            const part = data.buttons[0];
            if (part) part.label = this.macro.name;
            return data;
        }

        setGrid(gridCols) {
            this.element.style.gridTemplateColumns = "1fr";
        }

        setAlign(align) {
            this._textAlign = ["left"];
            this.setTextAlign();
        }
    }

    class RMSSDrawer extends BaseDrawer {
        get title() {
            return "Macros";
        }

        get categories() {
            const hotbarMacros = Object.values(game.user.hotbar)
                .map((id) => game.macros.get(id))
                .filter(Boolean);

            const macroButtons = hotbarMacros.length
                ? hotbarMacros.map((macro) => new RMSSMacroDrawerButton(macro))
                : [new BaseDrawerButton([{ label: "No Macros in Hotbar" }])];

            return [
                {
                    gridCols: "1fr",
                    captions: [{ label: "Hotbar Macros", align: "left" }],
                    align: ["left"],
                    buttons: macroButtons,
                },
            ];
        }
    }

    CoreHUD.defineDrawerPanel(RMSSDrawer);
}
