import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { User } from './types';
import { BarberPortal } from './components/BarberPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { Login } from './components/Login';
import { LogOut, LayoutDashboard, ClipboardList, ShieldAlert } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'barber' | 'admin'>('barber');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  // ── OWN Hub SSO e Sincronização de Sessão ──────────────────
  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);
      const params = new URLSearchParams(window.location.search);
      const hubUser = params.get('hub_user');
      const hubPass = params.get('hub_pass');
      const hubToken = params.get('hub_token');
      const viewParam = params.get('view');

      if (viewParam === 'admin') {
        setView('admin');
      }

      // 1. Autenticação por relay de senha
      if (hubUser && hubPass) {
        try {
          const password = atob(hubPass);
          await supabase.auth.signInWithPassword({ email: hubUser, password });
        } catch (e) {
          console.error('Erro no Password Relay:', e);
        }
      }

      // 2. Verifica sessão do Supabase
      const { data: { session } } = await supabase.auth.getSession();

      // 3. Fallback com token relay
      if (!session?.user && hubUser && hubToken) {
        try {
          const decoded = JSON.parse(atob(hubToken));
          if (decoded.uid && decoded.exp > Date.now()) {
            const { data: profile } = await supabase
              .from('hub_profiles')
              .select('*')
              .eq('id', decoded.uid)
              .single();

            if (profile && profile.is_active !== false) {
              cleanUrlParams();
              setCurrentUser({
                id: profile.id,
                name: profile.name || hubUser.split('@')[0],
                email: hubUser,
                isAdmin: profile.role === 'admin'
              });
              setView('admin');
              setAuthLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error('Erro no Token Relay:', e);
        }
      }

      // 4. Se tiver sessão ativa, puxa perfil
      if (session?.user) {
        try {
          const { data: profile } = await supabase
            .from('hub_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile && profile.is_active !== false) {
            cleanUrlParams();
            setCurrentUser({
              id: session.user.id,
              name: profile.name || session.user.email?.split('@')[0] || 'Usuário',
              email: session.user.email || '',
              isAdmin: profile.role === 'admin'
            });
            setView('admin');
          }
        } catch (e) {
          console.error('Erro ao buscar perfil do usuário:', e);
        }
      }

      setAuthLoading(false);
    };

    initAuth();
  }, []);

  const cleanUrlParams = () => {
    const url = new URL(window.location.href);
    ['hub_user', 'hub_pass', 'hub_role', 'hub_token', 'hub_name', 'view'].forEach(p => url.searchParams.delete(p));
    try {
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // ignore
    }
  };

  const handleLogin = async (email: string, pass: string) => {
    setLoginError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) {
        setLoginError('E-mail ou senha incorretos.');
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('hub_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!profile || profile.is_active === false) {
          setLoginError('Sua conta está inativa ou você não tem permissão de acesso.');
          await supabase.auth.signOut();
          return;
        }

        setCurrentUser({
          id: data.user.id,
          name: profile.name || data.user.email?.split('@')[0] || 'Usuário',
          email: data.user.email || '',
          isAdmin: profile.role === 'admin'
        });
      }
    } catch (err) {
      console.error(err);
      setLoginError('Ocorreu um erro ao realizar o login.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setView('barber');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  // RENDERIZAÇÃO ADMIN
  if (view === 'admin') {
    if (!currentUser) {
      return (
        <div className="relative min-h-screen bg-zinc-950">
          <Login onLogin={handleLogin} error={loginError} />
          {/* Botão discreto para voltar ao portal do barbeiro */}
          <button
            onClick={() => setView('barber')}
            className="absolute bottom-6 right-6 text-xs text-zinc-500 hover:text-zinc-300 hover:underline cursor-pointer"
          >
            ← Voltar ao Portal do Barbeiro
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-brand/30">
        {/* Header Admin */}
        <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-950 rounded-xl flex items-center justify-center border border-zinc-800 text-brand shadow-md">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-black tracking-tighter text-zinc-100 uppercase italic">
                OWN <span className="text-brand">PAINEL</span> ADMIN
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Olá, <strong className="text-zinc-200">{currentUser.name}</strong>
              </span>

              <button
                onClick={() => setView('barber')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Portal
              </button>

              <button
                onClick={handleLogout}
                className="p-2 text-zinc-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors cursor-pointer"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </header>

        {/* Dashboard de Admin */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {currentUser.isAdmin ? (
            <AdminDashboard />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-zinc-100">Acesso Restrito</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Você está autenticado, mas sua conta não possui permissões administrativas de administrador necessárias para gerenciar questionários.
              </p>
              <button
                onClick={handleLogout}
                className="bg-brand text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-light cursor-pointer"
              >
                Desconectar
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // RENDERIZAÇÃO PORTAL DO BARBEIRO (PADRÃO PÚBLICO)
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-50">
      <BarberPortal />
      
      {/* Botão discreto no rodapé para acessar painel de admin */}
      <footer className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
        <button
          onClick={() => setView('admin')}
          className="text-[10px] text-zinc-700 hover:text-zinc-400 hover:underline cursor-pointer pointer-events-auto transition-colors"
        >
          Acesso Administrativo
        </button>
      </footer>
    </div>
  );
}
