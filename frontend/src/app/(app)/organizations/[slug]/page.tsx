"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Loader2Icon,
  MailIcon,
  TrashIcon,
  UserMinusIcon,
  LogOutIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { authClient, useSession } from "@/lib/auth"
import { useOrg } from "@/lib/org-context"
import { toast } from "sonner"

interface FullOrgMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface FullOrgInvitation {
  id: string
  email: string
  role: string
  status: string
}

export default function OrgSettingsPage() {
  const router = useRouter()
  const t = useTranslations("org")
  const tc = useTranslations("common")
  const { data: session } = useSession()
  const { activeOrg } = useOrg()

  const [members, setMembers] = useState<FullOrgMember[]>([])
  const [invitations, setInvitations] = useState<FullOrgInvitation[]>([])
  const [loading, setLoading] = useState(true)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviting, setInviting] = useState(false)

  // Confirm dialogs
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!activeOrg?.id) return
    setLoading(true)
    authClient.organization
      .getFullOrganization({ query: { organizationId: activeOrg.id } })
      .then(({ data }) => {
        if (data) {
          setMembers((data.members ?? []) as FullOrgMember[])
          setInvitations(
            ((data.invitations ?? []) as FullOrgInvitation[]).filter(
              (inv) => inv.status === "pending"
            )
          )
        }
      })
      .finally(() => setLoading(false))
  }, [activeOrg?.id])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!activeOrg?.id) return
    setInviting(true)
    try {
      const { error } = await authClient.organization.inviteMember({
        organizationId: activeOrg.id,
        email: inviteEmail,
        role: inviteRole as "member" | "admin",
      })
      if (error) {
        toast.error(error.message ?? "Failed to invite")
        return
      }
      toast.success(t("inviteSent"))
      setInviteEmail("")
      // Refresh
      const { data } = await authClient.organization.getFullOrganization({
        query: { organizationId: activeOrg.id },
      })
      if (data) {
        setInvitations(
          ((data.invitations ?? []) as FullOrgInvitation[]).filter(
            (inv) => inv.status === "pending"
          )
        )
      }
    } catch {
      toast.error("Failed to invite")
    } finally {
      setInviting(false)
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!activeOrg?.id) return
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    })
    if (error) {
      toast.error(error.message ?? "Failed to cancel")
      return
    }
    toast.success(t("invitationCanceled"))
    setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeOrg?.id) return
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId: activeOrg.id,
    })
    if (error) {
      toast.error(error.message ?? "Failed to remove")
      return
    }
    toast.success(t("memberRemoved"))
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  async function handleLeave() {
    if (!activeOrg?.id) return
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: session!.user.id,
      organizationId: activeOrg.id,
    })
    if (error) {
      toast.error(error.message ?? "Failed to leave")
      return
    }
    toast.success(t("leftOrg"))
    router.replace("/events")
  }

  async function handleDelete() {
    if (!activeOrg?.id) return
    const { error } = await authClient.organization.delete({
      organizationId: activeOrg.id,
    })
    if (error) {
      toast.error(error.message ?? "Failed to delete")
      return
    }
    toast.success(t("orgDeleted"))
    router.replace("/events")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings")}</h1>
        <p className="text-muted-foreground">{t("settingsDescription")}</p>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>{t("members")}</CardTitle>
          <CardDescription>
            {t("membersCount", { count: members.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.user.name}
                    {m.user.id === session?.user?.id && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        You
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <Badge variant="outline">{m.role}</Badge>
                {m.user.id !== session?.user?.id && m.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveMember(m.id)}
                  >
                    <UserMinusIcon className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite */}
      <Card>
        <CardHeader>
          <CardTitle>{t("invite")}</CardTitle>
          <CardDescription>{t("inviteDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48 space-y-2">
              <Label htmlFor="invite-email">{t("inviteEmail")}</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("inviteEmailPlaceholder")}
                required
                disabled={inviting}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("inviteRole")}</Label>
              <Select value={inviteRole} onValueChange={(v) => { if (v) setInviteRole(v) }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("roleMember")}</SelectItem>
                  <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting && <Loader2Icon className="animate-spin" />}
              <MailIcon className="size-4" />
              {t("invite")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pendingInvitations")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                  </div>
                  <Badge variant="outline">{inv.role}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(inv.id)}
                  >
                    {t("cancelInvitation")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card>
        <CardContent className="flex gap-3 pt-6 flex-wrap">
          <Button variant="outline" onClick={() => setLeaveOpen(true)}>
            <LogOutIcon className="size-4" />
            {t("leaveOrg")}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <TrashIcon className="size-4" />
            {t("deleteOrg")}
          </Button>
        </CardContent>
      </Card>

      {/* Leave confirmation */}
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("leaveOrg")}</AlertDialogTitle>
            <AlertDialogDescription>{t("leaveConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>
              {t("leaveOrg")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteOrg")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              render={<Button variant="destructive" />}
            >
              {t("deleteOrg")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
