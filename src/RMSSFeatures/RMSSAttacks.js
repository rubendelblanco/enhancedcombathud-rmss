/**
 * RMSSFeatures/RMSSAttacks.js
 *
 * The Attacks main panel: one category button per bucket (Melee/Ranged/Natural), each opening a
 * sub-panel of the actor's currently equipped weapons/creature attacks. Clicking an attack calls
 * `item.use()` directly - the exact same entry point the actor sheet's own attack row uses,
 * which already handles the equipped check, GM confirmation, ammo consumption and critical
 * resolution (RMSSItem.use() -> "rmssItemUsed" hook -> RMSSWeaponSkillManager.handleAttack).
 * No attack logic lives in this file.
 */

import { ICONS, RMSSUtils, UIGuards } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

const CAT_LABELS = {
    melee: { label: "Melee", icon: () => ICONS.melee },
    ranged: { label: "Ranged", icon: () => ICONS.ranged },
    natural: { label: "Natural", icon: () => ICONS.natural },
};

/**
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
export function defineAttacksMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

    class RMSSAttackActionButton extends ActionButton {
        /**
         * @param {Item} item - weapon or creature_attack item
         * @param {string} catKey
         */
        constructor(item, catKey) {
            super();
            this.item = item;
            this._catKey = catKey;
        }

        get isInteractive() {
            return true;
        }

        get label() {
            return this.item?.name ?? "Attack";
        }

        get icon() {
            return this.item?.img || ICONS[this._catKey] || ICONS.melee;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.element.classList.add("rmss-interactive-button");
            this.element.dataset.tooltipDirection = "UP";
            RMSSUtils.applyValueOverlay(this.element, this.item?.system?.bonus ?? "", "OB");
        }

        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const sys = this.item?.system ?? {};
            const details = [
                { label: "Strength", value: sys.strength },
                { label: "Attack Table", value: sys.attack_table },
                { label: "Fumble", value: sys.fumble_range },
                { label: "Breakage", value: sys.breakage_range },
                { label: "OB", value: sys.bonus },
            ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

            return {
                title: this.label,
                subtitle: this.item?.type === "creature_attack" ? "Creature attack" : "Weapon",
                details: RMSSUtils.formatTooltipDetails(details),
                footerText: ["Left-Click: Attack current target"],
            };
        }

        async _onMouseDown(event) {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            await this.item?.use();
        }

        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    class RMSSAttackCategoryButton extends ButtonPanelButton {
        constructor({ key, label, icon, items }) {
            super();
            this.key = key;
            this.title = label;
            this._icon = icon;
            this._items = Array.isArray(items) ? items : [];
        }
        get label() {
            return this.title;
        }
        get icon() {
            return this._icon;
        }
        get hasContents() {
            return this._items.length > 0;
        }
        get isInteractive() {
            return true;
        }

        async _getPanel() {
            const buttons = this._items.map((item) => new RMSSAttackActionButton(item, this.key));
            const panel = new ButtonPanel({ id: `rmss-attacks-${this.key}`, buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);
            return panel;
        }
    }

    class RMSSAttacksActionPanel extends ActionPanel {
        get label() {
            return "Attacks";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }

        async _getButtons() {
            const actor = RMSSData.getActiveActor();
            const grouped = RMSSData.getGroupedAttacks(actor);

            const buttons = [];
            for (const [key, items] of grouped.entries()) {
                const meta = CAT_LABELS[key];
                if (!meta) continue;
                buttons.push(new RMSSAttackCategoryButton({ key, label: meta.label, icon: meta.icon(), items }));
            }
            return buttons;
        }
    }

    CoreHUD.defineMainPanels([RMSSAttacksActionPanel]);
}
