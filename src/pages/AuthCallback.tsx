import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppSplashScreen from '@/components/AppSplashScreen';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const finishAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const errorDescription = url.searchParams.get('error_description');
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');

        if (error || errorDescription) {
          if (!cancelled) {
            toast({
              title: 'No se pudo iniciar sesión con Google',
              description: errorDescription || error || 'El proveedor devolvió un error inesperado.',
              variant: 'destructive',
            });
            navigate('/auth', { replace: true });
          }
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data } = await supabase.auth.getSession();

        if (!cancelled) {
          if (data.session) {
            navigate('/', { replace: true });
          } else {
            toast({
              title: 'No se ha completado la sesión',
              description: 'La autenticación con Google no dejó una sesión activa. Inténtalo de nuevo.',
              variant: 'destructive',
            });
            navigate('/auth', { replace: true });
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          toast({
            title: 'Error al completar el acceso',
            description: err?.message || 'No se pudo completar el callback de Google.',
            variant: 'destructive',
          });
          navigate('/auth', { replace: true });
        }
      }
    };

    void finishAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

  return <AppSplashScreen />;
};

export default AuthCallback;
