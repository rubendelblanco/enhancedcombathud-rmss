/**
 * RMSSData.js
 *
 * Data-read layer for the RMSS HUD panels. Deliberately simpler than RMU's RMUData.js: rmss
 * doesn't pre-aggregate a derived `_attacks`/`_skills`/`_spells` array on the actor the way RMU
 * does, so this just reads the actor's own embedded Items directly (weapon/creature_attack,
 * skill, spell/spell_list) - the same data every existing RMSS sheet already renders from.
 */

import { SYS_PATH } from "./RMSSCore.js";

/**
 * @returns {Token|null} the token currently bound to the HUD
 */
function getActiveToken() {
    return ui.ARGON?._token ?? null;
}

/**
 * @returns {Actor|null} the actor currently bound to the HUD
 */
function getActiveActor() {
    return ui.ARGON?._actor ?? null;
}

// -----------------------------------------------------------------------------
// Attacks
// -----------------------------------------------------------------------------

/**
 * @param {Actor} actor
 * @returns {Item[]} equipped weapons + all creature_attack items (always "equipped")
 */
function getEquippedAttacks(actor) {
    if (!actor) return [];
    return actor.items.filter((i) => (i.type === "weapon" && i.system?.equipped === true) || i.type === "creature_attack");
}

/**
 * @param {Item} item weapon or creature_attack
 * @returns {"melee"|"ranged"|"natural"}
 */
function bucketAttack(item) {
    if (item.type === "creature_attack") return "natural";
    if (item.system?.isNaturalWeapon) return "natural";
    if (item.system?.type === "mis") return "ranged";
    return "melee";
}

/**
 * @param {Actor} actor
 * @returns {Map<"melee"|"ranged"|"natural", Item[]>} non-empty buckets only, in melee/ranged/natural order
 */
function getGroupedAttacks(actor) {
    const order = ["melee", "ranged", "natural"];
    const buckets = new Map();
    for (const item of getEquippedAttacks(actor)) {
        const key = bucketAttack(item);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
    }
    for (const list of buckets.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    const sorted = new Map();
    for (const key of order) {
        if (buckets.has(key)) sorted.set(key, buckets.get(key));
    }
    return sorted;
}

/**
 * All weapons the actor owns (not just equipped ones), for the equip-toggle panel.
 * @param {Actor} actor
 * @returns {Item[]}
 */
function getAllWeapons(actor) {
    if (!actor) return [];
    return actor.items.filter((i) => i.type === "weapon" && !i.system?.isNaturalWeapon);
}

// -----------------------------------------------------------------------------
// Skills
// -----------------------------------------------------------------------------

/**
 * @param {Actor} actor
 * @returns {Item[]}
 */
function getAllSkills(actor) {
    if (!actor) return [];
    return actor.items.filter((i) => i.type === "skill");
}

/**
 * @param {Actor} actor
 * @param {Item} skillItem
 * @returns {string}
 */
function getSkillCategoryName(actor, skillItem) {
    const catId = skillItem.system?.category;
    const cat = catId ? actor.items.get(catId) : null;
    return cat?.name ?? "Other";
}

/**
 * @param {Actor} actor
 * @returns {Map<string, Item[]>} skills grouped by category name, categories sorted alphabetically,
 *   skills within a category sorted alphabetically
 */
function getGroupedSkills(actor) {
    const skills = getAllSkills(actor);
    const byCategory = new Map();
    for (const skill of skills) {
        const catName = getSkillCategoryName(actor, skill);
        if (!byCategory.has(catName)) byCategory.set(catName, []);
        byCategory.get(catName).push(skill);
    }
    for (const list of byCategory.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return new Map([...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/**
 * @param {Actor} actor
 * @returns {Item[]} skills flagged favorite, sorted alphabetically
 */
function getFavoriteSkills(actor) {
    return getAllSkills(actor)
        .filter((s) => s.system?.favorite === true)
        .sort((a, b) => a.name.localeCompare(b.name));
}

// -----------------------------------------------------------------------------
// Spells
// -----------------------------------------------------------------------------

/**
 * @param {Actor} actor
 * @returns {Item[]}
 */
function getSpellLists(actor) {
    if (!actor) return [];
    return actor.items.filter((i) => i.type === "spell_list");
}

/**
 * Spells contained in a spell_list use the same container-flag mechanism as every other
 * container item in rmss (see ContainerHandler / item_service.js `deleteContainer`), not a
 * nested array - spell_list.system.spells stays empty on this codebase's actual data.
 *
 * Capped to the list's currently-accessible level, same rule as every RMSS sheet: for a
 * character, the linked skill's ranks; for an NPC/creature, the list's own flags.rmss.listLevel
 * (falling back to the actor's level) - see ItemService.getSpellListMaxLevel. A caster with,
 * say, 5 ranks in "Fire Law" only has levels 1-5 of that list actually available to them, even
 * though every level up to 50 exists as an embedded Item on the actor.
 * @param {Actor} actor
 * @param {Item} spellListItem
 * @returns {Promise<Item[]>} sorted by level then name
 */
async function getSpellsInList(actor, spellListItem) {
    if (!actor || !spellListItem) return [];
    const { default: ItemService } = await import(SYS_PATH("module/actors/services/item_service.js"));
    const maxLevel = ItemService.getSpellListMaxLevel(actor, spellListItem);
    return actor.items
        .filter((i) => i.type === "spell" && i.flags?.rmss?.containerId === spellListItem.id)
        .filter((i) => (parseInt(i.system?.level, 10) || 0) <= maxLevel)
        .sort((a, b) => (Number(a.system?.level) || 0) - (Number(b.system?.level) || 0) || a.name.localeCompare(b.name));
}

/**
 * @param {Actor} actor
 * @returns {Promise<Map<string, { list: Item, spells: Item[] }>>} keyed by spell_list item id, empty lists omitted
 */
async function getGroupedSpells(actor) {
    const grouped = new Map();
    for (const list of getSpellLists(actor)) {
        const spells = await getSpellsInList(actor, list);
        if (spells.length === 0) continue;
        grouped.set(list.id, { list, spells });
    }
    return grouped;
}

/**
 * @param {Actor} actor
 * @returns {Promise<Array<{ spell: Item, list: Item }>>} favorite spells (within the list's
 *   currently-accessible level) with their owning spell_list, sorted by level then name
 */
async function getFavoriteSpells(actor) {
    const out = [];
    for (const { list, spells } of (await getGroupedSpells(actor)).values()) {
        for (const spell of spells) {
            if (spell.system?.favorite === true) out.push({ spell, list });
        }
    }
    out.sort((a, b) => (Number(a.spell.system?.level) || 0) - (Number(b.spell.system?.level) || 0) || a.spell.name.localeCompare(b.spell.name));
    return out;
}

// -----------------------------------------------------------------------------
// Portrait / resources
// -----------------------------------------------------------------------------

/**
 * @param {Actor} actor
 * @returns {{ current: number, max: number }}
 */
function getHits(actor) {
    const h = actor?.system?.attributes?.hits ?? {};
    return { current: Number(h.current) || 0, max: Number(h.max) || 0 };
}

/**
 * @param {Actor} actor
 * @returns {{ current: number, max: number }}
 */
function getPowerPoints(actor) {
    const pp = actor?.system?.attributes?.power_points ?? {};
    return { current: Number(pp.current) || 0, max: Number(pp.max) || 0 };
}

/**
 * character and npc have a level attribute; creature does not.
 * @param {Actor} actor
 * @returns {number|null}
 */
function getLevel(actor) {
    const v = actor?.system?.attributes?.level?.value;
    return v === undefined || v === null ? null : Number(v);
}

/**
 * Movement rate is character-only.
 * @param {Actor} actor
 * @returns {{ current: number, effective: number, base: number }|null}
 */
function getMovementRate(actor) {
    const m = actor?.system?.attributes?.movement_rate;
    if (!m) return null;
    const base = Number(m.value) || 0;
    return {
        current: Number(m.current) || 0,
        effective: Number(m.effective_value ?? base) || 0,
        base,
    };
}

export const RMSSData = {
    getActiveToken,
    getActiveActor,
    getEquippedAttacks,
    bucketAttack,
    getGroupedAttacks,
    getAllWeapons,
    getAllSkills,
    getSkillCategoryName,
    getGroupedSkills,
    getFavoriteSkills,
    getSpellLists,
    getSpellsInList,
    getGroupedSpells,
    getFavoriteSpells,
    getHits,
    getPowerPoints,
    getLevel,
    getMovementRate,
};
