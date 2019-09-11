import Express from "express";
import Http from "http";
import IO from "socket.io";

import Mediator from "./Mediator/index.js";

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
  new Mediator(socket);
};

io.on("connection", onConnection);
