"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { authClient } from "./auth"
import { setActiveOrgId } from "./api"

interface OrgContextValue {
  activeOrgId: string | null
  activeOrg: { id: string; name: string; slug: string; logo?: string | null } | null
  isLoading: boolean
}

const OrgContext = createContext<OrgContextValue>({
  activeOrgId: null,
  activeOrg: null,
  isLoading: true,
})

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: activeOrg, isPending } = authClient.useActiveOrganization()

  const orgId = activeOrg?.id ?? null

  useEffect(() => {
    setActiveOrgId(orgId)
  }, [orgId])

  return (
    <OrgContext.Provider
      value={{
        activeOrgId: orgId,
        activeOrg: activeOrg
          ? { id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug, logo: activeOrg.logo }
          : null,
        isLoading: isPending,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  return useContext(OrgContext)
}
