import { Player } from "../player/Player.ts";
import type { ResourceAmounts } from "../resource/ResourceType.ts";
import { Market } from "./Market.ts";
import { PurchasePayment } from "./PurchasePayment.ts";
import type { LivestockPolicy } from "./PurchasePayment.ts";
import type { PointCardSnapshot } from "./PointCard.ts";

export interface CardPurchaseResult {
  readonly playerId: string;
  readonly card: PointCardSnapshot;
}

export class CardPurchase {
  static execute(player: Player, market: Market, cardId: string, replacement: ResourceAmounts, policy: LivestockPolicy): CardPurchaseResult {
    const card = market.find(cardId);
    const payment = PurchasePayment.plan(card, replacement, policy);
    // No asynchronous/user callbacks between validation, payment, and taking this exact card.
    player.purchasePointCard(card, payment);
    market.take(cardId);
    return Object.freeze({ playerId: player.playerId, card: card.snapshot() });
  }
}
