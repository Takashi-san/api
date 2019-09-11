/**
 * @prettier
 */
import * as Schema from "./schema.js";
/**
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./schema').Outgoing} Outgoing
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 */

const NOT_OBJECTS = [
  null,
  "foo",
  890123,
  undefined,
  true,
  false,
  [],
  new Map(),
  new Set(),
  new WeakMap(),
  /$/,
  Symbol("symbol")
];

describe("isHandshakeRequest()", () => {
  /** @type {HandshakeRequest} */
  const req = {
    from: Math.random().toString(),
    response: Math.random().toString(),
    timestamp: Math.random()
  };

  it("correctly identifies a valid handshake req", () => {
    expect(Schema.isHandshakeRequest(req)).toBe(true);
  });

  it("correctly rejects an empty object", () => {
    expect(Schema.isHandshakeRequest({})).toBe(false);
  });

  it("correctly rejects non-objects", () => {
    expect(NOT_OBJECTS.some(o => Schema.isHandshakeRequest(o))).toBe(false);
  });

  it("correctly rejects a request with at least one missing key", () => {
    for (const k of Object.keys(req)) {
      const partialReq = {
        ...req
      };

      // @ts-ignore
      delete partialReq[k];

      expect(Schema.isHandshakeRequest(partialReq)).toBe(false);
    }
  });
});

describe("isMessage()", () => {
  /**
   * @type {Message}
   */
  const msg = {
    body: "asdasd",
    timestamp: 127389123
  };

  it("correctly identifies a valid message", () => {
    expect(Schema.isMessage(msg)).toBe(true);
  });

  it("correctly rejects an empty object", () => {
    expect(Schema.isMessage({})).toBe(false);
  });

  it("correctly rejects non-objects", () => {
    expect(NOT_OBJECTS.every(o => Schema.isMessage(o))).toBe(false);
  });

  it("correctly rejects a message with at least one missing key", () => {
    for (const k of Object.keys(msg)) {
      const partialMsg = {
        ...msg
      };

      // @ts-ignore
      delete partialMsg[k];

      expect(Schema.isMessage(partialMsg)).toBe(false);
    }
  });
});

describe("isPartialOutgoing()", () => {
  /**
   * @type {PartialOutgoing}
   */
  const partialOutgoing = {
    with: Math.random().toString()
  };

  it("correctly identifies a valid partial outgoing", () => {
    expect(Schema.isPartialOutgoing(partialOutgoing)).toBe(true);
  });

  it("correctly rejects non-objects", () => {
    expect(NOT_OBJECTS.every(o => Schema.isPartialOutgoing(o))).toBe(false);
  });

  it("correctly rejects an empty object", () => {
    expect(Schema.isPartialOutgoing({})).toBe(false);
  });
});

describe("isOutgoing()", () => {
  /** @type {Outgoing} */
  const anOutgoing = {
    messages: {},
    with: Math.random().toString()
  };

  it("correctly identifies a valid partial outgoing", () => {
    expect(Schema.isPartialOutgoing(anOutgoing)).toBe(true);
  });

  it("correctly rejects non-objects", () => {
    expect(NOT_OBJECTS.every(o => Schema.isPartialOutgoing(o))).toBe(false);
  });

  it("correctly rejects an empty object", () => {
    expect(Schema.isPartialOutgoing({})).toBe(false);
  });
});
