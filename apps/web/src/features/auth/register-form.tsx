'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@salon/ui';
import { AlertCircle, Scissors } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthApiError } from '@/features/auth/api';
import { type RegisterValues, registerSchema } from '@/features/auth/schemas';
import { useSession } from '@/features/auth/session';

export function RegisterForm() {
  const router = useRouter();
  const { register: registerAccount } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    try {
      await registerAccount({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof AuthApiError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <div className="grid h-[100dvh] w-full grid-cols-1 lg:grid-cols-2 overflow-hidden">
      {/* Left Column: Form & Actions */}
      <div className="flex h-full w-full flex-col justify-center items-center p-6 sm:p-10 lg:p-12 xl:p-16 bg-white overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-full max-w-[400px] sm:max-w-[420px] flex flex-col my-auto">
          {/* Brand header */}
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-xs">
              <Scissors className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-neutral-950">
              Salon Platform
            </span>
          </div>

          {/* Heading */}
          <div className="mb-5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950">
              Create your account
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-neutral-500">
              Enter your details below to start your 30-day free trial.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-200/80 bg-red-50 p-2.5 text-xs text-red-700"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600"
              />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-3.5" noValidate>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="text-xs font-medium text-neutral-700">
                  First name
                </label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Jane"
                  aria-invalid={errors.firstName ? 'true' : undefined}
                  className="h-11 rounded-xl text-sm"
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p role="alert" className="text-[11px] text-red-600">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="lastName" className="text-xs font-medium text-neutral-700">
                  Last name
                </label>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Doe"
                  aria-invalid={errors.lastName ? 'true' : undefined}
                  className="h-11 rounded-xl text-sm"
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p role="alert" className="text-[11px] text-red-600">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-neutral-700">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : undefined}
                className="h-11 rounded-xl text-sm"
                {...register('email')}
              />
              {errors.email && (
                <p role="alert" className="text-[11px] text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-neutral-700">
                  Password
                </label>
                <span className="text-[11px] text-neutral-400">8+ chars</span>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : undefined}
                className="h-11 rounded-xl text-sm"
                {...register('password')}
              />
              {errors.password && (
                <p role="alert" className="text-[11px] text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-medium text-neutral-700">
                Confirm password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.confirmPassword ? 'true' : undefined}
                className="h-11 rounded-xl text-sm"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p role="alert" className="text-[11px] text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-11 sm:h-12 bg-neutral-950 text-white hover:bg-neutral-800 rounded-full font-medium text-sm transition-colors duration-150"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            </div>

            {/* Or divider */}
            <div className="relative my-3.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="bg-white px-3 text-neutral-400">or</span>
              </div>
            </div>

            {/* Google Sign In Button at bottom */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 sm:h-12 bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 rounded-full font-medium text-sm transition-colors duration-150 shadow-xs flex items-center justify-center gap-2.5"
            >
              <svg className="h-4 w-4" viewBox="0 0 488 512" fill="currentColor" aria-hidden="true">
                <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
              </svg>
              Sign up with Google
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-5 text-center text-xs text-neutral-500">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-neutral-950 hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Right Column: Editorial Hero Corner-to-Corner */}
      <div className="relative hidden lg:block h-full w-full bg-neutral-900">
        <Image
          src="/girl-portrait-4.jpg"
          alt="Salon sanctuary portrait"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12 lg:p-14 xl:p-16 text-white">
          <span className="inline-block rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-white/95 mb-2.5 border border-white/20">
            Salon Platform
          </span>
          <h2 className="text-2xl xl:text-3xl font-bold leading-snug text-white/95">
            Where craft meets effortless salon management.
          </h2>
          <p className="mt-1.5 text-xs xl:text-sm text-white/70 max-w-md">
            Engineered for modern salons, barbers, and aesthetic studios.
          </p>
        </div>
      </div>
    </div>
  );
}
