import { Player } from "../domain/player/Player.ts";
import type { PlayerInitialState, TokenAmounts } from "../domain/player/Player.ts";
import type { ResourceSnapshot } from "../domain/resource/ResourceType.ts";
import type { AcquisitionChoice, AcquisitionDisclosure } from "../domain/resource/ResourceAcquisition.ts";
import { Turn } from "../domain/turn/Turn.ts";
import type { PublicTurnState } from "../domain/turn/Turn.ts";
import { sumCounts } from "../domain/shared/count.ts";

export interface PlayerSetup extends PlayerInitialState {
  readonly playerId: string;
}

export interface PublicPlayerState {
  readonly playerId: string;
  readonly score: number;
  readonly livestockCount: number;
}

export interface PrivatePlayerState extends PublicPlayerState {
  readonly basicResources: ResourceSnapshot;
  readonly totalTokens: number;
  readonly excessTokens: number;
}

export interface PublicTurnManagerState {
  readonly turnNumber: number;
  readonly round: number;
  readonly currentTurn: PublicTurnState;
  readonly players: readonly PublicPlayerState[];
}

/** Uses the caller-supplied player order; does not select a starting player. */
export class TurnManager {
  readonly #players: readonly Player[];
  #currentPlayerIndex = 0;
  #turnNumber = 1;
  #round = 1;
  #turn: Turn;

  constructor(setup: readonly PlayerSetup[]) {
    if (!Array.isArray(setup) || setup.length < 2 || setup.length > 6) {
      throw new RangeError("A turn manager requires 2 to 6 players");
    }
    const players = Array.from(setup, entry => new Player(entry.playerId, entry));
    if (new Set(players.map(player => player.playerId)).size !== players.length) {
      throw new Error("Player IDs must be unique");
    }
    this.#players = players;
    this.#turn = new Turn(players[0]!);
  }

  publicState(): PublicTurnManagerState {
    return Object.freeze({
      turnNumber: this.#turnNumber,
      round: this.#round,
      currentTurn: this.#turn.publicState(),
      players: Object.freeze(this.#players.map(player => Object.freeze({
        playerId: player.playerId,
        score: player.score,
        livestockCount: player.livestockCount,
      }))),
    });
  }

  /** Trusted engine/owner view. Network callers need separate authentication. */
  privatePlayerState(playerId: string): PrivatePlayerState {
    const player = this.#players.find(candidate => candidate.playerId === playerId);
    if (!player) throw new Error("Unknown player");
    return Object.freeze({
      playerId: player.playerId,
      score: player.score,
      livestockCount: player.livestockCount,
      basicResources: player.basicResources,
      totalTokens: player.totalTokens,
      excessTokens: player.excessTokens,
    });
  }

  acquire(playerId: string, choice: AcquisitionChoice): AcquisitionDisclosure {
    return this.#turn.acquire(playerId, choice);
  }

  endTurn(playerId: string, discard?: TokenAmounts): PublicTurnState {
    const nextIndex = (this.#currentPlayerIndex + 1) % this.#players.length;
    const nextTurnNumber = sumCounts(this.#turnNumber, 1);
    const nextRound = sumCounts(this.#round, nextIndex === 0 ? 1 : 0);
    const ended = this.#turn.end(playerId, discard);
    this.#currentPlayerIndex = nextIndex;
    this.#turnNumber = nextTurnNumber;
    this.#round = nextRound;
    this.#turn = new Turn(this.#players[nextIndex]!);
    return ended;
  }
}
