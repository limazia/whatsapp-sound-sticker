import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiError } from "@lib/api";
import { connectWhatsApp } from "@/features/whatsapp/http/connect-whatsapp";
import { disconnectWhatsApp } from "@/features/whatsapp/http/disconnect-whatsapp";
import { pairWhatsApp } from "@/features/whatsapp/http/pair-whatsapp";
import { streamEvents } from "@/features/whatsapp/http/stream-events";

import type { WhatsAppState } from "@/features/whatsapp/schemas/whatsapp.schema";

type WhatsAppAction = { type: "connect" | "disconnect" } | { type: "pair"; phone: string };

export function useWhatsApp() {
  const [whatsAppState, setWhatsAppState] = useState<WhatsAppState>();
  const [logs, setLogs] = useState<string[]>([]);
  const [activityLive, setActivityLive] = useState(false);
  const [eventsError, setEventsError] = useState<Error>();
  const updateWhatsApp = useMutation({
    mutationFn: (action: WhatsAppAction) => {
      switch (action.type) {
        case "connect": return connectWhatsApp();
        case "disconnect": return disconnectWhatsApp();
        case "pair": return pairWhatsApp(action.phone);
      }
    },
    onSuccess: setWhatsAppState,
  });

  useEffect(() => {
    const controller = new AbortController();
    let retry: number | undefined;
    async function subscribe() {
      try {
        await streamEvents(controller.signal, {
          onStatus: (state) => {
            setWhatsAppState(state);
            setActivityLive(true);
            setEventsError(undefined);
            if (state.history) setLogs(state.history);
          },
          onLog: (entry) => setLogs((previous) => [entry, ...previous].slice(0, 30)),
        });
      } catch (reason) {
        if (controller.signal.aborted) return;
        setActivityLive(false);
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
          setEventsError(reason);
          return;
        }
      }
      if (!controller.signal.aborted) {
        setActivityLive(false);
        setEventsError(new Error("O painel perdeu a conexão com o servidor. Tentando reconectar…"));
        retry = window.setTimeout(() => void subscribe(), 3000);
      }
    }
    void subscribe();
    return () => {
      controller.abort();
      window.clearTimeout(retry);
    };
  }, []);

  return { whatsAppState, updateWhatsApp, logs, eventsError, activityLive };
}
