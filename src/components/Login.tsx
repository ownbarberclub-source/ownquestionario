import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, Scissors } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string, pass: string) => void;
  error?: string;
}

export function Login({ onLogin, error }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 selection:bg-brand/30 font-sans">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center border-b border-zinc-800 bg-zinc-900/50">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-brand/10 text-brand rounded-2xl border border-brand/20">
            <Scissors className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 uppercase italic">
            OWN <span className="text-brand">BARBER</span> CLUB
          </h1>
          <p className="text-sm text-zinc-400 mt-2">Painel Administrativo — Questionários</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center font-semibold">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand transition-all text-sm"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-10 py-2.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand transition-all text-sm"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-brand text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-brand-light transition-colors shadow-lg shadow-brand/20 mt-2 uppercase tracking-wider cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
