const Express = require("express");
const Http = require("http");
const IO = require("socket.io");

const Mediator = require("./Mediator/index.js");

const app = Express();
const http = Http.createServer(app);
const io = IO(http);

app.get("/", function(_, res) {
  res.send("<h1>Hello world</h1>");
});

http.listen(3000, function() {
  console.log("listening on *:3000");
});

/**
 * @param {import('socket.io').Socket} socket
 */
const onConnection = socket => {
  Mediator.createMediator(socket);
};

io.on("connection", onConnection);
