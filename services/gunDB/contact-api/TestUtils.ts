/** @format */
import { GUNNode, UserGUNNode, UserPair } from "./SimpleGUN";

export interface RequestorAndRecipient {
  gun: GUNNode;
  /**
   * Alice is always the requestor.
   */
  requestor: UserGUNNode;
  /**
   * Returns a promise containing the generated avatar.
   */
  giveRequestorAnAvatar: () => Promise<string>;
  /**
   * Returns a promise containing the generated display name.
   */
  giveRequestorADisplayName: () => Promise<string>;
  requestorPair: UserPair;
  requestorSecret: string;
  requestorPub: string;
  requestorEpub: string;
  recipient: UserGUNNode;
  /**
   *  Returns a promise containing the generated avatar.
   */
  giveRecipientAnAvatar: () => Promise<string>;
  /**
   *  Returns a promise containing the generated display name.
   */
  giveRecipientADisplayName: () => Promise<string>;
  recipientPair: UserPair;
  recipientSecret: string;
  recipientPub: string;
  recipientEpub: string;

  sharedSecret: string;
}

export interface RequestorRecipientAndHandshakeAttempt
  extends RequestorAndRecipient {
  requestorHandshakeRequestID: string;
  requestorFeedID: string;
  recipientHandshakeAddress: string;
}

export interface RequestorRecipientAndSuccessfulHandshake
  extends RequestorRecipientAndHandshakeAttempt {
  recipientFeedID: string;
}
