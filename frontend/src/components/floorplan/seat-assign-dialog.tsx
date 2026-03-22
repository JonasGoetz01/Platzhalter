"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SeatAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seatLabel: string
  tableLabel: string
  onConfirm: (name: string) => void
}

export function SeatAssignDialog({
  open,
  onOpenChange,
  seatLabel,
  tableLabel,
  onConfirm,
}: SeatAssignDialogProps) {
  const t = useTranslations("floorplan.seatAssign")
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    onConfirm(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("title", { table: tableLabel, seat: seatLabel })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Input
              ref={inputRef}
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 text-sm"
              minLength={2}
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="min-h-14 text-base font-semibold"
              disabled={name.trim().length < 2}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
