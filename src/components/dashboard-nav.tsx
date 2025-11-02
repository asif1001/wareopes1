"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Flag, FileText, GanttChartSquare, MessageSquareWarning, Settings, Package, BarChart3 } from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { AppPageKey } from "@/lib/types";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/shipments", label: "Shipments", icon: Flag, pageKey: "shipments" as AppPageKey },
    { href: "/dashboard/production", label: "Production", icon: Package, pageKey: "production" as AppPageKey },
  { href: "/dashboard/tasks", label: "Tasks", icon: GanttChartSquare, pageKey: "tasks" as AppPageKey },
  { href: "/dashboard/productivity", label: "Productivity", icon: BarChart3, pageKey: "productivity" as AppPageKey },
    { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareWarning },
    { href: "/dashboard/reports", label: "Reports", icon: FileText },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, pageKey: "settings" as AppPageKey },
];

export function DashboardNav() {
    const pathname = usePathname();
    const { permissions, isLoading } = useAuth();

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
                                <Link href={item.href}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </div>
        </div>
    );
}
