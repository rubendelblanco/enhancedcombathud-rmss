/**
 * RMSSFeatures/RMSSItems.js
 *
 * The Items main panel: one button per weapon/armor/item carrying a currently-usable
 * enchantment (potion, rune/scroll, staff, artifact...) - the same "cast magic from this item"
 * action already on the actor sheet's own item rows. Clicking reuses
 * castEnchantmentFromItem/getUsableEnchantmentsForItem directly (dynamic SYS_PATH import, no
 * logic duplicated here) - identical to how the sheet's own cast-magic icon behaves, including
 * the picker dialog when an item has more than one usable enchantment.
 */

import { ICONS, RMSSUtils, UIGuards, SYS_PATH } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

/**
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
export function defineItemsMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

    /**
     * Mirrors RMSSCharacterSheet._onItemCastMagicClick: use directly if there's exactly one
     * usable enchantment, otherwise ask which one via a small picker dialog.
     * @param {Actor} actor
     * @param {Item} item
     */
    async function useMagicItem(actor, item) {
        const { getUsableEnchantmentsForItem, castEnchantmentFromItem } = await import(
            SYS_PATH("module/sheets/items/cast_enchantment_from_item.js")
        );
        const usable = getUsableEnchantmentsForItem(item);
        if (usable.length === 0) {
            ui.notifications.warn(game.i18n.localize("rmss.item.cast_magic_none_usable"));
            return;
        }
        if (usable.length === 1) {
            await castEnchantmentFromItem(actor, item, usable[0].index);
            return;
        }

        const esc = (s) =>
            String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const placeholder = esc(game.i18n.localize("rmss.item.cast_magic_select_placeholder"));
        const optionsHtml = usable
            .map((u) => `<option value="${u.index}">${esc(`${u.spellLabel} (${u.usageLabel})`.slice(0, 200))}</option>`)
            .join("");

        await new Promise((resolve) => {
            new Dialog({
                title: game.i18n.localize("rmss.item.cast_magic_modal_title"),
                content: `<form>
                    <p class="notes">${game.i18n.localize("rmss.item.cast_magic_modal_hint")}</p>
                    <div class="form-group">
                        <select name="rmss-enchantment" class="dialog-select" style="width:100%">
                            <option value="">${placeholder}</option>
                            ${optionsHtml}
                        </select>
                    </div>
                </form>`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize("rmss.item.cast_magic_accept"),
                        callback: async (html) => {
                            const raw = html.find('[name="rmss-enchantment"]').val();
                            const index = raw === "" || raw === undefined ? NaN : Number.parseInt(raw, 10);
                            if (Number.isInteger(index)) await castEnchantmentFromItem(actor, item, index);
                            resolve();
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("rmss.item.cast_magic_cancel"),
                        callback: () => resolve(),
                    },
                },
                default: "ok",
                close: () => resolve(),
            }).render(true);
        });
    }

    class RMSSItemActionButton extends ActionButton {
        /**
         * @param {Item} item - weapon/armor/item with a usable enchantment
         */
        constructor(item) {
            super();
            this.item = item;
        }
        get label() {
            return this.item?.name ?? "Item";
        }
        get icon() {
            return this.item?.img || ICONS.items_muted;
        }
        get isInteractive() {
            return true;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.element.classList.add("rmss-interactive-button");
            this.element.dataset.tooltipDirection = "UP";
        }

        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            return {
                title: this.label,
                subtitle: this.item?.type === "item" ? "Item" : this.item?.type === "weapon" ? "Weapon" : "Armor",
                details: RMSSUtils.formatTooltipDetails([]),
                footerText: ["Left-Click: Use item"],
            };
        }

        async _onMouseDown(event) {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();

            const actor = RMSSData.getActiveActor();
            if (!actor || !this.item) return;
            await useMagicItem(actor, this.item);
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    class RMSSItemsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "ITEMS";
            this._icon = ICONS.items;
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
            // (which core never reads - see the Skills/Spells/Favorites panels for the same fix).
            return RMSSData.getUsableMagicItems(RMSSData.getActiveActor()).length > 0;
        }

        async _getPanel() {
            const actor = RMSSData.getActiveActor();
            const items = RMSSData.getUsableMagicItems(actor);
            const buttons = items.map((item) => new RMSSItemActionButton(item));
            const panel = new ButtonPanel({ id: "rmss-items", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);
            return panel;
        }
    }

    class RMSSItemsActionPanel extends ActionPanel {
        get label() {
            return "ITEMS";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSItemsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMSSItemsActionPanel]);
}
