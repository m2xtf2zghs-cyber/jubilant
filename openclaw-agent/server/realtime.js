import { WebSocketServer } from "ws";

export function createRealtimeServer(server, store) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const send = (socket, payload) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  wss.on("connection", (socket) => {
    send(socket, { type: "state.snapshot", state: store.getState() });
  });

  return {
    broadcast(payload) {
      const data = JSON.stringify(payload);
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(data);
        }
      });
    },
    close() {
      wss.close();
    },
  };
}
