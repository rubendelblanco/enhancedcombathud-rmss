/**
 * RMSSFeatures/RMSSResistance.js
 *
 * The Resistance Rolls main panel: a flat list of the actor's RR categories (Essence,
 * Channeling, Mentalism, the three hybrids, Arcane, Poison, Disease, Fear). Clicking one calls
 * EffectsPopupService.showResistanceOnlyPopup(actor, key) directly - the exact same actor-only
 * dialog the character sheet's own per-row dice icon opens (no token required), just preselected
 * to the category that was clicked. No RR logic lives in this file.
 *
 * Character sheet only: system.resistance_rolls doesn't exist on npc/creature actors, so
 * RMSSData.getResistanceRolls() returns an empty list for them and the panel hides itself.
 */

import { ICONS, RMSSUtils, UIGuards, SYS_PATH } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

/**
 * Per-realm icons live in the rmss system itself (assets/images/magic_realms), not duplicated
 * into this module - referenced in place via SYS_PATH, same as the service classes this module
 * already imports directly. Poison/disease/fear have no dedicated realm art (they aren't magic
 * realms), so they fall back to the generic resistance/shield icon.
 */
const REALM_ICON = {
    channeling: SYS_PATH("assets/images/magic_realms/channeling.webp"),
    essence: SYS_PATH("assets/images/magic_realms/essence.webp"),
    mentalism: SYS_PATH("assets/images/magic_realms/mentalism.webp"),
    chann_ess: SYS_PATH("assets/images/magic_realms/essence-channeling.webp"),
    chann_ment: SYS_PATH("assets/images/magic_realms/mentalism-channeling.webp"),
    ess_ment: SYS_PATH("assets/images/magic_realms/mentalism-essence.webp"),
    arcane: SYS_PATH("assets/images/magic_realms/arcane.webp"),
};

/**
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
export function defineResistanceMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

    class RMSSResistanceRollButton extends ActionButton {
        /**
         * @param {{key: string, label: string, total: number}} entry
         */
        constructor(entry) {
            super();
            this.entry = entry;
        }

        get isInteractive() {
            return true;
        }

        get label() {
            return this.entry?.label ?? "RR";
        }

        get icon() {
            return REALM_ICON[this.entry?.key] || ICONS[this.entry?.key] || ICONS.resistance;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.element.classList.add("rmss-interactive-button");
            this.element.dataset.tooltipDirection = "UP";
            RMSSUtils.applyValueOverlay(this.element, this.entry?.total ?? "", "Total");
        }

        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            return {
                title: this.label,
                subtitle: "Resistance Roll",
                details: RMSSUtils.formatTooltipDetails([
                    { label: "Total", value: this.entry?.total },
                ]),
                footerText: ["Left-Click: Roll resistance"],
            };
        }

        async _onMouseDown(event) {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();

            const actor = RMSSData.getActiveActor();
            if (!actor || !this.entry) return;

            const { default: EffectsPopupService } = await import(
                SYS_PATH("module/core/rolls/effects_popup_service.js")
            );
            await EffectsPopupService.showResistanceOnlyPopup(actor, this.entry.key);
        }

        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    class RMSSResistanceCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "RESISTANCE";
            this._icon = ICONS.resistance;
        }
        get label() {
            return this.title;
        }
        get icon() {
            return this._icon;
        }
        get hasContents() {
            return true;
        }
        get isInteractive() {
            return true;
        }
        get visible() {
            // ActionPanel.updateVisibility() (Argon core) hides the whole panel only when every
            // one of its buttons reports visible === false - there's exactly one button here
            // (this one), so this is the actual lever for hiding the panel on npc/creature actors.
            return RMSSData.getResistanceRolls(RMSSData.getActiveActor()).length > 0;
        }

        async _getPanel() {
            const actor = RMSSData.getActiveActor();
            const entries = RMSSData.getResistanceRolls(actor);

            const buttons = entries.map((entry) => new RMSSResistanceRollButton(entry));
            const panel = new ButtonPanel({ id: "rmss-resistance", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);
            return panel;
        }
    }

    class RMSSResistanceActionPanel extends ActionPanel {
        get label() {
            return "RESISTANCE";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSResistanceCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMSSResistanceActionPanel]);
}
