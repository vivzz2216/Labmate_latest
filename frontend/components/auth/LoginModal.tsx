"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/BasicAuthContext";
import { isValidEmail, validatePasswordStrength } from "@/lib/sanitize";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const { login, signup } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isMounted, isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        // Client-side validation to avoid 422 spam (backend enforces strong password rules)
        if (!isValidEmail(email)) {
          setError("Please enter a valid email address");
          return;
        }
        const { isValid, errors } = validatePasswordStrength(password);
        if (!isValid) {
          setError(errors.join("\n"));
          return;
        }
        await signup(email, name, password);
      }
      onClose();
    } catch (err: any) {
      // Ensure we always render a string (FastAPI validation errors can be an array/object)
      const detail = err?.response?.data?.detail;
      const msg =
        (typeof detail === "string" && detail) ||
        (Array.isArray(detail)
          ? detail
              .map((d) => d?.msg)
              .filter(Boolean)
              .join("\n")
          : "") ||
        err?.message ||
        "Authentication failed";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setEmail("");
    setName("");
    setPassword("");
  };

  if (!isMounted || !isOpen) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 text-slate-900"
          role="dialog"
          aria-modal="true"
          aria-label={
            isLogin ? "Sign in to LabMate" : "Create a LabMate account"
          }
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 transition-colors p-1 hover:bg-slate-100 rounded-lg"
              aria-label="Close sign-in dialog"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                required
                autoFocus
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-900 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm whitespace-pre-line">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={switchMode}
              className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
            >
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
              <span className="text-blue-600 hover:text-blue-700 underline">
                {isLogin ? "Sign up" : "Sign in"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
