import { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  /** "compact" keeps rows dense on data-heavy screens */
  size?: "default" | "compact"
  /** Status accent — use only when the number carries a status meaning */
  status?: "none" | "success" | "warning" | "destructive"
  className?: string
}

const statusRing: Record<string, string> = {
  none: "border-border",
  success: "border-success/40",
  warning: "border-warning/40",
  destructive: "border-destructive/40",
}

const statusText: Record<string, string> = {
  none: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  size = "default",
  status = "none",
  className
}: StatCardProps) {
  const compact = size === "compact"

  return (
    <Card className={cn(
      "bg-card border shadow-card transition-colors duration-150 hover:border-border/80",
      statusRing[status],
      className
    )}>
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
              {title}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <h3 className={cn(
                "num font-semibold tracking-tight truncate",
                compact ? "text-lg" : "text-2xl",
                statusText[status]
              )}>
                {value}
              </h3>
              {trend && (
                <span className={cn(
                  "num text-xs font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}>
                  {trend.value}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div
              aria-hidden="true"
              className={cn(
                "rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground",
                compact ? "w-8 h-8" : "w-10 h-10"
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
