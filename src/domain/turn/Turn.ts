import { BasicAttackResolver } from "../combat/BasicAttackResolver.ts";
import type { BasicAttackTarget, BasicAttackResult } from "../combat/BasicAttackResolver.ts";
import { Player } from "../player/Player.ts";
import type { TokenAmounts } from "../player/Player.ts";
import { ResourceAcquisition } from "../resource/ResourceAcquisition.ts";
import type { AcquisitionChoice, AcquisitionDisclosure } from "../resource/ResourceAcquisition.ts";

export type TurnPhase = "AWAITING_ACQUISITION" | "AFTER_ACQUISITION" | "ENDED";

export interface PublicTurnState {
  readonly playerId: string;
  readonly phase: TurnPhase;
  readonly acquisition: AcquisitionDisclosure | null;
  /** Timing/frequency only; FIRE holdings are checked when an attack is requested. */
  readonly attackAvailable: boolean;
  readonly attack: BasicAttackResult | null;
}

/** Normal attack, acquisition and end-turn slice; skills and later phases are not connected yet. */
export class Turn {
  readonly #player: Player;
  readonly #attackResolver = new BasicAttackResolver();
  #attack: BasicAttackResult | null = null;
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
      attackAvailable: this.#phase === "AWAITING_ACQUISITION" && this.#attack === null,
      attack: this.#attack,
    });
  }

  attack(playerId: string, defender: Player, target: BasicAttackTarget): BasicAttackResult {
    this.#assertActorAndPhase(playerId, "AWAITING_ACQUISITION");
    if (this.#attack !== null) throw new Error("Attack opportunity already used");
    const result = this.#attackResolver.resolve(this.#player, defender, target);
    this.#attack = result;
    return result;
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
