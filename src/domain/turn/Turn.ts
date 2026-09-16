import { Player } from "../player/Player.ts";
import type { TokenAmounts } from "../player/Player.ts";
import { ResourceAcquisition } from "../resource/ResourceAcquisition.ts";
import type { AcquisitionChoice, AcquisitionDisclosure } from "../resource/ResourceAcquisition.ts";

export type TurnPhase = "AWAITING_ACQUISITION" | "AFTER_ACQUISITION" | "ENDED";

export interface PublicTurnState {
  readonly playerId: string;
  readonly phase: TurnPhase;
  readonly acquisition: AcquisitionDisclosure | null;
}

/** Acquisition/end-turn slice; attack, purchase and maintenance are not connected yet. */
export class Turn {
  readonly #player: Player;
  #phase: TurnPhase = "AWAITING_ACQUISITION";
  #acquisition: AcquisitionDisclosure | null = null;

  constructor(player: Player) {
    this.#player = player;
  }

  publicState(): PublicTurnState {
    return Object.freeze({
      playerId: this.#player.playerId,
      phase: this.#phase,
      acquisition: this.#acquisition,
    });
  }

  acquire(playerId: string, choice: AcquisitionChoice): AcquisitionDisclosure {
    this.#assertActorAndPhase(playerId, "AWAITING_ACQUISITION");
    const acquisition = new ResourceAcquisition(choice);
    this.#player.acquireTokens(acquisition.tokens, acquisition.publicResources);
    this.#acquisition = acquisition.disclosure;
    this.#phase = "AFTER_ACQUISITION";
    return this.#acquisition;
  }

  end(playerId: string, discard?: TokenAmounts): PublicTurnState {
    this.#assertActorAndPhase(playerId, "AFTER_ACQUISITION");
    if (discard !== undefined) this.#player.discardExcessTokens(discard);
    this.#player.assertCanEndTurn();
    this.#phase = "ENDED";
    return this.publicState();
  }

  #assertActorAndPhase(playerId: string, phase: TurnPhase): void {
    if (playerId !== this.#player.playerId) throw new Error("Not the active player");
    if (this.#phase !== phase) throw new Error("Action is not allowed in the current turn phase");
  }
}
