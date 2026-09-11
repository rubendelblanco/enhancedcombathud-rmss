/**
 * RMSSFeatures/RMSSSkills.js
 *
 * The Skills main panel: one accordion category per skill_category, each opening to the actor's
 * skills in that category. Clicking a skill calls ManeuverService.rollManeuver(actor, skill)
 * directly - the same entry point the actor sheet's own skill row uses, which already opens
 * RMSS's maneuver-options dialog (difficulty/combat situation/lighting/darkness) before rolling.
 */

import { ICONS, RMSSUtils, UIGuards, installListSearch, getOpenCategory, setOpenCategory, SYS_PATH } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";

const OPEN_STATE_KEY = "rmss-skills";

function catKeyOf(s) {
    return String(s ?? "").normalize("NFKC").trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function getOpenSkillsCategory() {
    return getOpenCategory(OPEN_STATE_KEY);
}
function setOpenSkillsCategory(catOrNull) {
    setOpenCategory(OPEN_STATE_KEY, catOrNull);
}

function applySkillsAccordionVisibility(panelEl) {
    if (!panelEl) return;
    const openKey = getOpenSkillsCategory();

    panelEl.querySelectorAll(".rmss-skill-header").forEach((header) => {
        const key = header.dataset.catKey || "";
        header.style.display = "";
        header.classList.toggle("open", key === openKey);
        header.classList.toggle("closed", key !== openKey);
    });

    panelEl.querySelectorAll(".rmss-skill-tile").forEach((tile) => {
        const key = tile.dataset.catKey || "";
        tile.style.display = openKey && key === openKey ? "" : "none";
    });
}

/**
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
export function defineSkillsMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

    class RMSSSkillHeaderButton extends ActionButton {
        constructor(title) {
            super();
            this._title = title;
            this._catKey = catKeyOf(title);
            this._panelEl = null;
        }
        get label() {
            return this._title;
        }
        get icon() {
            return "";
        }
        get isInteractive() {
            return true;
        }
        get classes() {
            const open = getOpenSkillsCategory() === this._catKey;
            return [...super.classes, "rmss-skill-header", open ? "open" : "closed"];
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
                this.element.dataset.catKey = this._catKey;
                this.element.dataset.nameNorm = this.label.toLowerCase();
                this.element.dataset.favorite = "false";
            }
        }

        async _onMouseDown() {
            const currentOpen = getOpenSkillsCategory();
            const newKey = currentOpen === this._catKey ? null : this._catKey;
            setOpenSkillsCategory(newKey);
            applySkillsAccordionVisibility(this._panelEl);
        }

        async _onLeftClick(e) {
            e?.preventDefault?.();
            e?.stopPropagation?.();
        }
    }

    class RMSSSkillActionButton extends ActionButton {
        /**
         * @param {Item} skill
         * @param {string} categoryName
         */
        constructor(skill, categoryName) {
            super();
            this.skill = skill;
            this._categoryName = categoryName;
        }
        get label() {
            return this.skill?.name ?? "Skill";
        }
        get icon() {
            return this.skill?.img || ICONS.skills_muted;
        }
        get isInteractive() {
            return true;
        }
        get classes() {
            return [...super.classes.filter((c) => c !== "disabled"), "rmss-skill-tile"];
        }

        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            const sys = this.skill?.system ?? {};
            const details = [
                { label: "Ranks", value: sys.ranks },
                { label: "Rank bonus", value: sys.rank_bonus },
                { label: "Category bonus", value: sys.category_bonus },
                { label: "Item bonus", value: sys.item_bonus },
                { label: "Special bonus 1", value: sys.special_bonus_1 },
                { label: "Special bonus 2", value: sys.special_bonus_2 },
                { label: "Total bonus", value: sys.total_bonus },
            ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

            return {
                title: this.label,
                subtitle: this._categoryName ?? "",
                details: RMSSUtils.formatTooltipDetails(details),
                footerText: ["Left-Click: Roll skill"],
            };
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            this.element.style.pointerEvents = "auto";
            this.element.style.cursor = "pointer";
            this.element.dataset.tooltipDirection = "UP";

            RMSSUtils.applyValueOverlay(this.element, this.skill?.system?.total_bonus ?? "", "Total");

            const label = this.label || "";
            const cat = this._categoryName || "";
            this.element.dataset.catKey = catKeyOf(cat);
            this.element.dataset.name = label;
            this.element.dataset.nameNorm = (label + " " + cat).toLowerCase();

            const isFav = this.skill?.system?.favorite === true;
            this.element.dataset.favorite = isFav ? "true" : "false";

            const ranks = Number(this.skill?.system?.ranks) || 0;
            this.element.dataset.ranked = ranks > 0 ? "true" : "false";

            const chips = [];
            if (isFav) chips.push({ class: "rmss-skill-fav-chip", title: "Favorite" });
            RMSSUtils.buildChipContainer(this.element, chips);

            this.element.style.display = "none"; // starts hidden - accordion category not open yet
        }

        async _onMouseDown(event) {
            if (event?.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            await this._roll();
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }

        async _roll() {
            const actor = RMSSData.getActiveActor();
            if (!actor || !this.skill) return;
            const { default: ManeuverService } = await import(SYS_PATH("module/core/skills/maneuver_service.js"));
            await ManeuverService.rollManeuver(actor, this.skill);
        }
    }

    class RMSSSkillsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "SKILLS";
            this._icon = ICONS.skills;
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
            const groups = RMSSData.getGroupedSkills(actor);

            if (!groups.size) {
                const empty = new (class NoSkillsButton extends ActionButton {
                    get label() {
                        return "No skills";
                    }
                    get icon() {
                        return "";
                    }
                    get classes() {
                        return [...super.classes, "disabled"];
                    }
                })();
                const panel = new ButtonPanel({ id: "rmss-skills", buttons: [empty] });
                UIGuards.attachPanelInteractionGuards(panel);
                return panel;
            }

            const buttons = [];
            const headerInstances = [];
            for (const [catName, skills] of groups.entries()) {
                const header = new RMSSSkillHeaderButton(catName);
                headerInstances.push(header);
                buttons.push(header);
                for (const skill of skills) buttons.push(new RMSSSkillActionButton(skill, catName));
            }

            const panel = new ButtonPanel({ id: "rmss-skills", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);

            const skillFilters = [
                { id: "fav", dataKey: "favorite", icon: ICONS.star, tooltip: "Show Favorites Only" },
                { id: "ranked", dataKey: "ranked", icon: ICONS.ranked, tooltip: "Show Ranked Skills Only" },
            ];

            installListSearch(panel, ".rmss-skill-tile", ".rmss-skill-header", "skill", {
                filters: skillFilters,
                onClear: (panelEl) => {
                    if (!panelEl) return;
                    applySkillsAccordionVisibility(panelEl);
                    const summaryEl = panelEl.querySelector(".rmss-search-summary");
                    if (summaryEl) summaryEl.style.display = "none";
                },
            });

            headerInstances.forEach((h) => h._bindPanel(panel));

            setOpenSkillsCategory(null);
            requestAnimationFrame(() => {
                const el = panel.element;
                if (!el) return;
                el.querySelectorAll(".rmss-skill-tile").forEach((t) => (t.style.display = "none"));
            });

            return panel;
        }
    }

    class RMSSSkillsActionPanel extends ActionPanel {
        get label() {
            return "SKILLS";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        get visible() {
            // Creature actors have no skill items and no Skills tab on their own sheet - the
            // panel has nothing to show, so hide it entirely rather than opening onto emptiness.
            return RMSSData.getActiveActor()?.type !== "creature";
        }
        async _getButtons() {
            return [new RMSSSkillsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMSSSkillsActionPanel]);
}
