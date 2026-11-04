"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar";
import {
  ATTENDANCE_BASE,
  ATTENDANCE_GROUPS,
  ATTENDANCE_SECTIONS,
  canOpenSection,
  sectionFromPath,
  sectionHref,
  type AttendanceAccess,
  type AttendanceSection,
} from "@/components/attendance/sections";
import { cn } from "@/lib/utils";

export type AttendanceCounts = { overtime: number; requests: number };

function CountBadge({ value, label }: { value: number; label: string }) {
  if (!value) return null;
  return (
    <Badge variant="destructive" className="ml-auto rounded-sm px-1.5 py-0.5 text-[11px]" aria-label={`${label}: ${value}`} role="status">
      {value}
    </Badge>
  );
}

/**
 * Attendance in the WareOps sidebar: opens on Overview and expands into its pages, grouped
 * under small headings. Administration stays folded unless one of its pages is open.
 * With the sidebar collapsed to icons the pages are in a pop-out menu instead.
 */
export function AttendanceNavItem({ counts, me }: { counts: AttendanceCounts | null; me: AttendanceAccess | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const inside = !!pathname?.startsWith(ATTENDANCE_BASE);
  const active = sectionFromPath(pathname);
  const activeGroup = ATTENDANCE_SECTIONS.find((s) => s.key === active)?.group;
  const [open, setOpen] = useState(inside);
  const [adminOpen, setAdminOpen] = useState(activeGroup === "Administration");

  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  useEffect(() => {
    if (activeGroup === "Administration") setAdminOpen(true);
  }, [activeGroup]);

  // Until the user's rights are known, show only pages everyone can open.
  const sections = ATTENDANCE_SECTIONS.filter((s) => (me ? canOpenSection(s, me) : s.access === "all"));
  const count = (s: AttendanceSection) => (s.badge && counts ? counts[s.badge] : 0);
  const total = counts ? counts.overtime + counts.requests : 0;
  const done = () => isMobile && setOpenMobile(false);

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={inside} tooltip={{ children: "Attendance" }}>
              <MapPinned />
              <span>Attendance</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-56">
            {ATTENDANCE_GROUPS.map((group, i) => {
              const items = sections.filter((s) => s.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{group}</DropdownMenuLabel>
                  {items.map((s) => (
                    <DropdownMenuItem key={s.key} asChild className={cn(active === s.key && "bg-accent font-medium")}>
                      <Link href={sectionHref(s.key)}>
                        <s.icon className="mr-2 h-4 w-4" />
                        {s.label}
                        <CountBadge value={count(s)} label={s.label} />
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={inside && !open}
        tooltip={{ children: "Attendance" }}
        aria-expanded={open}
        onClick={() => {
          if (!inside) {
            setOpen(true);
            router.push(ATTENDANCE_BASE);
            done();
          } else {
            setOpen((v) => !v);
          }
        }}
      >
        <MapPinned />
        <span>Attendance</span>
        {!open && <CountBadge value={total} label="Waiting for your approval" />}
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", !open && "-rotate-90", !open && total > 0 && "ml-1")} />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {ATTENDANCE_GROUPS.map((group) => {
            const items = sections.filter((s) => s.group === group);
            if (!items.length) return null;
            const folded = group === "Administration" && !adminOpen;
            return (
              <li key={group} className="list-none">
                {group === "Administration" ? (
                  <button
                    type="button"
                    onClick={() => setAdminOpen((v) => !v)}
                    aria-expanded={!folded}
                    className="flex w-full items-center gap-1 px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    {group}
                    <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", folded && "-rotate-90")} />
                  </button>
                ) : (
                  <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
                )}
                {!folded && (
                  <ul className="flex flex-col gap-0.5">
                    {items.map((s) => (
                      <SidebarMenuSubItem key={s.key}>
                        <SidebarMenuSubButton asChild isActive={active === s.key}>
                          <Link href={sectionHref(s.key)} onClick={done}>
                            <s.icon />
                            <span className="truncate">{s.label}</span>
                            <CountBadge value={count(s)} label={s.label} />
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
