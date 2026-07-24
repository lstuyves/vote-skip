function refreshVoteSkip() {
    ui.combat.render(true);

    for (const app of Object.values(ui.windows)) {
        if (app instanceof CombatTracker) {
            app.render(true);
        }
    }
}

export function registerUI() {
    Hooks.on("renderCombatTracker", (app, html, data) => {

        const combat = game.combat;
        if (!combat || !combat.started)
            return;

        const participants = game.voteSkip.getParticipants();
        if (!participants.length)
            return;

        // Avoid duplicate rendering
        html.querySelector(".vote-skip-container")?.remove();

        const container = document.createElement("div");
        container.classList.add("vote-skip-container");

        container.innerHTML = `
            <div class="vote-skip-title">
                <span>Vote Skip</span>
            </div>
            <div class="vote-skip-portraits">
            </div>
        `;

        const portraitContainer = container.querySelector(".vote-skip-portraits");

        const lockButton = document.createElement("i");
        lockButton.classList.add(
            "fas",
            game.voteSkip.isEnabled() ? "fa-lock-open" : "fa-lock",
            "vote-skip-lock"
        );
        lockButton.title = game.user.isGM
            ? (game.voteSkip.isEnabled() ? "Disable Voting" : "Enable Voting")
            : (game.voteSkip.isEnabled() ? "Voting Enabled" : "Voting Disabled");

        lockButton.addEventListener("click", async event => {
            event.stopPropagation();
            if (game.user.isGM) {
                await game.voteSkip.toggleEnabled();
            } else {
                ui.notifications.warn("Only the GM can enable/disable voting.");
            }
        });

        const title = container.querySelector(".vote-skip-title");
        title.appendChild(lockButton);

        for (const combatant of participants) {
            const actor = combatant.actor;
            const voted = game.voteSkip.hasVoted(combatant.id);
            const img = document.createElement("img");

            img.src = actor.img;
            img.classList.add("vote-skip-portrait");

            if (voted)
                img.classList.add("voted");

            img.dataset.combatantId = combatant.id;

            img.title =`${actor.name}: ${voted ? "Ready" : "Not Ready"}`;

            img.addEventListener(
                "click",
                async () => {

                    if (img.dataset.pending === "true") {
                        return;
                    }

                    const targetCombatantId = img.dataset.combatantId;
                    if (!targetCombatantId)
                        return;

                    if (!game.user.isGM && !game.voteSkip.isEnabled()) {
                        ui.notifications.warn("Vote Skip is currently disabled.");
                        return;
                    }

                    img.dataset.pending = "true";

                    try {
                        if (game.user.isGM) {
                            await game.voteSkip.toggleVote(targetCombatantId);
                        } else {
                            if (game.voteSkip.confirmCombatantOwnership(game.user.id, targetCombatantId)) {
                                await game.voteSkip.requestToggleVote(targetCombatantId);
                            }
                        }
                    } finally {
                        img.dataset.pending = "false"
                    }
                }
            );
            portraitContainer.appendChild(img);
        }

        // Put beneath combat controls
        const footer = html.querySelector(".combat-controls");
        
        if (footer) {
            footer.before(container);
        }
    });

    Hooks.on("voteSkipRefresh", refreshVoteSkip);
}