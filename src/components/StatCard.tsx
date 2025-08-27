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
  className?: string
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  className 
}: StatCardProps) {
  return (
    <Card className={cn(
      "bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300",
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-2xl font-bold text-foreground">{value}</h3>
              {trend && (
                <span className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}>
                  {trend.value}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}