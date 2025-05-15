import * as React from "react"
import {
  BarChart,
  Command,
  FileText,
  // Frame,
  Hammer,
  Home,
  LifeBuoy,
  // Map,
  // MessageCircle,
  PenTool,
  // PieChart,
  Send,
  Settings2,
  // Users,
} from "lucide-react"

import { NavMain } from "./nav-main"
// import { NavProjects } from "./nav-projects"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"
import { useAuthStore } from "../store/useAuthStore"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/app/dashboard",
      icon: Home,
      items: [
        {
          title: "Overview",
          url: "/app/dashboard/overview",
        },
        // MVP starts with basic dashboard only
        // {
        //   title: "Insights",
        //   url: "#",
        // },
        // {
        //   title: "Alerts",
        //   url: "#",
        // },
      ],
    },
    {
      title: "Content Strategy",
      url: "/app/strategy",
      icon: FileText,
      items: [
        {
          title: "Trend Explorer",
          url: "/app/strategy/trends",
        },
        // MVP includes only trend discovery - other strategy features come later
        // {
        //   title: "Competitor Analysis",
        //   url: "#",
        // },
        // {
        //   title: "Content Calendar",
        //   url: "#",
        // },
        // {
        //   title: "Content Gaps",
        //   url: "#",
        // },
      ],
    },
    {
      title: "Creation Hub",
      url: "/app/content",
      icon: PenTool,
      items: [
        // MVP includes only simple content editor - other creation tools come later
        // {
        //   title: "AI Writer",
        //   url: "#",
        // },
        {
          title: "Editor",
          url: "/app/content/editor",
        },
        // {
        //   title: "Templates",
        //   url: "#",
        // },
        // {
        //   title: "Asset Library",
        //   url: "#",
        // },
      ],
    },
    {
      title: "Analytics",
      url: "/app/analytics",
      icon: BarChart,
      items: [
        {
          title: "Performance",
          url: "/app/analytics/performance",
        },
        // MVP includes only basic analytics - detailed analytics come later
        // {
        //   title: "Audience",
        //   url: "#",
        // },
        // {
        //   title: "ROI Tracking",
        //   url: "#",
        // },
        // {
        //   title: "Custom Reports",
        //   url: "#",
        // },
      ],
    },
    // The following sections are not part of the initial MVP
    // Social Intelligence requires more advanced API integrations
    // {
    //   title: "Social Intelligence",
    //   url: "#",
    //   icon: MessageCircle,
    //   items: [
    //     {
    //       title: "Social Monitor",
    //       url: "#",
    //     },
    //     {
    //       title: "Engagement Tracker",
    //       url: "#",
    //     },
    //     {
    //       title: "Influencer Database",
    //       url: "#",
    //     },
    //     {
    //       title: "Viral Content",
    //       url: "#",
    //     },
    //   ],
    // },
    {
      title: "Tools",
      url: "/app/tools",
      icon: Hammer,
      items: [
        // MVP includes only basic SEO score - other tools come later
        {
          title: "SEO Optimizer",
          url: "/app/tools/seo",
        },
        // {
        //   title: "Content Scorer",
        //   url: "#",
        // },
        // {
        //   title: "Image Generator",
        //   url: "#",
        // },
        // {
        //   title: "Distribution Manager",
        //   url: "#",
        // },
      ],
    },
    // Team/Workspace features are typically added post-MVP
    // {
    //   title: "Team/Workspace",
    //   url: "#",
    //   icon: Users,
    //   items: [
    //     {
    //       title: "Team Members",
    //       url: "#",
    //     },
    //     {
    //       title: "Client Accounts",
    //       url: "#",
    //     },
    //     {
    //       title: "Permissions",
    //       url: "#",
    //     },
    //     {
    //       title: "Collaboration",
    //       url: "#",
    //     },
    //   ],
    // },
    {
      title: "Settings",
      url: "/app/settings",
      icon: Settings2,
      items: [
        // MVP only needs basic integration settings
        {
          title: "Integrations",
          url: "/app/settings/integrations",
        },
        // {
        //   title: "Notifications",
        //   url: "#",
        // }
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "/app/support",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "/app/feedback",
      icon: Send,
    },
  ],
  // projects: [
  //   {
  //     name: "Design Engineering",
  //     url: "#",
  //     icon: Frame,
  //   },
  //   {
  //     name: "Sales & Marketing",
  //     url: "#",
  //     icon: PieChart,
  //   },
  //   {
  //     name: "Travel",
  //     url: "#",
  //     icon: Map,
  //   },
  // ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore();

  // Get user data or provide default values if not available
  const userData = {
    name: user?.name || "Guest User",
    email: user?.email || "guest@example.com",
    avatar: user?.avatar || "/avatars/default.jpg",
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user?.company?.name || "Unknown Company"}</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="custom-scrollbar">
        <NavMain items={data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}