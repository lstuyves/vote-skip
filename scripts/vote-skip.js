import { MODULE_ID, SOCKET_NAME } from "./constants.js";
import { registerHooks } from "./hooks.js";
import { registerSockets } from "./socket.js";
import { registerUI } from "./ui.js";

class VoteSkipManager {

    constructor() {
        console.log(`${MODULE_ID} | Manager created.`);
    }

    async initializeCombat(combat) {
        if (!combat)
            return;

        const participants = combat.combatants.filter(c =>
            c.actor && c.players.length > 0
        );

        const votes = {};

        for (const combatant of participants) {
            votes[combatant.id] = false;
        }

        await combat.setFlag(MODULE_ID, "votes", votes);
        await combat.setFlag(MODULE_ID, "enabled", true);
        await combat.setFlag(MODULE_ID, "completed", false);

        console.log(`${MODULE_ID} | Initialized votes for Combat ${combat.id}`);
    }

    async cleanupCombat(combat) {
        if (!combat)
            return;

        await combat.unsetFlag(MODULE_ID, "votes");
        await combat.unsetFlag(MODULE_ID, "enabled");
        await combat.unsetFlag(MODULE_ID, "completed");

        console.log(`${MODULE_ID} | Cleared votes for Combat ${combat.id}`);
    }

    async onCombatantCreated(combatant) {
        const combat = combatant.combat;

        if (!combat.started)
            return;

        if (!combatant.players.length)
            return;

        const votes = combat.getFlag(MODULE_ID, "votes") ?? {};

        votes[combatant.id] = false;

        await combat.setFlag(MODULE_ID, "votes", votes);
    }

    async onCombatantDeleted(combatant) {
        const combat = combatant.combat;

        const votes = combat.getFlag(MODULE_ID, "votes") ?? {};

        delete votes[combatant.id];

        await combat.setFlag(MODULE_ID, "votes", votes);
    }

    /**
     * Toggle the current user's vote
     */
    async toggleVote(combatantId) {
        const combat = game.combat;
        if (!combat) {
            ui.notifications.warn("No active combat.");
            return;
        }

        const state = this.getState(combat);
        if (!state.enabled) {
            ui.notifications.warn("Voting is disabled for this encounter.");
            return;
        }

        const combatant = this.getPlayerCombatant(combatantId);
        if (!combatant) {
            ui.notifications.warn("You do not have a participating character in this encounter.");
            return;
        }

        const votes = foundry.utils.duplicate(state.votes)
        votes[combatantId] = !votes[combatantId];

        // if a vote is toggled off, toggle off completed flag as well
        if (!votes[combatantId]) {
            await combat.setFlag(MODULE_ID, "completed", false);
        }

        await this.updateVotes(votes);

        Hooks.call("voteSkipVoteChanged", combat, votes);

        if (this.isComplete()) {
            await this.completeVote();
        }
    }

    requestToggleVote(combatantId) {
        game.socket.emit(
            SOCKET_NAME,
            {
                type: "toggleVote",
                combatantId: combatantId
            }
        );

    }

    /**
     * Clears all votes
     */
    async clearVotes() {
        const combat = game.combat;
        if (!combat)
            return;

        const votes = {};
        for (const combatant of this.getParticipants()) {
            votes[combatant.id] = false;
        }

        await this.updateVotes(votes);

        Hooks.call("voteSkipCleared", combat);
    }

    /**
     * Set enabled/disabled state
     */
    async setEnabled(state) {
        const combat = game.combat;

        if (!combat)
            return;

        await combat.setFlag(MODULE_ID, "enabled", state);
    }

    /**
     * Enable voting
     */
    async enable() {
        this.setEnabled(true);
        Hooks.call("voteSkipEnabled", combat);
    }

    /**
     * Disable voting
     */
    async disable() {
        this.setEnabled(false);
        Hooks.call("voteSkipDisabled", combat);
    }

    isEnabled() {
        return game.combat?.getFlag(MODULE_ID, "enabled") ?? false;
    }

    async toggleEnabled() {
        return this.setEnabled(!this.isEnabled());
    }

    /**
     * Returns all player-controlled combatants
     */
    getParticipants() {
        const combat = game.combat;

        if (!combat) {
            console.log(`${MODULE_ID} | There is no combat`);
            return [];
        }

        return combat.combatants.filter(c => {
            return c.actor && c.players.length > 0;
        });
    }

    /**
     * Find current user's combatant
     */
    getPlayerCombatant(combatantId) {
        return this.getParticipants().find(c => c.id === combatantId);
    }

    /**
     * Confirm combatant ownership
     */
    confirmCombatantOwnership(userId, combatantId) {
        const combatant = this.getPlayerCombatant(combatantId);

        return combatant.players.some(player => player.id === userId || player.character?.ownership?.[userId] !== undefined);
    }

    /**
     * Get stored vote state
     */
    getState(combat = game.combat) {
        if (!combat)
            return {
                enabled: false,
                votes: {}
            };

        return {
            enabled: combat.getFlag(MODULE_ID, "enabled") ?? true,
            votes: combat.getFlag(MODULE_ID, "votes") ?? {}
        };
    }

    /**
     * Update votes on combat document
     */
    async updateVotes(votes) {
        await game.combat.setFlag(MODULE_ID, "votes", votes);
    }

    /**
     * Check unanimous vote
     */
    isComplete() {
        const participants = this.getParticipants();

        if (!participants.length)
            return false;

        const state = this.getState();

        return participants.every(c => {
            return state.votes[c.id] === true;
        });
    }

    /**
     * Handle completed vote
     */
    async completeVote() {
        const combat = game.combat;

        if (combat.getFlag(MODULE_ID, "completed")) {
            return;
        }

        await combat.setFlag(MODULE_ID, "completed", true);

        // Hooks.call("voteSkipCompleted", combat);

        if (game.user.isGM) {
            ChatMessage.create({
                content: `
                    <strong>Vote Skip Complete</strong><br>
                    All participating players have voted
                    to skip this encounter.
                    `
            });
        }
    }

    /**
     * Get vote count
     */
    voteCount() {
        const state = this.getState();
        return Object.values(state.votes)
            .filter(v => v)
            .length;
    }

    /**
     * Check if combatant voted
     */
    hasVoted(combatantId) {
        const state = this.getState();
        return state.votes[combatantId] === true;
    }
}

Hooks.once("init", () => {
    console.log(`${MODULE_ID} | Initializing`);
    game.voteSkip = new VoteSkipManager();
});

Hooks.once("ready", () => {
    registerHooks();
    registerSockets();
    registerUI();
});