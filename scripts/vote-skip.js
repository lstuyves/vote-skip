const MODULE_ID = "vote-skip";

Hooks.once("init", () => {
    console.log(`${MODULE_ID} | Initializing`);
    game.voteSkip = {

        /**
         * Toggle the current user's vote
         */
        async toggleVote() {
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

            const combatant = this.getPlayerCombatant();
            if (!combatant) {
                ui.notifications.warn(
                    "You do not have a participating character in this encounter."
                );
                return;
            }

            const actorId = combatant.actor.id;
            const votes = foundry.utils.duplicate(state.votes)
            votes[actorId] = !votes[actorId];
            await this.updateVotes(votes);

            Hooks.call("voteSkipVoteChanged", combat, votes);

            if (this.isComplete()) {
                await this.completeVote();
            }
        },

        /**
         * Clears all votes
         */
        async clearVotes() {
            const combat = game.combat;
            if (!combat)
                return;

            const votes = {};
            for (const combatant of this.getParticipants()) {
                votes[combatant.actor.id] = false;
            }

            await this.updateVotes(votes);

            Hooks.call("voteSkipCleared", combat);
        },

        /**
         * Enable voting
         */
        async enable() {
            const combat = game.combat;

            if (!combat)
                return;

            await combat.setFlag(MODULE_ID, "enabled", true);

            Hooks.call("voteSkipEnabled", combat);
        },

        /**
         * Disable voting
         */
        async disable() {
            const combat = game.combat;

            if (!combat)
                return;

            await combat.setFlag(MODULE_ID, "enabled", false);

            Hooks.call("voteSkipDisabled", combat);
        },


        /**
         * Returns all player-controlled combatants
         */
        getParticipants() {
            const combat = game.combat;

            if (!combat)
                return [];

            return combat.combatants.filter(c => {
                return (
                    c.actor &&
                    c.players.length > 0
                );
            });
        },

        /**
         * Find current user's combatant
         */
        getPlayerCombatant() {
            return this.getParticipants().find(c => {
                return c.players.includes(
                    game.user.id
                );
            });
        },

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

        },

        /**
         * Update votes on combat document
         */
        async updateVotes(votes) {
            await game.combat.setFlag(MODULE_ID, "votes", votes);
        },

        /**
         * Check unanimous vote
         */
        isComplete() {
            const participants = this.getParticipants();

            if (!participants.length)
                return false;

            const state = this.getState();

            return participants.every(c => {
                return state.votes[c.actor.id] === true;
            });
        },

        /**
         * Handle completed vote
         */
        async completeVote() {
            const combat = game.combat;

            if (combat.getFlag(MODULE_ID, "completed")) {
                return;
            }

            await combat.setFlag(MODULE_ID, "completed", true);

            Hooks.call("voteSkipCompleted", combat);

            if (game.user.isGM) {
                ChatMessage.create({
                    content: `
                        <strong>Vote Skip Complete</strong><br>
                        All participating players have voted
                        to skip this encounter.
                        `
                });
            }
        },

        /**
         * Get vote count
         */
        voteCount() {
            const state = this.getState();
            return Object.values(state.votes)
                .filter(v => v)
                .length;
        },

        /**
         * Check if actor voted
         */
        hasVoted(actorId) {
            const state = this.getState();
            return state.votes[actorId] === true;
        }
    };
});