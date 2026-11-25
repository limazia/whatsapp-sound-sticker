import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiKey, saveApiKey } from "@lib/api";
import { getSession } from "@/features/access/http/get-session";
import { signIn } from "@/features/access/http/sign-in";
import { signOut } from "@/features/access/http/sign-out";

const sessionKey = ["session"] as const;

export function useAccess() {
  const client = useQueryClient();
  const { data: session, error: sessionError, isFetching: isFetchingSession } = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => getSession(signal),
    enabled: Boolean(getApiKey()),
    refetchInterval: (query) => query.state.data?.role ? 5000 : false,
  });

  const unlock = useMutation({
    mutationFn: async (key: string) => {
      const session = await getSession(undefined, key);
      saveApiKey(key);
      return session;
    },
    onMutate: () => client.cancelQueries({ queryKey: sessionKey }),
    onSuccess: (session) => client.setQueryData(sessionKey, session),
  });
  const login = useMutation({
    mutationFn: signIn,
    onMutate: () => client.cancelQueries({ queryKey: sessionKey }),
    onSuccess: (session) => client.setQueryData(sessionKey, session),
  });
  const logout = useMutation({
    mutationFn: signOut,
    onMutate: () => client.cancelQueries({ queryKey: sessionKey }),
    onSuccess: () => client.setQueryData(sessionKey, { role: null, whatsappConnected: false }),
  });

  return { session, sessionError, isFetchingSession, unlock, login, logout };
}
