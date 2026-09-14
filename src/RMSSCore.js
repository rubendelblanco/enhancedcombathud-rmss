/**
 * RMSSCore.js
 *
 * Shared utilities, core Argon integration points, UI guards, and the general reusable search
 * logic used by multiple panels. Ported from enhancedcombathud-rmu's RMUCore.js - this part of
 * the reference module is generic Argon/DOM plumbing with no RMU-specific business logic, so it
 * carries over near-verbatim (renamed module id, own icon set, no rmuTokenActionWrapper - RMSS
 * panels call the system's service classes directly instead of a game.system.api indirection).
 */

const MODULE_ID = "enhancedcombathud-rmss";

/**
 * Route helper for module icons.
 */
const MOD_ICON = (file) => (foundry?.utils?.getRoute ? foundry.utils.getRoute(`modules/${MODULE_ID}/icons/${file}`) : `modules/${MODULE_ID}/icons/${file}`);

const SYSTEM_ID = "rmss";

/**
 * Builds a route to a file inside the rmss system (honors a hosted Foundry's route prefix, if
 * any) - used to dynamically import the system's own service classes directly rather than going
 * through a game.system.api indirection layer rmss doesn't have.
 * @param {string} path - path relative to the system root, e.g. "module/core/skills/maneuver_service.js"
 */
const SYS_PATH = (path) => (foundry?.utils?.getRoute ? foundry.utils.getRoute(`systems/${SYSTEM_ID}/${path}`) : `systems/${SYSTEM_ID}/${path}`);

/**
 * Configuration map for all user-customizable icons.
 */
const ICON_CONFIG = {
    melee: { name: "Melee Attack", default: MOD_ICON("melee.svg") },
    ranged: { name: "Ranged Attack", default: MOD_ICON("arrow-cluster.svg") },
    natural: { name: "Natural Attack", default: MOD_ICON("claw-string.svg") },
    skills: { name: "Skills Category", default: MOD_ICON("skills.svg") },
    skills_muted: { name: "Skill Action (Muted)", default: MOD_ICON("skills_muted.svg") },
    spells: { name: "Spells Category", default: MOD_ICON("spells.svg") },
    spells_muted: { name: "Spell Action (Muted)", default: MOD_ICON("spells_muted.svg") },
    combat: { name: "End Turn (Combat)", default: MOD_ICON("combat.svg") },
    rest: { name: "Rest Action", default: MOD_ICON("rest.svg") },
    star: { name: "Favorite Star", default: MOD_ICON("star.svg") },
    fav_skills: { name: "Favorite Skills Category", default: MOD_ICON("ace.svg") },
    fav_spells: { name: "Favorite Spells Category", default: MOD_ICON("magic-palm.svg") },
    instant: { name: "Instantaneous Marker", default: MOD_ICON("instant.svg") },
    close: { name: "Close/Clear", default: MOD_ICON("close.svg") },
    search: { name: "Search Magnifier", default: MOD_ICON("search.svg") },
    ranked: { name: "Ranked Skill Chip", default: MOD_ICON("ranked.svg") },
    items: { name: "Use Items Category", default: MOD_ICON("items.svg") },
    items_muted: { name: "Magic Item Action (Muted)", default: MOD_ICON("instant.svg") },
    magic: { name: "Magic Subcategory", default: MOD_ICON("potion-ball.svg") },
    consumables: { name: "Consumables Category", default: MOD_ICON("eating.svg") },
    consumables_muted: { name: "Consumable Action (Muted)", default: MOD_ICON("instant.svg") },
    equipment: { name: "Equipment Category", default: MOD_ICON("swordman.svg") },
    equipped_chip: { name: "Equipped Chip", default: MOD_ICON("ranked.svg") },
};

/**
 * Global ICONS object using dynamic getters, pulling live user settings.
 */
const ICONS = {};
for (const key of Object.keys(ICON_CONFIG)) {
    Object.defineProperty(ICONS, key, {
        get: () => game.settings.get(MODULE_ID, `icon_main_${key}`),
        enumerable: true,
    });
}

/**
 * Safely retrieves a custom icon path defined by the user for a specific spell/skill name.
 * @param {string} name
 */
function getUserIcon(name) {
    if (!name) return null;
    try {
        const icons = game.settings.get(MODULE_ID, "custom_user_icons") || {};
        return icons[name] || null;
    } catch (e) {
        return null;
    }
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class RMSSCustomIconsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options) {
        super(options);
        const savedIcons = game.settings.get(MODULE_ID, "custom_user_icons") || {};
        this.iconRows = Object.entries(savedIcons).map(([name, path]) => ({
            id: foundry.utils.randomID(),
            name,
            path,
        }));
    }

    static DEFAULT_OPTIONS = {
        id: "rmss-custom-icons",
        window: {
            title: "Custom Spell & Skill Icons",
            icon: "fas fa-images",
            resizable: true,
        },
        position: { width: 550, height: "auto" },
        actions: {
            addRow: RMSSCustomIconsMenu._onAddRow,
            deleteRow: RMSSCustomIconsMenu._onDeleteRow,
            pickFile: RMSSCustomIconsMenu._onPickFile,
            cancel: RMSSCustomIconsMenu._onCancel,
            save: RMSSCustomIconsMenu._onSave,
        },
    };

    static PARTS = {
        form: {
            template: `modules/${MODULE_ID}/templates/rmss-custom-icons.hbs`,
        },
    };

    async _prepareContext(options) {
        return { icons: this.iconRows };
    }

    _syncState() {
        if (!this.element) return;
        const form = this.element.querySelector("form");
        if (!form) return;

        const formData = new FormData(form);
        this.iconRows = (this.iconRows || []).map((row) => ({
            id: row.id,
            name: formData.get(`name_${row.id}`)?.trim() || "",
            path: formData.get(`path_${row.id}`)?.trim() || "",
        }));
    }

    static async _onAddRow(event, target) {
        this._syncState();
        this.iconRows.push({ id: foundry.utils.randomID(), name: "", path: "" });
        this.render();
    }

    static async _onDeleteRow(event, target) {
        this._syncState();
        const rowId = target.closest(".form-group").dataset.rowId;
        this.iconRows = this.iconRows.filter((r) => r.id !== rowId);
        this.render();
    }

    static async _onPickFile(event, target) {
        const targetName = target.dataset.target;
        const input = this.element.querySelector(`input[name="${targetName}"]`);
        if (!input) return;

        new foundry.applications.apps.FilePicker({
            type: "image",
            current: input.value,
            callback: (path) => {
                input.value = path;
            },
        }).render(true);
    }

    static async _onCancel(event, target) {
        this.close();
    }

    static async _onSave(event, target) {
        event.preventDefault();
        this._syncState();

        const newIcons = {};
        for (const row of this.iconRows) {
            if (row.name && row.path) newIcons[row.name] = row.path;
        }

        await game.settings.set(MODULE_ID, "custom_user_icons", newIcons);
        ui.notifications.info("Custom icons saved. Reloading...");
        this.close();
        setTimeout(() => globalThis.location.reload(), 500);
    }
}

/**
 * Registers all icon settings with Foundry VTT.
 */
function registerIconSettings() {
    for (const [key, config] of Object.entries(ICON_CONFIG)) {
        game.settings.register(MODULE_ID, `icon_main_${key}`, {
            name: config.name,
            scope: "world",
            config: true,
            type: String,
            filePicker: "image",
            default: config.default,
            requiresReload: true,
        });
    }

    game.settings.register(MODULE_ID, "custom_user_icons", {
        scope: "world",
        config: false,
        type: Object,
        default: {},
    });

    game.settings.registerMenu(MODULE_ID, "custom_icons_menu", {
        name: "Custom Spell & Skill Icons",
        label: "Configure Icons",
        hint: "Map specific spells and skills to custom icons.",
        icon: "fas fa-images",
        type: RMSSCustomIconsMenu,
        restricted: true,
    });
}

// -----------------------------------------------------------------------------
// Core Utilities
// -----------------------------------------------------------------------------

function debounce(func, delay = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

function formatBonus(n) {
    if (n === null || n === undefined) return n;
    const s = String(n).trim();
    if (s === "") return s;
    const num = Number(s);
    if (Number.isNaN(num)) return n;
    return num > 0 ? `+${num}` : String(num);
}

const RMSSUtils = {
    formatTooltipDetails(details) {
        const excludedLabels = new Set(["Ranks", "Total ranks", "Level"]);
        return details.map((detail) => {
            if (excludedLabels.has(detail.label)) return detail;
            return { ...detail, value: formatBonus(detail.value) };
        });
    },

    /**
     * Mounts a translucent value overlay onto an action button.
     * @param {HTMLElement} buttonEl
     * @param {string|number} [number=""]
     * @param {string} [labelText="Total"]
     */
    applyValueOverlay(buttonEl, number = "", labelText = "Total") {
        if (!buttonEl) return;
        const host = buttonEl.querySelector(".image, .ech-image, .icon, .thumbnail, .main-button__image, .argon-image") || buttonEl;
        host.classList.add("rmss-button-relative", "rmss-overflow-hidden");
        host.querySelector(".rmss-value-overlay")?.remove();

        const root = document.createElement("div");
        root.className = "rmss-value-overlay";
        const txt = document.createElement("div");
        txt.className = "rmss-value-overlay-text";

        if (labelText) {
            const t = document.createElement("div");
            t.className = "rmss-value-overlay-label";
            t.textContent = labelText;
            txt.appendChild(t);
        }

        if (number !== "" && number !== null && number !== undefined) {
            const n = document.createElement("div");
            n.className = "rmss-value-overlay-number";
            n.textContent = formatBonus(number);
            txt.appendChild(n);
        }

        root.appendChild(txt);
        host.appendChild(root);
    },

    /**
     * Creates/updates the small chip container on an action button (favorite/instant markers).
     * @param {HTMLElement} element
     * @param {Array<{id:string,title:string,icon?:string,class:string}>} [chips=[]]
     */
    buildChipContainer(element, chips = []) {
        if (!element) return null;
        if (!chips || chips.length === 0) {
            element.querySelector(".rmss-chip-container")?.remove();
            return null;
        }

        element.classList.add("rmss-button-relative");
        let chipContainer = element.querySelector(".rmss-chip-container");
        if (chipContainer) chipContainer.innerHTML = "";
        else {
            chipContainer = document.createElement("div");
            chipContainer.className = "rmss-chip-container";
            element.appendChild(chipContainer);
        }

        for (const chipData of chips) {
            const chip = document.createElement("div");
            chip.className = `rmss-chip ${chipData.class}`;
            chip.title = chipData.title;

            let iconUrl = chipData.icon;
            if (!iconUrl) {
                if (chipData.class.includes("fav-chip")) iconUrl = ICONS.star;
                else if (chipData.class.includes("instant-chip")) iconUrl = ICONS.instant;
            }

            if (iconUrl) {
                const iconInner = document.createElement("div");
                iconInner.style.width = "100%";
                iconInner.style.height = "100%";
                iconInner.style.backgroundColor = "var(--color-warm-2, #f0c987)";
                iconInner.style.maskImage = `url('${iconUrl}')`;
                iconInner.style.webkitMaskImage = `url('${iconUrl}')`;
                iconInner.style.maskSize = "contain";
                iconInner.style.webkitMaskSize = "contain";
                iconInner.style.maskRepeat = "no-repeat";
                iconInner.style.webkitMaskRepeat = "no-repeat";
                iconInner.style.maskPosition = "center";
                iconInner.style.webkitMaskPosition = "center";
                chip.appendChild(iconInner);
            }

            chipContainer.appendChild(chip);
        }
        return chipContainer;
    },
};

// -----------------------------------------------------------------------------
// UI Guards
// -----------------------------------------------------------------------------

const UIGuards = {
    attachPanelInputGuards(panel) {
        const arm = () => {
            const el = panel?.element;
            if (!el) return requestAnimationFrame(arm);

            const cap = { capture: true };
            const stopIfControl = (ev) => {
                const t = ev.target;
                if (t?.closest?.(".rmss-skill-search__fav, .rmss-skill-search__clear")) return;
                if (ev.type === "input") return;
                if (!t) return;

                if (t.closest("input, textarea, select, .rmss-skill-search, .rmss-skill-search__input, .rmss-skill-search__clear")) {
                    if (ev.type === "pointerdown" || ev.type === "mousedown" || ev.type === "touchstart") ev.preventDefault();
                    ev.stopImmediatePropagation();
                    ev.stopPropagation();
                }
            };
            ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "contextmenu", "wheel", "focus", "focusin", "focusout", "blur", "keydown", "keyup"].forEach(
                (type) => el.addEventListener(type, stopIfControl, cap),
            );
        };
        requestAnimationFrame(arm);
    },

    installGlobalHudInputGuard: () => {
        const guardHandler = (event) => {
            if (!ui.ARGON?.isOpen) return;

            const target = event.target;
            const targetTag = target.tagName;

            if (targetTag === "INPUT" || targetTag === "SELECT" || targetTag === "TEXTAREA" || target.closest('[data-argon-input-guard="true"]')) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        document.body.addEventListener("keydown", guardHandler, true);
        console.log("[ECH-RMSS] Global HUD input guard installed.");
    },

    attachPanelInteractionGuards(panel) {
        const tryAttach = () => {
            const el = panel?.element;
            if (!el) return requestAnimationFrame(tryAttach);
            const stop = (e) => e.stopPropagation();
            ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "contextmenu", "wheel", "focusin", "focusout", "blur", "keydown", "keyup"].forEach((type) => {
                el.addEventListener(type, stop, { capture: false });
            });
        };
        requestAnimationFrame(tryAttach);
    },

    /**
     * Cap a flyout panel's height and let it scroll instead of growing without bound - rmss can
     * have a lot of skill categories (~59 possible), and category headers are always shown (only
     * the skill tiles within an open category hide/show), so a well-rounded character could end
     * up with a very tall header list. Argon's own ButtonPanel overflow behavior isn't confirmed,
     * so this sets it directly rather than relying on it.
     * @param {ButtonPanel} panel
     * @param {number} [maxHeightVh=70]
     */
    capPanelHeight(panel, maxHeightVh = 70) {
        const tryCap = () => {
            const el = panel?.element;
            if (!el) return requestAnimationFrame(tryCap);
            el.style.maxHeight = `${maxHeightVh}vh`;
            el.style.overflowY = "auto";
            el.style.overflowX = "hidden";
        };
        requestAnimationFrame(tryCap);
    },
};

// -----------------------------------------------------------------------------
// General Search Feature (Reusable)
// -----------------------------------------------------------------------------

/** In-memory per-panel filter/accordion state (no actor data - pure UI state). */
const _filterState = new Map();
const _openCategoryState = new Map();

function setFilterActive(panelId, filterId, active) {
    const s = _filterState.get(panelId) || {};
    s[filterId] = active;
    _filterState.set(panelId, s);
}
function getFilterActive(panelId, filterId) {
    return !!_filterState.get(panelId)?.[filterId];
}
function clearAllFilters(panelId) {
    _filterState.delete(panelId);
}
function getOpenCategory(key) {
    return _openCategoryState.get(key) ?? null;
}
function setOpenCategory(key, value) {
    _openCategoryState.set(key, value);
}

/**
 * Installs a general-purpose search/filter bar onto a panel.
 * @param {ButtonPanel} panel
 * @param {string} tileSelector
 * @param {string} headerSelector
 * @param {string} logPrefix
 * @param {object} [options]
 * @param {Array<object>} [options.filters=[]]
 * @param {function} [options.onClear=null]
 */
function installListSearch(panel, tileSelector, headerSelector, logPrefix, options = {}) {
    const { filters = [], onClear = null } = options;
    const panelId = panel.id;
    if (!panelId) {
        console.error("[ECH-RMSS] installListSearch failed: Panel has no 'id' property.", panel);
        return;
    }

    let tiles = [];
    let headers = [];

    const filter = (text) => {
        const terms = text.normalize("NFKC").trim().toLowerCase().split(" ").filter(Boolean);
        const bar = panel?.element?.querySelector(".rmss-search-bar");
        if (!bar) return;

        const summaryEl = bar.querySelector(".rmss-search-summary");
        const activeFilters = filters.filter((f) => bar.querySelector(`#rmss-filter-${panelId}-${f.id}`)?.classList.contains("active"));
        const isFiltered = terms.length > 0 || activeFilters.length > 0;

        if (!isFiltered) {
            if (typeof onClear === "function") onClear(panel.element);
            else {
                tiles.forEach((tile) => (tile.style.display = ""));
                showHeaders(tiles, headers);
                if (summaryEl) summaryEl.style.display = "none";
            }
            return;
        }

        const visibleTiles = [];
        tiles.forEach((tile) => {
            const name = tile.dataset.nameNorm || "";
            const textMatch = terms.every((t) => name.includes(t));
            const filterMatch = activeFilters.every((f) => tile.dataset[f.dataKey] === "true");
            const isVisible = textMatch && filterMatch;

            tile.style.display = isVisible ? "" : "none";
            if (isVisible) visibleTiles.push(tile);
        });

        showHeaders(visibleTiles, headers);

        if (summaryEl) {
            summaryEl.textContent = `Showing ${visibleTiles.length} of ${tiles.length}`;
            summaryEl.style.display = "";
        }
    };

    const showHeaders = (visibleTiles, headers) => {
        headers.forEach((h) => {
            const key = h.dataset.catKey || h.dataset.listTypeKey || h.dataset.listNameKey;
            if (!key) {
                h.style.display = "";
                return;
            }
            const hasVisibleChild = visibleTiles.some((t) => t.dataset.catKey === key || t.dataset.listNameKey === key || t.dataset.listTypeKey === key);
            h.style.display = hasVisibleChild ? "" : "none";
        });
    };

    const waitAndMount = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(waitAndMount);

        tiles = Array.from(el.querySelectorAll(tileSelector));
        if (!tiles.length) return requestAnimationFrame(waitAndMount);
        if (el.querySelector(".rmss-search-bar")) return;

        headers = Array.from(el.querySelectorAll(headerSelector));

        const searchBar = document.createElement("div");
        searchBar.className = "rmss-search-bar";

        const search = document.createElement("input");
        search.className = "rmss-search-input";
        search.type = "text";
        search.placeholder = "Filter...";
        search.dataset.argonInputGuard = "true";

        search.addEventListener("keydown", (e) => e.stopPropagation(), true);
        search.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    filter(search.value);
                }
            },
            true,
        );

        const searchIcon = document.createElement("a");
        searchIcon.className = "rmss-search-icon";
        searchIcon.innerHTML = `<img src="${ICONS.search}" alt="Search" style="-webkit-mask-image: url('${ICONS.search}'); mask-image: url('${ICONS.search}');">`;
        searchIcon.addEventListener("click", (e) => {
            e.preventDefault();
            filter(search.value);
        });

        const clearBtn = document.createElement("a");
        clearBtn.className = "rmss-search-clear rmss-filter-button";
        clearBtn.title = "Clear search and filters";
        clearBtn.innerHTML = `<img src="${ICONS.close}" alt="Clear" style="-webkit-mask-image: url('${ICONS.close}'); mask-image: url('${ICONS.close}');">`;

        const filterContainer = document.createElement("div");
        filterContainer.className = "rmss-search-filters";

        for (const f of filters) {
            const btn = document.createElement("a");
            const btnId = `rmss-filter-${panelId}-${f.id}`;
            btn.className = "rmss-filter-button";
            btn.id = btnId;
            btn.title = f.tooltip;
            btn.innerHTML = `<img src="${f.icon}" alt="${f.tooltip}" style="-webkit-mask-image: url('${f.icon}'); mask-image: url('${f.icon}');">`;
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const isActive = e.currentTarget.classList.toggle("active");
                setFilterActive(panelId, f.id, isActive);
                filter(search.value);
            });
            filterContainer.appendChild(btn);
        }

        clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            search.value = "";
            clearAllFilters(panelId);
            filterContainer.querySelectorAll(".rmss-filter-button").forEach((b) => b.classList.remove("active"));
            filter("");
        });

        const summaryText = document.createElement("div");
        summaryText.className = "rmss-search-summary";
        summaryText.style.display = "none";

        searchBar.appendChild(filterContainer);
        searchBar.appendChild(search);
        searchBar.appendChild(searchIcon);
        searchBar.appendChild(clearBtn);
        searchBar.appendChild(summaryText);

        el.prepend(searchBar);
    };

    requestAnimationFrame(waitAndMount);
}

// -----------------------------------------------------------------------------
// Core Argon Definitions
// -----------------------------------------------------------------------------

function defineTooltip(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const BaseTooltip = ARGON?.CORE?.Tooltip || ARGON?.HUD?.Tooltip || ARGON?.Tooltip;

    if (!BaseTooltip) {
        console.warn("[ECH-RMSS] Argon CORE.Tooltip base class not found; skipping custom tooltip.");
        return;
    }

    class RMSSTooltip extends BaseTooltip {
        get classes() {
            return [...super.classes, "rmss"];
        }
    }

    CoreHUD.defineTooltip(RMSSTooltip);
}

function defineSupportedActorTypes(CoreHUD) {
    CoreHUD.defineSupportedActorTypes(["character", "npc", "creature"]);
}

/**
 * Foundry's settings config form saves every field it renders, not just the changed ones - so
 * opening "Configure Settings" and clicking Save once persists icon_main_ranged/icon_main_natural
 * with whatever default was current at the time, permanently shadowing later code-default
 * changes. Re-point a stored value to the new default only when it still exactly matches the OLD
 * default (i.e. the GM never actually customized it away from default).
 */
const RETIRED_ICON_DEFAULTS = {
    ranged: MOD_ICON("ranged.svg"),
    natural: MOD_ICON("natural.svg"),
    equipment: MOD_ICON("melee.svg"),
    // "items" was briefly, mistakenly, defaulted to potion-ball.svg (that belongs to the new
    // "magic" subcategory icon instead) - revert anyone who already reloaded on that default.
    items: MOD_ICON("potion-ball.svg"),
    consumables: MOD_ICON("instant.svg"),
};

/**
 * updateVisibility() alone doesn't reliably re-render a panel/button whose state flipped (e.g. an
 * equip toggle) - confirmed by testing: it only reappears/refreshes after a full deselect/reselect
 * of the token. Force a real rebind of whatever's currently bound instead, which is exactly what
 * that manual reselect does. Shared by main.js's updateCombat/deleteCombat hooks and by any HUD
 * action (equip, consume...) that needs its own visible state to update immediately.
 */
function refreshHud() {
    const token = ui.ARGON?._token;
    if (token) ui.ARGON?.bind?.(token);
    else ui.ARGON?.components?.main?.forEach((c) => c.updateVisibility?.());
}

function migrateIconDefaults() {
    if (!game.user?.isGM) return;
    for (const [key, oldDefault] of Object.entries(RETIRED_ICON_DEFAULTS)) {
        const settingKey = `icon_main_${key}`;
        const current = game.settings.get(MODULE_ID, settingKey);
        if (current === oldDefault && ICON_CONFIG[key]?.default !== oldDefault) {
            game.settings.set(MODULE_ID, settingKey, ICON_CONFIG[key].default);
        }
    }
}

export {
    ICONS,
    getUserIcon,
    RMSSUtils,
    UIGuards,
    installListSearch,
    formatBonus,
    debounce,
    defineTooltip,
    defineSupportedActorTypes,
    registerIconSettings,
    migrateIconDefaults,
    getFilterActive,
    setFilterActive,
    clearAllFilters,
    getOpenCategory,
    setOpenCategory,
    refreshHud,
    MODULE_ID,
    SYS_PATH,
};
