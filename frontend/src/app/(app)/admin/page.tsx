"use client"

import { useEffect, useState } from "react"
import {
  Loader2Icon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslations } from "next-intl"
import { useLocale } from "next-intl"
import { authClient, useSession } from "@/lib/auth"
import { toast } from "sonner"

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: Date
}

export default function AdminPage() {
  const { data: session } = useSession()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    authClient.admin
      .listUsers({ query: { limit: 100 } })
      .then(({ data, error }) => {
        if (error) {
          setError(t("noPermission"))
          return
        }
        setUsers(data?.users as AdminUser[] ?? [])
      })
      .catch(() => {
        setError(t("connectionFailed"))
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setInviting(true)

    const form = new FormData(e.currentTarget)
    const name = form.get("name") as string
    const email = form.get("email") as string
    const password = form.get("password") as string
    const role = form.get("role") as string

    try {
      const { data, error } = await authClient.admin.createUser({
        name, email, password, role: role as "admin",
      })
      if (error) {
        toast.error(error.message ?? t("updateFailed"))
        return
      }
      setUsers((prev) => [...prev, data.user as AdminUser])
      setInviteOpen(false)
      toast.success(t("userCreated"))
    } catch (err: any) {
      toast.error(err.message ?? t("updateFailed"))
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const { error } = await authClient.admin.setRole({
        userId, role: newRole as "admin",
      })
      if (error) {
        toast.error(error.message ?? t("updateFailed"))
        return
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
      toast.success(t("roleUpdated"))
    } catch (err: any) {
      toast.error(err.message ?? t("updateFailed"))
    }
  }

  async function handleDelete(userId: string) {
    try {
      const { error } = await authClient.admin.removeUser({
        userId,
      })
      if (error) {
        toast.error(error.message ?? tc("delete"))
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      toast.success(t("userDeleted"))
    } catch (err: any) {
      toast.error(err.message ?? tc("delete"))
    }
  }

  const currentUserId = session?.user?.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <PlusIcon />
          {t("inviteUser")}
        </Button>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inviteTitle")}</DialogTitle>
            <DialogDescription>
              {t("inviteDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">{t("name")}</Label>
              <Input
                id="invite-name"
                name="name"
                required
                disabled={inviting}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">{t("email")}</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                disabled={inviting}
                placeholder={t("emailPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">{t("password")}</Label>
              <Input
                id="invite-password"
                name="password"
                type="password"
                required
                minLength={8}
                disabled={inviting}
                placeholder={t("passwordPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">{t("role")}</Label>
              <Select name="role" defaultValue="moderator">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                  <SelectItem value="moderator">{t("roleModerator")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2Icon className="animate-spin" />}
                {tc("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <ShieldIcon className="size-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {!error && <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UsersIcon className="size-5" />
            <CardTitle>{t("users")}</CardTitle>
          </div>
          <CardDescription>
            {t("usersCount", { count: users.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tableHeaderName")}</TableHead>
                    <TableHead>{t("tableHeaderEmail")}</TableHead>
                    <TableHead>{t("tableHeaderRole")}</TableHead>
                    <TableHead>{t("tableHeaderCreated")}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                          {isSelf && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs"
                            >
                              {t("you")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {isSelf ? (
                            <Badge>
                              <ShieldIcon className="mr-1 size-3" />
                              {user.role}
                            </Badge>
                          ) : (
                            <Select
                              value={user.role}
                              onValueChange={(value) => {
                                if (value) handleRoleChange(user.id, value)
                              }}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                                <SelectItem value="moderator">
                                  {t("roleModerator")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString(
                            locale
                          )}
                        </TableCell>
                        <TableCell>
                          {!isSelf && (
                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive"
                                  />
                                }
                              >
                                <Trash2Icon className="size-4" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("deleteUser")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("deleteUserDescription", { name: user.name, email: user.email })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {tc("cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(user.id)}
                                  >
                                    {tc("delete")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>}
    </div>
  )
}
