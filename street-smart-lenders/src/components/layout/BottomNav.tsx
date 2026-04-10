import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Banknote, CreditCard, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Users, Briefcase, TrendingUp, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/utils';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/leads', icon: FileText, label: 'Leads' },
  { to: '/loans', icon: Banknote, label: 'Loans' },
  { to: '/collections', icon: CreditCard, label: 'Collect' },
];

const moreNav = [
  { to: '/borrowers', icon: Users, label: 'Borrowers' },
  { to: '/dsas', icon: Briefcase, label: 'DSAs' },
  { to: '/reports', icon: TrendingUp, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border pb-safe">
        <div className="flex">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {/* More Menu Dialog */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:max-w-xs bottom-0 top-auto translate-y-0 -translate-x-1/2 left-1/2 rounded-b-none rounded-t-xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Menu</DialogTitle>
          </DialogHeader>

          {profile && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {initials(profile.full_name)}
              </div>
              <div>
                <p className="text-sm font-medium">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile.role.replace(/_/g, ' ')}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {moreNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
