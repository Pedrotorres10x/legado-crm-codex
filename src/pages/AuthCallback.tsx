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
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

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

        let sessionEstablished = false;

        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          sessionEstablished = !!data.session;
        }

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          sessionEstablished = sessionEstablished || !!data.session;
        }

        const { data } = await supabase.auth.getSession();

        if (!cancelled) {
          if (sessionEstablished || data.session) {
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
      } catch (error: unknown) {
        if (!cancelled) {
          toast({
            title: 'Error al completar el acceso',
            description: error instanceof Error ? error.message : 'No se pudo completar el callback de Google.',
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
