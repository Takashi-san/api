/**
 * @format
 */
const Key = require("./key");

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').ISEA} ISEA
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 */

/**
 * @param {string} pub
 * @param {GUNNode} gun
 * @returns {Promise<string>}
 */
const pubToEpub = async (pub, gun) => {
  try {
    const epub = await gun
      .user(pub)
      .get("epub")
      .then();

    if (typeof epub !== "string") {
      throw new TypeError(
        `Expected gun.user(pub).get(epub) to be an string. Instead got: ${typeof epub}`
      );
    }

    if (epub.length === 0) {
      throw new TypeError(
        "Expected gun.user(pub).get(epub) to be a populated string."
      );
    }

    return epub;
  } catch (err) {
    throw new Error(`pubToEpub() -> ${err.message}`);
  }
};

/**
 * @param {string} reqID
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @param {string} mySecret
 * @returns {Promise<string>}
 */
const reqToRecipientPub = async (reqID, user, SEA, mySecret) => {
  const reqToUser = user.get(Key.REQUEST_TO_USER);

  const maybeEncryptedForMeRecipientPub = await reqToUser.get(reqID).then();

  if (typeof maybeEncryptedForMeRecipientPub !== "string") {
    throw new TypeError("typeof maybeEncryptedForMeRecipientPub !== 'string'");
  }

  if (maybeEncryptedForMeRecipientPub.length < 10) {
    throw new TypeError("maybeEncryptedForMeRecipientPub.length < 10");
  }

  const encryptedForMeRecipientPub = maybeEncryptedForMeRecipientPub;

  const recipientPub = await SEA.decrypt(encryptedForMeRecipientPub, mySecret);

  if (typeof recipientPub !== "string") {
    throw new TypeError("typeof recipientPub !== 'string'");
  }

  if (recipientPub.length < 30) {
    throw new TypeError("recipientPub.length < 30");
  }

  return recipientPub;
};

/**
 * @param {string} recipientPub
 * @param {UserGUNNode} user
 * @returns {Promise<string>}
 */
const recipientPubToLastReqSentID = async (recipientPub, user) => {
  const userToLastReqSent = user.get(Key.USER_TO_LAST_REQUEST_SENT);

  const lastReqSentID = await userToLastReqSent.get(recipientPub).then();

  if (typeof lastReqSentID !== "string") {
    throw new TypeError("typeof latestReqSentID !== 'string'");
  }

  if (lastReqSentID.length < 5) {
    throw new TypeError("latestReqSentID.length < 5");
  }

  return lastReqSentID;
};

/**
 * @param {string} recipientPub
 * @param {UserGUNNode} user
 * @returns {Promise<boolean>}
 */
const successfulHandshakeAlreadyExists = async (recipientPub, user) => {
  const userToIncoming = user.get(Key.USER_TO_INCOMING);

  const maybeIncomingID = await userToIncoming.get(recipientPub).then();

  if (typeof maybeIncomingID === "string") {
    if (maybeIncomingID.length < 5) {
      throw new TypeError("maybeIncomingID.length < 5");
    }

    return true;
  }

  return false;
};

/**
 * @param {string} recipientPub
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {Promise<string|null>}
 */
const recipientToOutgoingID = async (recipientPub, user, SEA) => {
  const mySecret = await SEA.secret(user._.sea.epub, user._.sea);

  if (typeof mySecret !== "string") {
    throw new TypeError("could not get mySecret");
  }

  const maybeEncryptedOutgoingID = await user
    .get(Key.RECIPIENT_TO_OUTGOING)
    .get(recipientPub)
    .then();

  if (typeof maybeEncryptedOutgoingID === "string") {
    const outgoingID = await SEA.decrypt(maybeEncryptedOutgoingID, mySecret);

    return outgoingID || null;
  }

  return null;
};

/**
 * @param {string} reqResponse
 * @param {string} recipientPub
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {Promise<boolean>}
 */
const reqWasAccepted = async (reqResponse, recipientPub, gun, user, SEA) => {
  try {
    const recipientEpub = await pubToEpub(recipientPub, gun);
    const ourSecret = await SEA.secret(recipientEpub, user._.sea);
    if (typeof ourSecret !== "string") {
      throw new TypeError('typeof ourSecret !== "string"');
    }

    const decryptedResponse = await SEA.decrypt(reqResponse, ourSecret);

    if (typeof decryptedResponse !== "string") {
      throw new TypeError('typeof decryptedResponse !== "string"');
    }

    const myFeedID = await recipientToOutgoingID(recipientPub, user, SEA);

    if (typeof myFeedID === "string" && decryptedResponse === myFeedID) {
      return false;
    }

    const recipientFeedID = decryptedResponse;

    const maybeFeed = await gun
      .user(recipientPub)
      .get(Key.OUTGOINGS)
      .get(recipientFeedID)
      .then();

    const feedExistsOnRecipient =
      typeof maybeFeed === "object" && maybeFeed !== null;

    return feedExistsOnRecipient;
  } catch (err) {
    throw new Error(`reqWasAccepted() -> ${err.message}`);
  }
};

/**
 *
 * @param {string} userPub
 * @param {GUNNode} gun
 * @returns {Promise<string|null>}
 */
const currHandshakeAddress = async (userPub, gun) => {
  const maybeHN = await gun
    .user(userPub)
    .get(Key.CURRENT_HANDSHAKE_NODE)
    .then();

  if (typeof maybeHN === "object" && maybeHN !== null) {
    return maybeHN._["#"];
  }

  return null;
};

module.exports = {
  pubToEpub,
  reqToRecipientPub,
  recipientPubToLastReqSentID,
  successfulHandshakeAlreadyExists,
  recipientToOutgoingID,
  reqWasAccepted,
  currHandshakeAddress
};
