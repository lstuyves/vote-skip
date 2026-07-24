import { MODULE_ID } from "./constants.js";

export function registerHooks() {
    Hooks.on("combatStart", async combat => {
        game.voteSkip.initializeCombat(combat);
    });

    Hooks.on("deleteCombat", async combat => {
        game.voteSkip.cleanupCombat(combat);
    });

    Hooks.on("createCombatant", async combatant => {
        game.voteSkip.onCombatantCreated(combatant);
    });

    Hooks.on("deleteCombatant", async combatant => {
        game.voteSkip.onCombatantDeleted(combatant);
    });

    Hooks.on("updateCombat", async (combat, changes) => {
        if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.votes`)) {
            Hooks.call("voteSkipRefresh");
        }
    });
}