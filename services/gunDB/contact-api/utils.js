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

module.exports = {
  pubToEpub,
  reqToRecipientPub,
  recipientPubToLastReqSentID,
  successfulHandshakeAlreadyExists
};
