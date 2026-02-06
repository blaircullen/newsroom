'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setIsSubmitted(true);
    } catch (error) {
      // Still show success to prevent enumeration
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-[380px] text-center animate-[fadeUp_0.8s_ease_both]">

          {/* Large centered NR mark */}
          <div className="inline-flex items-start justify-center gap-0 mb-8">
            <span className="font-black text-[72px] leading-none tracking-[-4px] text-[#111c30]">N</span>
            <span className="font-black text-[72px] leading-none tracking-[-4px] text-press-500">R</span>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="ml-1 -mt-0.5">
              <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
            </svg>
          </div>

          {isSubmitted ? (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-display text-[22px] font-medium text-[#111c30] mb-1.5 tracking-[-0.3px]">
                  Check your email
                </h2>
                <p className="text-[#8892a4] text-sm">
                  If an account exists with that email, we&apos;ve sent a password reset link.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-block text-[#111c30] text-sm font-medium hover:text-press-500 transition-colors"
              >
                ← Back to login
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display text-[22px] font-medium text-[#111c30] mb-1.5 tracking-[-0.3px]">
                Reset your password
              </h2>
              <p className="text-[#8892a4] text-sm mb-10">
                Enter your email and we&apos;ll send you a reset link
              </p>

              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                <div>
                  <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-[0.8px] text-[#8892a4] mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-lg border-[1.5px] border-[#e8eaed] bg-white text-[#111c30]
                              text-base md:text-[15px] placeholder-[#c4c9d2] focus:outline-none focus:border-[#111c30]
                              focus:shadow-[0_0_0_3px_rgba(17,28,48,0.06)] transition-all"
                    placeholder="you@m3media.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-[#111c30] text-white rounded-lg font-semibold text-[15px] tracking-[0.3px]
                            hover:bg-[#1a2a44] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(17,28,48,0.2)]
                            focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all duration-200 active:scale-[0.98] mt-2"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>

              <Link
                href="/login"
                className="inline-block mt-6 text-[#8892a4] text-sm hover:text-[#111c30] transition-colors"
              >
                ← Back to login
              </Link>
            </>
          )}

          <p className="text-center text-[#c4c9d2] text-[11px] mt-10 tracking-[2px] uppercase font-medium">
            &copy; 2026 M3 MEDIA | NEWSROOM
          </p>
        </div>
      </div>

      {/* Right: Hero */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #0d1520 0%, #152244 40%, #1a2d52 100%)' }}>

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-100" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        {/* Crimson glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(212,43,43,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 text-center max-w-[460px] px-8 animate-[fadeUp_1s_ease_0.2s_both]">
          {/* Large NR */}
          <div className="inline-flex items-start mb-4">
            <span className="font-black text-[100px] leading-none tracking-[-5px] text-white">N</span>
            <span className="font-black text-[100px] leading-none tracking-[-5px] text-press-500">R</span>
            <svg width="34" height="34" viewBox="0 0 20 20" fill="none" className="ml-1.5 -mt-1">
              <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
            </svg>
          </div>

          <h2 className="font-display text-4xl font-medium text-white mb-4 tracking-[-0.5px] leading-tight">
            Your stories,<br />
            <span className="italic text-press-400">amplified.</span>
          </h2>
          <p className="text-white/40 text-base leading-relaxed font-light">
            Write, edit, and publish from a single newsroom.<br />
            Every great story starts here.
          </p>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px]"
             style={{ background: 'linear-gradient(90deg, transparent 0%, #D42B2B 50%, transparent 100%)' }} />

      </div>
    </div>
  );
}
