import { BottomNav } from "@/components/bottom-nav"

export default function EventLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 pb-[72px]">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
