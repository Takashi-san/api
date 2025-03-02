const io = require("socket.io-client");
const http = require("http");
const ioBack = require("socket.io");

/** @type {ReturnType<typeof io.connect>} */
let socket;
/** @type {ReturnType<typeof http.createServer>} */
let httpServer;
/** @type {import('net').AddressInfo} */
let httpServerAddr;
/** @type {ReturnType<ioBack>} */
let ioServer;

/**
 * Setup WS & HTTP servers
 */
beforeAll(done => {
  httpServer = http.createServer();
  // @ts-ignore
  httpServerAddr = httpServer.listen().address();
  ioServer = ioBack(httpServer);
  done();
});

/**
 *  Cleanup WS & HTTP servers
 */
afterAll(done => {
  ioServer.close();
  httpServer.close();
  done();
});

/**
 * Run before each test
 */
beforeEach(done => {
  // Setup
  // Do not hardcode server port and address, square brackets are used for IPv6
  socket = io.connect(
    `http://[${httpServerAddr.address}]:${httpServerAddr.port}`,
    {
      reconnectionDelay: 0,
      forceNew: true,
      transports: ["websocket"]
    }
  );
  socket.on("connect", () => {
    done();
  });
});

/**
 * Run after each test
 */
afterEach(done => {
  // Cleanup
  if (socket.connected) {
    socket.disconnect();
  }
  done();
});

describe("basic socket.io example", () => {
  test("should communicate", done => {
    // once connected, emit Hello World
    ioServer.emit("echo", "Hello World");
    socket.once("echo", (/** @type {string} */ message) => {
      // Check that the message matches
      expect(message).toBe("Hello World");
      done();
    });
    ioServer.on("connection", mySocket => {
      expect(mySocket).toBeDefined();
    });
  });
  test("should communicate with waiting for socket.io handshakes", done => {
    // Emit sth from Client do Server
    socket.emit("examlpe", "some messages");
    // Use timeout to wait for socket.io server handshakes
    setTimeout(() => {
      // Put your server side expect() here
      done();
    }, 50);
  });
});
