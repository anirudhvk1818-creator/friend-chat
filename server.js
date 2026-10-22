const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Keeps the last 50 messages per room in memory (lost when server restarts)
const history = {};

io.on("connection", (socket) => {
  socket.on("join", ({ name, room }) => {
    name = String(name || "").trim().slice(0, 24) || "Guest";
    room = String(room || "").trim().toLowerCase().slice(0, 40);
    if (!room) return;

    socket.data.name = name;
    socket.data.room = room;
    socket.join(room);

    socket.emit("history", history[room] || []);
    io.to(room).emit("system", `${name} joined`);
    sendCount(room);
  });

  socket.on("message", (text) => {
    const { name, room } = socket.data;
    if (!room) return;
    text = String(text || "").trim().slice(0, 2000);
    if (!text) return;

    const msg = { name, text, time: Date.now() };
    history[room] = (history[room] || []).concat(msg).slice(-50);
    io.to(room).emit("message", msg);
  });

  socket.on("typing", (isTyping) => {
    const { name, room } = socket.data;
    if (room) socket.to(room).emit("typing", { name, isTyping });
  });

  socket.on("disconnect", () => {
    const { name, room } = socket.data;
    if (!room) return;
    io.to(room).emit("system", `${name} left`);
    sendCount(room);
  });
});

function sendCount(room) {
  const count = io.sockets.adapter.rooms.get(room)?.size || 0;
  io.to(room).emit("count", count);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Chat running on http://localhost:${PORT}`));
