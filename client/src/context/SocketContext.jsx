import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      setConnected(false);
      return;
    }

    const socket = io("/", {
      auth: { token: localStorage.getItem("ds_token") },
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Re-attach all registered listeners
    socket.onAny((event, data) => {
      listenersRef.current[event]?.forEach((cb) => cb(data));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user]);

  /**
   * Subscribe to a socket event.
   * Returns an unsubscribe function.
   */
  const on = (event, cb) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = [];
    listenersRef.current[event].push(cb);
    return () => {
      listenersRef.current[event] = listenersRef.current[event].filter((fn) => fn !== cb);
    };
  };

  return (
    <SocketContext.Provider value={{ connected, on }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
