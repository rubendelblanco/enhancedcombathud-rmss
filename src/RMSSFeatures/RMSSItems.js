/**
 * RMSSFeatures/RMSSItems.js
 *
 * The "USE ITEMS" main panel: an accordion with two fixed subcategories - MAGIC (weapon/armor/
 * item carrying a currently-usable enchantment: potion, rune/scroll, staff, artifact...) and
 * CONSUMABLES (plain items tagged "consumable" - food, drink... - that aren't already covered by
 * MAGIC). A subcategory is omitted entirely when its list is empty, same as the whole panel being
 * hidden when both are.
 *
 * MAGIC reuses castEnchantmentFromItem/getUsableEnchantmentsForItem directly (dynamic SYS_PATH
 * import, no logic duplicated here) - identical to how the sheet's own cast-magic icon behaves,
 * including the picker dialog when an item has more than one usable enchantment.
 * CONSUMABLES reuses consumeItem the same way - one click decrements quantity by 1, deleting the
 * item once it hits zero.
 */

import { ICONS, RMSSUtils, UIGuards, getOpenCategory, setOpenCategory, SYS_PATH } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

const OPEN_STATE_KEY = "rmss-use-items";

function getOpenSubcategory() {
    return getOpenCategory(OPEN_STATE_KEY);
}
function setOpenSubcategory(keyOrNull) {
    setOpenCategory(OPEN_STATE_KEY, keyOrNull);
}

function applyUseItemsAccordionVisibility(panelEl) {
    if (!panelEl) return;
    const openKey = getOpenSubcategory();

    panelEl.querySelectorAll(".rmss-useitems-header").forEach((header) => {
        const key = header.dataset.subKey || "";
        header.classList.toggle("open", key === openKey);
        header.classList.toggle("closed", key !== openKey);
    });

    panelEl.querySelectorAll(".rmss-useitems-tile").forEach((tile) => {
        const key = tile.dataset.subKey || "";
        tile.style.display = openKey && key === openKey ? "" : "none";
    });
}

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

    class RMSSUseItemsSubcategoryHeaderButton extends ActionButton {
        /**
         * @param {string} key - "magic" | "consumables"
         * @param {string} label
         * @param {string} icon
         */
        constructor(key, label, icon) {
            super();
            this._key = key;
            this._label = label;
            this._icon = icon;
            this._panelEl = null;
        }
        get label() {
            return this._label;
        }
        get icon() {
            return this._icon;
        }
        get isInteractive() {
            return true;
        }
        get classes() {
            const open = getOpenSubcategory() === this._key;
            return [...super.classes, "rmss-useitems-header", open ? "open" : "closed"];
        }
        get hasTooltip() {
            return false;
        }

        _bindPanel(panel) {
            const tryBind = () => {
                const el = panel?.element;
                if (!el) return requestAnimationFrame(tryBind);
                this._panelEl = el;
            };
            requestAnimationFrame(tryBind);
        }

        async _renderInner() {
            await super._renderInner();
            if (this.element) {
                this.element.style.pointerEvents = "auto";
                this.element.style.cursor = "pointer";
                this.element.dataset.subKey = this._key;
            }
        }

        async _onMouseDown() {
            const newKey = getOpenSubcategory() === this._key ? null : this._key;
            setOpenSubcategory(newKey);
            applyUseItemsAccordionVisibility(this._panelEl);
        }
        async _onLeftClick(e) {
            e?.preventDefault?.();
            e?.stopPropagation?.();
        }
    }

    class RMSSMagicItemActionButton extends ActionButton {
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
        get classes() {
            return [...super.classes.filter((c) => c !== "disabled"), "rmss-useitems-tile"];
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.element.classList.add("rmss-interactive-button");
            this.element.dataset.tooltipDirection = "UP";
            this.element.dataset.subKey = "magic";
            this.element.style.display = "none"; // starts hidden - subcategory not open yet
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

    class RMSSConsumableActionButton extends ActionButton {
        /**
         * @param {Item} item - item tagged "consumable"
         */
        constructor(item) {
            super();
            this.item = item;
        }
        get label() {
            return this.item?.name ?? "Item";
        }
        get icon() {
            return this.item?.img || ICONS.consumables_muted;
        }
        get isInteractive() {
            return true;
        }
        get classes() {
            return [...super.classes.filter((c) => c !== "disabled"), "rmss-useitems-tile"];
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.element.classList.add("rmss-interactive-button");
            this.element.dataset.tooltipDirection = "UP";
            this.element.dataset.subKey = "consumables";
            this.element.style.display = "none"; // starts hidden - subcategory not open yet
        }

        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            return {
                title: this.label,
                subtitle: "Consumable",
                details: RMSSUtils.formatTooltipDetails([
                    { label: "Quantity", value: this.item?.system?.quantity ?? 1 },
                ]),
                footerText: ["Left-Click: Consume 1"],
            };
        }

        async _onMouseDown(event) {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();

            const actor = RMSSData.getActiveActor();
            if (!actor || !this.item) return;
            const { consumeItem } = await import(SYS_PATH("module/sheets/items/consume_item.js"));
            await consumeItem(this.item);
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    class RMSSUseItemsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "USE ITEMS";
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
            // (which core never reads - see the Skills/Spells/Favorites/Equipment panels for the
            // same fix).
            const actor = RMSSData.getActiveActor();
            return RMSSData.getUsableMagicItems(actor).length > 0 || RMSSData.getConsumableItems(actor).length > 0;
        }

        async _getPanel() {
            const actor = RMSSData.getActiveActor();
            const magicItems = RMSSData.getUsableMagicItems(actor);
            const consumables = RMSSData.getConsumableItems(actor);

            const buttons = [];
            const headerInstances = [];

            if (magicItems.length) {
                const header = new RMSSUseItemsSubcategoryHeaderButton("magic", "MAGIC", ICONS.magic);
                headerInstances.push(header);
                buttons.push(header);
                for (const item of magicItems) buttons.push(new RMSSMagicItemActionButton(item));
            }
            if (consumables.length) {
                const header = new RMSSUseItemsSubcategoryHeaderButton("consumables", "CONSUMABLES", ICONS.consumables);
                headerInstances.push(header);
                buttons.push(header);
                for (const item of consumables) buttons.push(new RMSSConsumableActionButton(item));
            }

            const panel = new ButtonPanel({ id: "rmss-items", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);

            headerInstances.forEach((h) => h._bindPanel(panel));
            setOpenSubcategory(null);

            return panel;
        }
    }

    class RMSSItemsActionPanel extends ActionPanel {
        get label() {
            return "USE ITEMS";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSUseItemsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMSSItemsActionPanel]);
}
