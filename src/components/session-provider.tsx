"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { switchBranchToken } from "@/lib/api/endpoints"
import {
  clearTokens,
  decodeClaims,
  readTokens,
  writeTokens,
  type SessionTokens,
  type UserClaims,
} from "@/lib/auth/session"
import { DEMO, demoClaimsFor } from "@/lib/demo"

type SessionContextValue = {
  /** `undefined` until the browser session has been read. */
  claims: UserClaims | null | undefined
  signIn: (tokens: SessionTokens) => void
  signOut: () => void
  /** Swaps the token for another permitted branch (today's force-login flow). */
  switchBranch: (branchId: number) => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

function subscribe(onChange: () => void) {
  window.addEventListener("wyre:session", onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener("wyre:session", onChange)
    window.removeEventListener("storage", onChange)
  }
}

const getAccess = () => readTokens()?.access ?? null

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const access = React.useSyncExternalStore(
    subscribe,
    getAccess,
    () => undefined
  )

  const claims = React.useMemo(
    () =>
      access === undefined
        ? undefined
        : DEMO
          ? demoClaimsFor(access)
          : access
            ? decodeClaims(access)
            : null,
    [access]
  )

  const value = React.useMemo<SessionContextValue>(
    () => ({
      claims,
      signIn: (tokens) => {
        queryClient.clear()
        writeTokens(tokens)
      },
      signOut: () => {
        clearTokens()
        queryClient.clear()
      },
      switchBranch: async (branchId) => {
        const response = await switchBranchToken(branchId)
        // Unlike the old app, no full page reload: drop cached data instead.
        queryClient.clear()
        writeTokens(response.data.token)
      },
    }),
    [claims, queryClient]
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const context = React.useContext(SessionContext)
  if (!context)
    throw new Error("useSession must be used within <SessionProvider>")
  return context
}

/** For pages inside the signed-in shell, where claims are guaranteed. */
export function useClaims() {
  const { claims } = useSession()
  if (!claims) throw new Error("useClaims used outside the signed-in shell")
  return claims
}
