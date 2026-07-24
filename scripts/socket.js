import { MODULE_ID, SOCKET_NAME } from "./constants.js";

export function registerSockets() {
    game.socket.on(
        SOCKET_NAME,
        async data => {
            if (!game.user.isGM)
                return;

            console.log(`${MODULE_ID} | GM processing request`);
            switch (data.type) {
                case "toggleVote":
                    await game.voteSkip.toggleVote(data.combatantId);
                    break;
                case "clearVotes":
                    await game.voteSkip.clearVotes();
                    break;
            }
        }
    );
}