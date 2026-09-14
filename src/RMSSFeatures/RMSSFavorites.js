/**
 * RMSSFeatures/RMSSFavorites.js
 *
 * Two quick-access panels mirroring the actor sheet's own "Favorites" tab (system.favorite on
 * skill/spell items) - flat lists, no category accordion, since favorites are meant to be a
 * handful of one-click shortcuts. Rolling/casting reuses the exact same entry points as the
 * full Skills/Spells panels (ManeuverService.rollManeuver / castSpell), no duplicated logic.
 */

import { ICONS, RMSSUtils, UIGuards, SYS_PATH } from "../RMSSCore.js";
import { RMSSData } from "../RMSSData.js";
import { castSpell } from "./RMSSSpells.js";

/**
 * @param {object} CoreHUD - The Argon CoreHud class.
 */
export function defineFavoritesMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

    class RMSSFavoriteSkillButton extends ActionButton {
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
        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            const sys = this.skill?.system ?? {};
            const details = [
                { label: "Ranks", value: sys.ranks },
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
            RMSSUtils.buildChipContainer(this.element, [{ class: "rmss-skill-fav-chip", title: "Favorite" }]);
        }
        async _onMouseDown(event) {
            if (event?.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            const actor = RMSSData.getActiveActor();
            if (!actor || !this.skill) return;
            const { default: ManeuverService } = await import(SYS_PATH("module/core/skills/maneuver_service.js"));
            await ManeuverService.rollManeuver(actor, this.skill);
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    class RMSSFavoriteSpellButton extends ActionButton {
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
        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            const sys = this.spell?.system ?? {};
            const details = [
                { label: "Level", value: sys.level },
                { label: "Duration", value: sys.duration },
                { label: "Range", value: sys.range },
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
            const chips = [{ class: "rmss-spell-fav-chip", title: "Favorite" }];
            if (this.spell?.system?.instant) chips.push({ class: "rmss-spell-instant-chip", title: "Instantaneous", icon: ICONS.instant });
            RMSSUtils.buildChipContainer(this.element, chips);
        }
        async _onMouseDown(event) {
            if (event?.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            const actor = RMSSData.getActiveActor();
            if (!actor || !this.spell) return;
            await castSpell(actor, this.spell, this.spellListItem);
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    class RMSSFavoriteSkillsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "FAV. SKILLS";
            this._icon = ICONS.fav_skills;
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
            // (which core never reads).
            return RMSSData.getFavoriteSkills(RMSSData.getActiveActor()).length > 0;
        }
        async _getPanel() {
            const actor = RMSSData.getActiveActor();
            const skills = RMSSData.getFavoriteSkills(actor);

            let buttons;
            if (!skills.length) {
                buttons = [
                    new (class NoFavSkillsButton extends ActionButton {
                        get label() {
                            return "No favorite skills";
                        }
                        get icon() {
                            return "";
                        }
                        get classes() {
                            return [...super.classes, "disabled"];
                        }
                    })(),
                ];
            } else {
                buttons = skills.map((s) => new RMSSFavoriteSkillButton(s, RMSSData.getSkillCategoryName(actor, s)));
            }

            const panel = new ButtonPanel({ id: "rmss-favorite-skills", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);
            return panel;
        }
    }

    class RMSSFavoriteSpellsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "FAV. SPELLS";
            this._icon = ICONS.fav_spells;
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
            // (which core never reads).
            return RMSSData.hasAnyFavoriteSpell(RMSSData.getActiveActor());
        }
        async _getPanel() {
            const actor = RMSSData.getActiveActor();
            const entries = await RMSSData.getFavoriteSpells(actor);

            let buttons;
            if (!entries.length) {
                buttons = [
                    new (class NoFavSpellsButton extends ActionButton {
                        get label() {
                            return "No favorite spells";
                        }
                        get icon() {
                            return "";
                        }
                        get classes() {
                            return [...super.classes, "disabled"];
                        }
                    })(),
                ];
            } else {
                buttons = entries.map(({ spell, list }) => new RMSSFavoriteSpellButton(spell, list));
            }

            const panel = new ButtonPanel({ id: "rmss-favorite-spells", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            UIGuards.capPanelHeight(panel);
            return panel;
        }
    }

    class RMSSFavoriteSkillsActionPanel extends ActionPanel {
        get label() {
            return "FAV. SKILLS";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSFavoriteSkillsCategoryButton()];
        }
    }

    class RMSSFavoriteSpellsActionPanel extends ActionPanel {
        get label() {
            return "FAV. SPELLS";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMSSFavoriteSpellsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMSSFavoriteSkillsActionPanel, RMSSFavoriteSpellsActionPanel]);
}
