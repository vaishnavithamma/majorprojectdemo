import {
  LayoutDashboard,
  ShieldAlert,
  Users,
  FolderLock,
  Navigation,
  Settings,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const menu = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Active SOS",
    path: "/dashboard/sos",
    icon: ShieldAlert,
  },
  {
    label: "Emergency Contacts",
    path: "/dashboard/contacts",
    icon: Users,
  },
  {
    label: "Evidence Vault",
    path: "/dashboard/evidence",
    icon: FolderLock,
  },
  {
    label: "Safe Route Planner",
    path: "/dashboard/routes",
    icon: Navigation,
  },
  {
    label: "SOS Settings",
    path: "/dashboard/settings",
    icon: Settings,
  },
  {
    label: "Incident History",
    path: "/dashboard/history",
    icon: History,
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth();

  return (
    <aside
      className={`sidebar ${
        collapsed ? "sidebar-collapsed" : ""
      }`}
    >
      <button
        className="sidebar-collapse"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight size={18} />
        ) : (
          <ChevronLeft size={18} />
        )}
      </button>

      <nav className="sidebar-nav">
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/dashboard"}
              className={({ isActive }) =>
                `sidebar-link ${
                  isActive ? "active" : ""
                }`
              }
            >
              <Icon size={20} />

              {!collapsed && (
                <span>{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <button
        className="sidebar-logout"
        onClick={logout}
      >
        <LogOut size={20} />

        {!collapsed && <span>Sign Out</span>}
      </button>
    </aside>
  );
}