import * as React from "react";
import { TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Attendance tables: the rows scroll inside the table (sized to the screen) while the column
 * header row stays frozen at the top, so the page heading and filters above stay in view.
 */
export const ScrollTable = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement> & { maxHeight?: string; containerClassName?: string }>(
  ({ className, maxHeight = "max(18rem, calc(100dvh - 19rem))", containerClassName, ...props }, ref) => (
    <div className={cn("relative w-full overflow-auto", containerClassName)} style={{ maxHeight }}>
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
ScrollTable.displayName = "ScrollTable";

/**
 * Frozen header row. `surface` must match what the table sits on (a card or the page) so the
 * header has a solid background and rows do not show through it.
 */
export function StickyHeader({ className, surface = "card", ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { surface?: "card" | "page" }) {
  return (
    <TableHeader
      className={cn(
        "sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_hsl(var(--border))]",
        surface === "card" ? "[&_th]:bg-card" : "[&_th]:bg-background",
        className,
      )}
      {...props}
    />
  );
}
