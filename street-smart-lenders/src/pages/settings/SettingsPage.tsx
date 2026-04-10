import { useEffect, useState } from 'react';
import { Building2, Users, Moon, Sun, Save, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { initials } from '@/lib/utils';
import type { CompanySettings, UserProfile } from '@/types';

export function SettingsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [company, setCompany] = useState<Partial<CompanySettings>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cRes, uRes] = await Promise.all([
        supabase.from('company_settings').select('*').single(),
        supabase.from('user_profiles').select('*').order('full_name'),
      ]);
      if (cRes.data) setCompany(cRes.data as CompanySettings);
      setUsers((uRes.data || []) as UserProfile[]);
      setLoading(false);
    }
    load();
  }, []);

  async function saveCompany() {
    setSaving(true);
    const { error } = await supabase.from('company_settings').update(company).eq('id', (company as any).id);
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Company settings saved', variant: 'success' });
    }
    setSaving(false);
  }

  async function updateUserRole(userId: string, role: string) {
    const { error } = await supabase.from('user_profiles').update({ role }).eq('id', userId);
    if (error) {
      toast({ title: 'Error updating role', variant: 'destructive' });
    } else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: role as any } : u));
      toast({ title: 'Role updated', variant: 'success' });
    }
  }

  const isAdmin = profile?.role === 'ADMIN';

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader title="Settings" />

      <Tabs defaultValue="appearance">
        <TabsList className="w-full">
          <TabsTrigger value="appearance" className="flex-1">Appearance</TabsTrigger>
          {isAdmin && <TabsTrigger value="company" className="flex-1">Company</TabsTrigger>}
          {isAdmin && <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>}
        </TabsList>

        {/* Appearance */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader><CardTitle>Display Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Switch between light and dark theme</p>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </div>
              <Separator />

              {/* Current user profile */}
              {profile && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">My Profile</p>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      {initials(profile.full_name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                        {profile.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company */}
        {isAdmin && (
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Company Profile</CardTitle>
                  <Button size="sm" onClick={saveCompany} loading={saving}>
                    <Save className="h-4 w-4 mr-1" />Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label>Company Name</Label>
                    <Input value={company.name || ''} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Street Smart Lenders Pvt Ltd" />
                  </div>
                  <div className="space-y-1">
                    <Label>CIN / Registration No.</Label>
                    <Input value={company.cin || ''} onChange={(e) => setCompany({ ...company, cin: e.target.value })} placeholder="U65923MH2020PTC123456" />
                  </div>
                  <div className="space-y-1">
                    <Label>GSTIN</Label>
                    <Input value={company.gstin || ''} onChange={(e) => setCompany({ ...company, gstin: e.target.value })} className="uppercase" />
                  </div>
                  <div className="space-y-1">
                    <Label>RBI NBFC No. (if applicable)</Label>
                    <Input value={company.rbi_nbfc_no || ''} onChange={(e) => setCompany({ ...company, rbi_nbfc_no: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Contact Phone</Label>
                    <Input value={company.contact_phone || ''} onChange={(e) => setCompany({ ...company, contact_phone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Contact Email</Label>
                    <Input type="email" value={company.contact_email || ''} onChange={(e) => setCompany({ ...company, contact_email: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Website</Label>
                    <Input value={company.website || ''} onChange={(e) => setCompany({ ...company, website: e.target.value })} placeholder="https://" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Address</Label>
                    <Input value={company.address || ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>City</Label>
                    <Input value={company.city || ''} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>State</Label>
                    <Input value={company.state || ''} onChange={(e) => setCompany({ ...company, state: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Users */}
        {isAdmin && (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>User Management</CardTitle>
                  <p className="text-xs text-muted-foreground">Add users via Supabase Auth</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {initials(u.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateUserRole(u.id, v)}
                      disabled={u.id === user?.id}
                    >
                      <SelectTrigger className="w-36 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="CREDIT_MANAGER">Credit Manager</SelectItem>
                        <SelectItem value="COLLECTIONS_OFFICER">Collections Officer</SelectItem>
                        <SelectItem value="DSA_COORDINATOR">DSA Coordinator</SelectItem>
                        <SelectItem value="VIEW_ONLY">View Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
