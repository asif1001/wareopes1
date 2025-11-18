"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Flag, FileText, GanttChartSquare, MessageSquareWarning, Settings, Package, BarChart3 } from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { AppPageKey } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/shipments", label: "Shipments", icon: Flag, pageKey: "shipments" as AppPageKey },
    { href: "/dashboard/production", label: "Production", icon: Package, pageKey: "production" as AppPageKey },
    { href: "/dashboard/maintenance", label: "Maintenance", icon: Package, pageKey: "maintenance" as AppPageKey },
    { href: "/dashboard/tasks", label: "Tasks", icon: GanttChartSquare, pageKey: "tasks" as AppPageKey },
    { href: "/dashboard/productivity", label: "Productivity", icon: BarChart3, pageKey: "productivity" as AppPageKey },
    { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareWarning },
    { href: "/dashboard/reports", label: "Reports", icon: FileText },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, pageKey: "settings" as AppPageKey },
];

export function DashboardNav() {
    const pathname = usePathname();
    const { permissions, isLoading } = useAuth();
    const [pendingCount, setPendingCount] = useState<number | null>(null);
    const [animate, setAnimate] = useState(false);
    const prevCountRef = useRef<number | null>(null);
    const [expiringCount, setExpiringCount] = useState<number | null>(null);
    const [expiringAnimate, setExpiringAnimate] = useState(false);
    const prevExpiringRef = useRef<number | null>(null);

    const [pendingLoading, setPendingLoading] = useState<boolean>(false);
    const refreshPendingCount = async () => {
        setPendingLoading(true);
        try {
            const res = await fetch('/api/tasks/pending-count');
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const newCount = Number(data?.count ?? 0);
            if (prevCountRef.current !== null && prevCountRef.current !== newCount) {
                setAnimate(true);
                setTimeout(() => setAnimate(false), 800);
            }
            prevCountRef.current = newCount;
            setPendingCount(newCount);
        } catch (err) {
            setPendingCount(null);
            console.error('Failed to load pending task count:', err);
        } finally {
            setPendingLoading(false);
        }
    };

    const [expiringLoading, setExpiringLoading] = useState<boolean>(false);
    const refreshExpiringCount = async () => {
        setExpiringLoading(true);
        try {
            const res = await fetch('/api/maintenance/expiring-count');
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const newCount = Number(data?.count ?? 0);
            if (prevExpiringRef.current !== null && prevExpiringRef.current !== newCount) {
                setExpiringAnimate(true);
                setTimeout(() => setExpiringAnimate(false), 800);
            }
            prevExpiringRef.current = newCount;
            setExpiringCount(newCount);
        } catch (err) {
            setExpiringCount(null);
            console.error('Failed to load expiring maintenance count:', err);
        } finally {
            setExpiringLoading(false);
        }
    };

    // Initial auto refresh on load, then a one-time refresh after 20s, and no further automatic refreshes
    useEffect(() => {
        let cancelled = false;
        const initial = async () => {
            try {
                await Promise.all([refreshPendingCount(), refreshExpiringCount()]);
            } catch (_) {}
        };
        initial();
        const timer = setTimeout(async () => {
            if (cancelled) return;
            try {
                await Promise.all([refreshPendingCount(), refreshExpiringCount()]);
            } catch (_) {}
        }, 20000);
        return () => { cancelled = true; clearTimeout(timer); };
    }, []);

    // Helper function to check if user has view permission for a page
    const hasViewPermission = (pageKey: AppPageKey): boolean => {
        if (!permissions) return false;
        const pagePermissions = permissions[pageKey];
        return Array.isArray(pagePermissions) && pagePermissions.includes('view');
    };

    // Filter navigation items based on permissions
    const filteredNavItems = isLoading 
        ? navItems.filter(item => !item.pageKey) // Show only non-permission-gated items during loading
        : navItems.filter(item => {
            // Always show Dashboard and items without pageKey
            if (!item.pageKey) return true;
            // For items with pageKey, check view permission
            return hasViewPermission(item.pageKey);
        });

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-4 border-b">
                 <Boxes className="h-7 w-7 text-primary" />
                <h1 className="text-xl font-bold font-headline group-data-[collapsible=icon]:hidden">
                    WAREOPS
                </h1>
            </div>
            <div className="flex-1 overflow-y-auto">
                <SidebarMenu className="p-2">
                    {filteredNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton 
                                asChild
                                isActive={pathname === item.href}
                                tooltip={{children: item.label}}
                            >
                                <Link href={item.href === "/dashboard/tasks" ? "/dashboard/tasks#active" : (item.href === "/dashboard/maintenance" ? "/dashboard/maintenance#expiring" : item.href)}>
                                    <item.icon />
                                    <span className="flex items-center gap-2">
                                        {item.label}
                                        {item.href === "/dashboard/tasks" && (pendingCount !== null && pendingCount > 0) && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge
                                                        variant="destructive"
                                                        className={cn(
                                                            "ml-1 px-1.5 py-0.5 text-[11px] rounded-sm",
                                                            animate && "animate-bounce",
                                                        )}
                                                        aria-live="polite"
                                                        aria-atomic="true"
                                                        aria-label={`Pending tasks requiring action: ${pendingCount ?? 'unknown'}`}
                                                        role="status"
                                                    >
                                                        {pendingCount}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {pendingCount === null ? 'Error loading task count' : 'Pending tasks requiring action'}
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {item.href === "/dashboard/maintenance" && (expiringCount !== null && expiringCount > 0) && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge
                                                        variant="destructive"
                                                        className={cn(
                                                            "ml-1 px-1.5 py-0.5 text-[11px] rounded-sm",
                                                            expiringAnimate && "animate-bounce",
                                                        )}
                                                        aria-live="polite"
                                                        aria-atomic="true"
                                                        aria-label={`Expiring maintenance items within 30 days: ${expiringCount ?? 'unknown'}`}
                                                        role="status"
                                                    >
                                                        {expiringCount}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {expiringCount === null ? 'Error loading expiring count' : 'Due or expired within 30 days'}
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </div>
        </div>
    );
}
