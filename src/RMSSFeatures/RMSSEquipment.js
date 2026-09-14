/**
 * RMSSFeatures/RMSSEquipment.js
 *
 * The Equipment main panel: one button per weapon/armor item the actor owns (equipped or not),
 * so swapping gear mid-fight doesn't require opening the actor sheet. Clicking calls
 * EquipmentService.swapEquip - same validated rules as the sheet's own ".equippable" handler
 * (hand limits, armor slot conflicts, dual-wield rules), except a would-be-blocked equip clears
 * whatever's in the way first instead of warning and stopping, since from this panel "click a
 * different weapon" reads as "wear this instead". Forces a HUD refresh afterwards so the
 * "Equipped" chip updates immediately instead of only after deselecting/reselecting the token.
 */

import { ICONS, RMSSUtils, UIGuards, SYS_PATH, refreshHud } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

/**
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
export function defineEquipmentMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

    class RMSSEquipmentActionButton extends ActionButton {
        /**
         * @param {Item} item - weapon or armor item
         */
        constructor(item) {
            super();
            this.item = item;
        }
        get label() {
            return this.item?.name ?? "Gear";
        }
        get icon() {
            return this.item?.img || ICONS.equipment;
        }
        get isInteractive() {
            return true;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.element.classList.add("rmss-interactive-button");
            this.element.dataset.tooltipDirection = "UP";

            const isEquipped = this.item?.system?.equipped === true;
            const chips = isEquipped
                ? [{ class: "rmss-equipped-chip", title: "Equipped", icon: ICONS.equipped_chip }]
                : [];
            RMSSUtils.buildChipContainer(this.element, chips);
        }

        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            const isEquipped = this.item?.system?.equipped === true;
            return {
                title: this.label,
                subtitle: this.item?.type === "armor" ? "Armor" : "Weapon",
                details: RMSSUtils.formatTooltipDetails([
                    { label: "Status", value: isEquipped ? "Equipped" : "Not equipped" },
                ]),
                footerText: [isEquipped ? "Left-Click: Unequip" : "Left-Click: Equip"],
            };
        }

        async _onMouseDown(event) {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();

            const actor = RMSSData.getActiveActor();
            if (!actor || !this.item) return;
            const { default: EquipmentService } = await import(
                SYS_PATH("module/actors/services/equipment_service.js")
            );
            // swapEquip, not toggleEquipped: clicking a different weapon/armor here reads as
            // "wear this instead" - it clears whatever's in the way (hand limit, armor slot)
            // instead of warning and blocking, the way the sheet's own equip icons still do.
            await EquipmentService.swapEquip(actor, this.item);
            // updateVisibility() alone doesn't repaint an already-rendered button's own chip/
            // tooltip - force a rebind so the "Equipped" chip shows up immediately instead of
            // only after deselecting/reselecting the token.
            refreshHud();
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    class RMSSEquipmentCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "EQUIPMENT";
            this._icon = ICONS.equipment;
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
            // (this one), so this is the actual lever, not a get visible() on the panel itself
            // (which core never reads - see the Skills/Spells/Favorites/Items panels for the
            // same fix).
            return RMSSData.getEquippableGear(RMSSData.getActiveActor()).length > 0;
        }

        async _getPanel() {
            const actor = RMSSData.getActiveActor();
            const gear = RMSSData.getEquippableGear(actor);
            const buttons = gear.map((item) => new RMSSEquipmentActionButton(item));
            const panel = new ButtonPanel({ id: "rmss-equipment", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);
            return panel;
        }
    }

    class RMSSEquipmentActionPanel extends ActionPanel {
        get label() {
            return "EQUIPMENT";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSEquipmentCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMSSEquipmentActionPanel]);
}
