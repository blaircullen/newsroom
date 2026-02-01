'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid email or password');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10">
            <Image
              src="/newsroom-logo.jpeg"
              alt="NewsRoom"
              width={240}
              height={65}
              className="h-16 w-auto"
              priority
            />
          </div>

          <div className="mb-8">
            <h2 className="font-display text-display-md text-ink-950 mb-2">
              Welcome back
            </h2>
            <p className="text-ink-400 text-base">
              Sign in to access the newsroom
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-ink-200 bg-white text-ink-900 
                          placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-900/10 
                          focus:border-ink-900 transition-all text-base"
                placeholder="you@m3media.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-ink-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-ink-200 bg-white text-ink-900 
                          placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-900/10 
                          focus:border-ink-900 transition-all text-base"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-ink-950 text-white rounded-lg font-semibold text-base
                        hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-900/20 
                        disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                        active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-ink-400 text-xs mt-8">
            M3 Media &middot; Digital Newsroom
          </p>
        </div>
      </div>

      {/* Right: Hero visual — deep navy with the logo and crimson accents */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #111c30 0%, #192842 50%, #213050 100%)' }}>
        {/* Subtle geometric pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(255,255,255,0.5) 59px, rgba(255,255,255,0.5) 60px),
            repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(255,255,255,0.5) 59px, rgba(255,255,255,0.5) 60px)
          `
        }} />

        {/* Star watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]">
          <svg width="600" height="600" viewBox="0 0 24 24" fill="white">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </div>

        <div className="relative z-10 text-center max-w-lg px-12">
          {/* Logo on white card */}
          <div className="bg-white rounded-2xl p-8 mb-10 shadow-2xl inline-block">
            <Image
              src="/newsroom-logo.jpeg"
              alt="NewsRoom"
              width={320}
              height={85}
              className="h-20 w-auto"
              priority
            />
          </div>
          <h2 className="font-display text-display-lg text-white mb-4">
            Your stories,<br />
            <span className="text-press-400">amplified.</span>
          </h2>
          <p className="text-ink-300 text-lg leading-relaxed">
            Write, submit, and publish from a single newsroom. 
            Every great story starts here.
          </p>
        </div>

        {/* Bottom accent stripe — crimson red from the logo */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-press-600 via-press-500 to-press-600" />
      </div>
    </div>
  );
}
