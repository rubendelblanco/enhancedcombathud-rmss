/**
 * RMSSFeatures/RMSSSpells.js
 *
 * The Spells main panel: one accordion header per spell_list the actor owns, each opening to the
 * spells contained in that list. Clicking a spell replicates the small dispatch already in
 * RMSSPlayerSheet._onSpellCastClick - instant / BE / DE / else(F,E,P,U,I) -> the matching
 * cast*Service - so no cast logic is reimplemented here, just the same routing.
 */

import { ICONS, RMSSUtils, UIGuards, installListSearch, getOpenCategory, setOpenCategory, SYS_PATH } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

const OPEN_STATE_KEY = "rmss-spells";

function keyOf(s) {
    return String(s ?? "").normalize("NFKC").trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function getOpenSpellList() {
    return getOpenCategory(OPEN_STATE_KEY);
}
function setOpenSpellList(keyOrNull) {
    setOpenCategory(OPEN_STATE_KEY, keyOrNull);
}

function applySpellsAccordionVisibility(panelEl) {
    if (!panelEl) return;
    const openKey = getOpenSpellList();

    panelEl.querySelectorAll(".rmss-spell-header").forEach((header) => {
        const key = header.dataset.listKey || "";
        header.style.display = "";
        header.classList.toggle("open", key === openKey);
        header.classList.toggle("closed", key !== openKey);
    });

    panelEl.querySelectorAll(".rmss-spell-tile").forEach((tile) => {
        const key = tile.dataset.listKey || "";
        tile.style.display = openKey && key === openKey ? "" : "none";
    });
}

/**
 * Cast a spell exactly the way RMSSPlayerSheet._onSpellCastClick does.
 * @param {Actor} actor
 * @param {Item} spell
 * @param {Item} spellListItem
 */
export async function castSpell(actor, spell, spellListItem) {
    const spellListName = spellListItem?.name ?? spell.system?.spell_list ?? "";
    const spellListRealm = spellListItem?.system?.realm ?? "";

    if (spell.system?.instant) {
        const { default: InstantSpellService } = await import(SYS_PATH("module/spells/services/instant_spell_service.js"));
        await InstantSpellService.castInstantSpell({ actor, spell });
        return;
    }
    if (spell.system?.type === "BE") {
        const { default: BaseElementalSpellService } = await import(SYS_PATH("module/spells/services/base_elemental_spell_service.js"));
        await BaseElementalSpellService.castBaseElementalSpell({ actor, spell, spellListName, spellListRealm });
        return;
    }
    if (spell.system?.type === "DE") {
        const { default: DirectedElementalSpellService } = await import(SYS_PATH("module/spells/services/directed_elemental_spell_service.js"));
        await DirectedElementalSpellService.castDirectedElementalSpell({ actor, spell, spellListName, spellListRealm });
        return;
    }
    const { default: ForceSpellService } = await import(SYS_PATH("module/spells/services/force_spell_service.js"));
    await ForceSpellService.castForceSpell({ actor, spell, spellListName, spellListRealm });
}

/**
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
export function defineSpellsMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

    class RMSSSpellListHeaderButton extends ActionButton {
        constructor(spellListItem) {
            super();
            this.spellListItem = spellListItem;
            this._key = keyOf(spellListItem.id);
            this._panelEl = null;
        }
        get label() {
            const realm = this.spellListItem.system?.realm;
            return realm ? `${this.spellListItem.name} (${realm})` : this.spellListItem.name;
        }
        get icon() {
            return this.spellListItem.img || ICONS.spells_muted;
        }
        get isInteractive() {
            return true;
        }
        get classes() {
            const open = getOpenSpellList() === this._key;
            return [...super.classes, "rmss-spell-header", open ? "open" : "closed"];
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
                this.element.dataset.listKey = this._key;
                this.element.dataset.nameNorm = this.label.toLowerCase();
                this.element.dataset.favorite = "false";
            }
        }

        async _onMouseDown() {
            const newKey = getOpenSpellList() === this._key ? null : this._key;
            setOpenSpellList(newKey);
            applySpellsAccordionVisibility(this._panelEl);
        }
        async _onLeftClick(e) {
            e?.preventDefault?.();
            e?.stopPropagation?.();
        }
    }

    class RMSSSpellActionButton extends ActionButton {
        /**
         * @param {Item} spell
         * @param {Item} spellListItem
         */
        constructor(spell, spellListItem) {
            super();
            this.spell = spell;
            this.spellListItem = spellListItem;
        }
        get label() {
            return `${this.spell?.name ?? "Spell"} (Lvl ${this.spell?.system?.level ?? "?"})`;
        }
        get icon() {
            return this.spell?.img || ICONS.spells_muted;
        }
        get isInteractive() {
            return true;
        }
        get classes() {
            return [...super.classes.filter((c) => c !== "disabled"), "rmss-spell-tile"];
        }

        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            const sys = this.spell?.system ?? {};
            const details = [
                { label: "Level", value: sys.level },
                { label: "Area of Effect", value: sys.area_of_effect },
                { label: "Duration", value: sys.duration },
                { label: "Range", value: sys.range },
                { label: "Type", value: sys.subType && sys.subType !== "-" ? `${sys.type} (${sys.subType})` : sys.type },
                { label: "No PP", value: sys.no_pp ? "Yes" : null },
            ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

            return {
                title: this.spell?.name ?? "Spell",
                subtitle: this.spellListItem?.name ?? "",
                description: sys.description ?? "",
                details: RMSSUtils.formatTooltipDetails(details),
                footerText: ["Left-Click: Cast spell"],
            };
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            this.element.style.pointerEvents = "auto";
            this.element.style.cursor = "pointer";
            this.element.dataset.tooltipDirection = "UP";

            RMSSUtils.applyValueOverlay(this.element, this.spell?.system?.level ?? "", "Lvl");

            const label = this.spell?.name || "";
            this.element.dataset.listKey = keyOf(this.spellListItem?.id);
            this.element.dataset.name = label;
            this.element.dataset.nameNorm = label.toLowerCase();

            const isFav = this.spell?.system?.favorite === true;
            const isInstant = this.spell?.system?.instant === true;
            this.element.dataset.favorite = isFav ? "true" : "false";
            this.element.dataset.instant = isInstant ? "true" : "false";

            const chips = [];
            if (isFav) chips.push({ class: "rmss-spell-fav-chip", title: "Favorite" });
            if (isInstant) chips.push({ class: "rmss-spell-instant-chip", title: "Instantaneous", icon: ICONS.instant });
            RMSSUtils.buildChipContainer(this.element, chips);

            this.element.style.display = "none"; // starts hidden - list not open yet
        }

        async _onMouseDown(event) {
            if (event?.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            await this._cast();
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }

        async _cast() {
            const actor = RMSSData.getActiveActor();
            if (!actor || !this.spell) return;
            await castSpell(actor, this.spell, this.spellListItem);
        }
    }

    class RMSSSpellsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "SPELLS";
            this._icon = ICONS.spells;
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

        async _getPanel() {
            const actor = RMSSData.getActiveActor();
            const grouped = await RMSSData.getGroupedSpells(actor);

            if (!grouped.size) {
                const empty = new (class NoSpellsButton extends ActionButton {
                    get label() {
                        return "No spells";
                    }
                    get icon() {
                        return "";
                    }
                    get classes() {
                        return [...super.classes, "disabled"];
                    }
                })();
                const panel = new ButtonPanel({ id: "rmss-spells", buttons: [empty] });
                UIGuards.attachPanelInteractionGuards(panel);
                return panel;
            }

            const buttons = [];
            const headerInstances = [];
            for (const { list, spells } of grouped.values()) {
                const header = new RMSSSpellListHeaderButton(list);
                headerInstances.push(header);
                buttons.push(header);
                for (const spell of spells) buttons.push(new RMSSSpellActionButton(spell, list));
            }

            const panel = new ButtonPanel({ id: "rmss-spells", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);

            const spellFilters = [
                { id: "fav", dataKey: "favorite", icon: ICONS.star, tooltip: "Show Favorites Only" },
                { id: "instant", dataKey: "instant", icon: ICONS.instant, tooltip: "Show Instantaneous Only" },
            ];

            installListSearch(panel, ".rmss-spell-tile", ".rmss-spell-header", "spell", {
                filters: spellFilters,
                onClear: (panelEl) => {
                    if (!panelEl) return;
                    applySpellsAccordionVisibility(panelEl);
                    const summaryEl = panelEl.querySelector(".rmss-search-summary");
                    if (summaryEl) summaryEl.style.display = "none";
                },
            });

            headerInstances.forEach((h) => h._bindPanel(panel));

            setOpenSpellList(null);
            requestAnimationFrame(() => {
                const el = panel.element;
                if (!el) return;
                el.querySelectorAll(".rmss-spell-tile").forEach((t) => (t.style.display = "none"));
            });

            return panel;
        }
    }

    class RMSSSpellsActionPanel extends ActionPanel {
        get label() {
            return "SPELLS";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSSpellsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMSSSpellsActionPanel]);
}
