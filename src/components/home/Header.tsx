import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header id="main-header" className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2.5">
          <Link href="/" className="flex-shrink-0">
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
            <Link
              href="/login"
              className="px-5 py-2.5 bg-[#0d7377] text-white rounded-lg font-medium hover:bg-[#0a5c5f] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-[#e37c64] text-white rounded-lg font-medium hover:bg-[#c96a55] transition-colors"
            >
              Start Free Trial
            </Link>
          </nav>

          <button
            type="button"
            className="md:hidden p-2 text-[#0d7377]"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
