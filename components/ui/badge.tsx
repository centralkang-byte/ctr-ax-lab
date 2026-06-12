import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-bg shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-panel2 text-text hover:bg-panel2/80",
        destructive:
          "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/25",
        outline: "text-text border-border",
        info: "border-info/50 bg-info/10 text-info",
        success: "border-success/50 bg-success/10 text-success",
        warning: "border-warning/50 bg-warning/10 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
