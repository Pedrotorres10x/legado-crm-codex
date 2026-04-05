import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Shield, Trash2, Ban, UserCheck, Users, Loader2 } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  phone: string;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
}

type AdminUsersAction =
  | { action: 'list' }
  | { action: 'delete'; user_id: string }
  | { action: 'ban'; user_id: string; unban: boolean }
  | { action: 'set_role'; user_id: string; role: string };

type AdminUsersResponse = {
  users?: UserRow[];
};

const AdminUsers = () => {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const invokeAdmin = async (body: AdminUsersAction) => {
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (error) throw error;
    return data as AdminUsersResponse;
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeAdmin({ action: 'list' });
      setUsers(data.users || []);
    } catch (error: unknown) {
      toast.error(`Error cargando usuarios: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleDelete = async (userId: string, name: string) => {
    try {
      await invokeAdmin({ action: 'delete', user_id: userId });
      toast.success(`Usuario ${name} eliminado`);
      loadUsers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el usuario');
    }
  };

  const handleBan = async (userId: string, unban: boolean) => {
    try {
      await invokeAdmin({ action: 'ban', user_id: userId, unban });
      toast.success(unban ? 'Usuario reactivado' : 'Usuario desactivado');
      loadUsers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado del usuario');
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await invokeAdmin({ action: 'set_role', user_id: userId, role });
      toast.success('Rol actualizado');
      loadUsers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el rol');
    }
  };

  const getRoleDisplay = (roles: string[]) => {
    if (roles.includes('admin')) return { label: 'Admin', variant: 'default' as const };
    if (roles.includes('coordinadora')) return { label: 'Coordinadora', variant: 'secondary' as const };
    return { label: 'Agente', variant: 'outline' as const };
  };

  const getCurrentRole = (roles: string[]) => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('coordinadora')) return 'coordinadora';
    return 'agente';
  };

  const isSelf = (userId: string) => userId === session?.user?.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} usuarios registrados</p>
        <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          <span className="ml-2">Refrescar</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => {
            const roleInfo = getRoleDisplay(u.roles);
            const self = isSelf(u.id);
            return (
              <Card key={u.id} className={u.banned ? 'opacity-60' : ''}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback>{(u.full_name || u.email)?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{u.full_name || u.email}</span>
                      <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
                      {u.banned && <Badge variant="destructive">Desactivado</Badge>}
                      {self && <Badge variant="outline" className="text-xs">Tú</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {u.last_sign_in_at && (
                      <p className="text-xs text-muted-foreground">
                        Último acceso: {new Date(u.last_sign_in_at).toLocaleDateString('es-ES')}
                      </p>
                    )}
                  </div>

                  {!self && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={getCurrentRole(u.roles)}
                        onValueChange={(val) => handleRoleChange(u.id, val)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="coordinadora">Coordinadora</SelectItem>
                          <SelectItem value="agente">Agente</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleBan(u.id, u.banned)}
                        title={u.banned ? 'Reactivar' : 'Desactivar'}
                      >
                        {u.banned ? <UserCheck className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-orange-500" />}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" title="Eliminar usuario">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará permanentemente a <strong>{u.full_name || u.email}</strong> y todos sus datos asociados. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(u.id, u.full_name || u.email)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
