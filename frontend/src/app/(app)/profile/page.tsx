"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  BuildingIcon,
  CopyIcon,
  Loader2Icon,
  MonitorIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  KeyRoundIcon,
  RefreshCwIcon,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { toast } from "sonner"

// --- Change Name Card ---

function ChangeNameCard() {
  const t = useTranslations("profile")
  const { data: session } = useSession()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session?.user?.name])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await authClient.updateUser({ name })
      if (error) {
        toast.error(error.message ?? "Failed to update name")
        return
      }
      toast.success(t("nameUpdated"))
    } catch {
      toast.error("Failed to update name")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nameSection")}</CardTitle>
        <CardDescription>{t("nameDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="profile-name">{t("nameLabel")}</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
              disabled={saving}
            />
          </div>
          <Button type="submit" disabled={saving || name === session?.user?.name}>
            {saving && <Loader2Icon className="animate-spin" />}
            {t("nameUpdated").split(" ")[0]}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Change Password Card ---

function ChangePasswordCard() {
  const t = useTranslations("profile")
  const tc = useTranslations("common")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"))
      return
    }

    setSaving(true)
    try {
      const { error: apiError } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (apiError) {
        setError(apiError.message ?? "Failed to change password")
        return
      }
      toast.success(t("passwordChanged"))
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setError("Failed to change password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("passwordSection")}</CardTitle>
        <CardDescription>{t("passwordDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={saving}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            {t("changePassword")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Two-Factor Card ---

function TwoFactorCard() {
  const t = useTranslations("profile")
  const tc = useTranslations("common")
  const { data: session, refetch } = useSession()
  const twoFactorEnabled = (session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled ?? false

  // Enable flow state
  const [enableOpen, setEnableOpen] = useState(false)
  const [enableStep, setEnableStep] = useState<"password" | "qr" | "backup">("password")
  const [enablePassword, setEnablePassword] = useState("")
  const [totpURI, setTotpURI] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [totpCode, setTotpCode] = useState("")
  const [enabling, setEnabling] = useState(false)
  const [enableError, setEnableError] = useState<string | null>(null)

  // Disable flow state
  const [disableOpen, setDisableOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disabling, setDisabling] = useState(false)

  // Regenerate backup codes state
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenPasswordOpen, setRegenPasswordOpen] = useState(false)
  const [regenPassword, setRegenPassword] = useState("")
  const [regenCodes, setRegenCodes] = useState<string[]>([])
  const [regenerating, setRegenerating] = useState(false)

  function resetEnableFlow() {
    setEnableStep("password")
    setEnablePassword("")
    setTotpURI("")
    setBackupCodes([])
    setTotpCode("")
    setEnableError(null)
    setEnabling(false)
  }

  async function handleEnableStep1(e: React.FormEvent) {
    e.preventDefault()
    setEnabling(true)
    setEnableError(null)
    try {
      const { data, error } = await authClient.twoFactor.enable({
        password: enablePassword,
      })
      if (error) {
        setEnableError(error.message ?? "Error")
        return
      }
      setTotpURI(data.totpURI)
      setBackupCodes(data.backupCodes)
      setEnableStep("qr")
    } catch {
      setEnableError("Error")
    } finally {
      setEnabling(false)
    }
  }

  async function handleEnableStep2(e: React.FormEvent) {
    e.preventDefault()
    setEnabling(true)
    setEnableError(null)
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: totpCode,
      })
      if (error) {
        setEnableError(error.message ?? "Error")
        return
      }
      setEnableStep("backup")
      await refetch()
    } catch {
      setEnableError("Error")
    } finally {
      setEnabling(false)
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault()
    setDisabling(true)
    try {
      const { error } = await authClient.twoFactor.disable({
        password: disablePassword,
      })
      if (error) {
        toast.error(error.message ?? "Error")
        return
      }
      setDisableOpen(false)
      setDisablePassword("")
      await refetch()
      toast.success(t("twoFactorDisabled"))
    } catch {
      toast.error("Error")
    } finally {
      setDisabling(false)
    }
  }

  async function handleRegenerateBackupCodes(e: React.FormEvent) {
    e.preventDefault()
    setRegenerating(true)
    try {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({
        password: regenPassword,
      })
      if (error) {
        toast.error(error.message ?? "Error")
        return
      }
      setRegenCodes(data.backupCodes)
      setRegenPasswordOpen(false)
      setRegenPassword("")
      setRegenOpen(true)
    } catch {
      toast.error("Error")
    } finally {
      setRegenerating(false)
    }
  }

  function copyBackupCodes(codes: string[]) {
    navigator.clipboard.writeText(codes.join("\n"))
    toast.success(t("backupCodesCopied"))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle>{t("twoFactorSection")}</CardTitle>
              <CardDescription>{t("twoFactorDescription")}</CardDescription>
            </div>
            <Badge variant={twoFactorEnabled ? "default" : "secondary"}>
              {twoFactorEnabled ? (
                <>
                  <ShieldCheckIcon className="mr-1 size-3" />
                  {t("twoFactorEnabled")}
                </>
              ) : (
                <>
                  <ShieldOffIcon className="mr-1 size-3" />
                  {t("twoFactorDisabled")}
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex gap-3">
          {twoFactorEnabled ? (
            <>
              <Button
                variant="outline"
                onClick={() => setDisableOpen(true)}
              >
                <ShieldOffIcon />
                {t("disableTwoFactor")}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setRegenPassword(""); setRegenPasswordOpen(true) }}
              >
                <RefreshCwIcon />
                {t("regenerateBackupCodes")}
              </Button>
            </>
          ) : (
            <Button onClick={() => { resetEnableFlow(); setEnableOpen(true) }}>
              <ShieldCheckIcon />
              {t("enableTwoFactor")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Enable 2FA Dialog */}
      <Dialog
        open={enableOpen}
        onOpenChange={(open) => {
          if (!open) resetEnableFlow()
          setEnableOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("setupTitle")}</DialogTitle>
            <DialogDescription>
              {enableStep === "password" && t("setupStep1")}
              {enableStep === "qr" && t("setupStep2")}
              {enableStep === "backup" && t("backupCodesDescription")}
            </DialogDescription>
          </DialogHeader>

          {enableError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {enableError}
            </div>
          )}

          {enableStep === "password" && (
            <form onSubmit={handleEnableStep1} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="enable-2fa-password">{t("currentPassword")}</Label>
                <Input
                  id="enable-2fa-password"
                  type="password"
                  value={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.value)}
                  required
                  disabled={enabling}
                  autoComplete="current-password"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={enabling}>
                  {enabling && <Loader2Icon className="animate-spin" />}
                  {tc("confirm")}
                </Button>
              </DialogFooter>
            </form>
          )}

          {enableStep === "qr" && (
            <form onSubmit={handleEnableStep2} className="space-y-4">
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={totpURI} size={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp-verify-code">{t("verifyCode")}</Label>
                <Input
                  id="totp-verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  disabled={enabling}
                  autoComplete="one-time-code"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={enabling || totpCode.length !== 6}>
                  {enabling && <Loader2Icon className="animate-spin" />}
                  {t("verifyCode")}
                </Button>
              </DialogFooter>
            </form>
          )}

          {enableStep === "backup" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                  {backupCodes.join("\n")}
                </pre>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyBackupCodes(backupCodes)}
                  className="flex-1"
                >
                  <CopyIcon />
                  {t("copyBackupCodes")}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setEnableOpen(false); resetEnableFlow() }}>
                  {t("backupCodesAcknowledged")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA AlertDialog */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("disableTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("disableDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={handleDisable}>
            <div className="space-y-2 mb-4">
              <Label htmlFor="disable-2fa-password">{t("currentPassword")}</Label>
              <Input
                id="disable-2fa-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                disabled={disabling}
                autoComplete="current-password"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDisablePassword(""); setDisableOpen(false) }}>
                {tc("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                render={<Button type="submit" variant="destructive" disabled={disabling} />}
              >
                {disabling && <Loader2Icon className="animate-spin" />}
                {t("disableConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Backup Codes Password Dialog */}
      <Dialog open={regenPasswordOpen} onOpenChange={setRegenPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("regenerateBackupCodes")}</DialogTitle>
            <DialogDescription>{t("setupStep1")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegenerateBackupCodes} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regen-password">{t("currentPassword")}</Label>
              <Input
                id="regen-password"
                type="password"
                value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)}
                required
                disabled={regenerating}
                autoComplete="current-password"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={regenerating}>
                {regenerating && <Loader2Icon className="animate-spin" />}
                {tc("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("backupCodesTitle")}</DialogTitle>
            <DialogDescription>{t("backupCodesDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="text-sm font-mono whitespace-pre-wrap break-all">
              {regenCodes.join("\n")}
            </pre>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => copyBackupCodes(regenCodes)}
              className="flex-1"
            >
              <CopyIcon />
              {t("copyBackupCodes")}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRegenOpen(false)}>
              {t("backupCodesAcknowledged")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// --- Active Sessions Card ---

interface Session {
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: Date
}

function isMobile(ua?: string | null): boolean {
  if (!ua) return false
  return /mobile|android|iphone|ipad/i.test(ua)
}

function parseBrowser(ua?: string | null): string {
  if (!ua) return "Unknown"
  if (/firefox/i.test(ua)) return "Firefox"
  if (/edg/i.test(ua)) return "Edge"
  if (/chrome/i.test(ua)) return "Chrome"
  if (/safari/i.test(ua)) return "Safari"
  if (/opera|opr/i.test(ua)) return "Opera"
  return "Browser"
}

function ActiveSessionsCard() {
  const t = useTranslations("profile")
  const { data: currentSession } = useSession()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  useEffect(() => {
    authClient
      .listSessions()
      .then(({ data }) => {
        if (data) setSessions(data as Session[])
      })
      .finally(() => setLoading(false))
  }, [])

  const currentToken = currentSession?.session?.token

  async function handleRevoke(token: string) {
    setRevoking(token)
    try {
      const { error } = await authClient.revokeSession({ token })
      if (error) {
        toast.error(error.message ?? "Error")
        return
      }
      setSessions((prev) => prev.filter((s) => s.token !== token))
      toast.success(t("sessionRevoked"))
    } catch {
      toast.error("Error")
    } finally {
      setRevoking(null)
    }
  }

  async function handleRevokeAll() {
    setRevokingAll(true)
    try {
      const { error } = await authClient.revokeSessions()
      if (error) {
        toast.error(error.message ?? "Error")
        return
      }
      setSessions((prev) => prev.filter((s) => s.token === currentToken))
      toast.success(t("allSessionsRevoked"))
    } catch {
      toast.error("Error")
    } finally {
      setRevokingAll(false)
    }
  }

  const otherSessions = sessions.filter((s) => s.token !== currentToken)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle>{t("sessionsSection")}</CardTitle>
            <CardDescription>{t("sessionsDescription")}</CardDescription>
          </div>
          {otherSessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              disabled={revokingAll}
            >
              {revokingAll && <Loader2Icon className="animate-spin" />}
              {t("revokeAllSessions")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isCurrent = s.token === currentToken
              const mobile = isMobile(s.userAgent)
              const browser = parseBrowser(s.userAgent)
              const Icon = mobile ? SmartphoneIcon : MonitorIcon

              return (
                <div
                  key={s.token}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{browser}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          {t("currentSession")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.ipAddress && <span>{s.ipAddress}</span>}
                      {s.ipAddress && s.createdAt && <span> · </span>}
                      {s.createdAt && (
                        <span>
                          {new Date(s.createdAt).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(s.token)}
                      disabled={revoking === s.token}
                    >
                      {revoking === s.token ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        t("revokeSession")
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Organizations Card ---

function OrganizationsCard() {
  const t = useTranslations("org")
  const router = useRouter()
  const [orgs, setOrgs] = useState<{ id: string; name: string; slug: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authClient
      .organization.list()
      .then(({ data }) => {
        if (data) setOrgs(data as { id: string; name: string; slug: string }[])
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSwitch(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId })
    router.push("/events")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle>{t("organizations")}</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/organizations/new")}
          >
            {t("create")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noOrgsDescription")}</p>
        ) : (
          <div className="space-y-3">
            {orgs.map((org) => (
              <div
                key={org.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <BuildingIcon className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{org.slug}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSwitch(org.id)}
                >
                  {t("switchTo", { name: "" }).trim() || "Switch"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/organizations/${org.slug}`)}
                >
                  {t("settings")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Profile Page ---

export default function ProfilePage() {
  const t = useTranslations("profile")

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ChangeNameCard />
      <OrganizationsCard />
      <ChangePasswordCard />
      <TwoFactorCard />
      <ActiveSessionsCard />
    </div>
  )
}
