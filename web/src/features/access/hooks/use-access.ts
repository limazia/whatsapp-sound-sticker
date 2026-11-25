import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSession } from "@/features/access/http/get-session";
import { signOut } from "@/features/access/http/sign-out";

const sessionKey = ["session"] as const;

export function useAccess() {
  const client = useQueryClient();
  const { data: session, error: sessionError, isFetching: isFetchingSession } = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => getSession(signal),
    refetchInterval: (query) => query.state.data?.role ? 5000 : false,
  });

  const logout = useMutation({
    mutationFn: signOut,
    onMutate: () => client.cancelQueries({ queryKey: sessionKey }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: sessionKey });
    },
  });

  return { session, sessionError, isFetchingSession, logout };
}
