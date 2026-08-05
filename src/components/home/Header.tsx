"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(60);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/status");
        if (res.ok) {
          const data = await res.json();
          setIsLoggedIn(data.authenticated);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    checkAuth();
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header ref={headerRef} id="main-header" className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2.5">
            <Link href="/" className="flex-shrink-0" onClick={closeMenu}>
              <Image
                src="/images/logo.png"
                alt="Performers Ready! Logo"
                width={160}
                height={60}
                className="h-auto w-40"
                priority
              />
            </Link>

            <nav className="hidden md:flex items-center space-x-4">
              <a
                href="https://www.betterhumanseducation.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0d7377] hover:text-[#0a5c5f] font-medium transition-colors"
              >
                About Us
              </a>
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 bg-[#0d7377] text-white rounded-lg font-medium hover:bg-[#0a5c5f] transition-colors"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-5 py-2.5 bg-[#0d7377] text-white rounded-lg font-medium hover:bg-[#0a5c5f] transition-colors"
                >
                  Sign In
                </Link>
              )}
              {!isLoggedIn && (
                <Link
                  href="/signup"
                  className="px-5 py-2.5 bg-[#e37c64] text-white rounded-lg font-medium hover:bg-[#c96a55] transition-colors"
                >
                  Start Free Trial
                </Link>
              )}
            </nav>

            <button
              type="button"
              className="md:hidden p-2 text-[#0d7377]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="fixed left-0 right-0 bg-white shadow-lg z-[65]"
          style={{ top: `${headerHeight}px` }}
        >
          <div className="px-4 py-4 space-y-3">
            <a
              href="https://www.betterhumanseducation.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[#0d7377] hover:text-[#0a5c5f] font-medium transition-colors py-2"
              onClick={closeMenu}
            >
              About Us
            </a>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="block w-full text-center px-5 py-3 bg-[#0d7377] text-white rounded-lg font-medium hover:bg-[#0a5c5f] transition-colors"
                onClick={closeMenu}
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="block w-full text-center px-5 py-3 bg-[#0d7377] text-white rounded-lg font-medium hover:bg-[#0a5c5f] transition-colors"
                onClick={closeMenu}
              >
                Sign In
              </Link>
            )}
            {!isLoggedIn && (
              <Link
                href="/signup"
                className="block w-full text-center px-5 py-3 bg-[#e37c64] text-white rounded-lg font-medium hover:bg-[#c96a55] transition-colors"
                onClick={closeMenu}
              >
                Start Free Trial
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
