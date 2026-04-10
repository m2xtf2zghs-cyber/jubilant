import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Banknote, CreditCard,
  Building2, Settings, LogOut, ChevronRight, Bell, Sun, Moon,
  TrendingUp, Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/leads', icon: FileText, label: 'Leads' },
  { to: '/borrowers', icon: Users, label: 'Borrowers' },
  { to: '/loans', icon: Banknote, label: 'Loans' },
  { to: '/collections', icon: CreditCard, label: 'Collections' },
  { to: '/dsas', icon: Briefcase, label: 'DSAs' },
  { to: '/reports', icon: TrendingUp, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Building2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="text-sm font-bold leading-none">Street Smart</div>
          <div className="text-xs text-muted-foreground leading-none mt-0.5">Lenders</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/alerts')} title="Alerts">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={signOut}
            title="Sign out"
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {profile && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {initials(profile.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{profile.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
