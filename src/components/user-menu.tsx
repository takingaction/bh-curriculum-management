"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface UserMenuProps {
  email: string;
  fullName: string | null;
  role: string;
  isAdmin: boolean;
  viewAs: string;
}

export function UserMenu({ email, fullName, role, isAdmin, viewAs }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = fullName
    ? fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 1)
    : email[0].toUpperCase();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full bg-[#0d7377] text-white flex items-center justify-center text-lg font-medium hover:bg-[#0a5c5f] transition-colors"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e5e5e0] rounded-lg shadow-lg z-50">
          <div className="py-1">
            <Link
              href={viewAs === "teacher" ? "/teacher" : "/admin"}
              className="block px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f5f0]"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f5f0]"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
            {isAdmin && viewAs === "admin" && (
              <Link
                href="/api/toggle-view?view=teacher"
                className="block px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f5f0]"
                onClick={() => setOpen(false)}
              >
                View as Teacher
              </Link>
            )}
            {isAdmin && viewAs === "teacher" && (
              <Link
                href="/api/toggle-view?view=admin"
                className="block px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f5f0]"
                onClick={() => setOpen(false)}
              >
                View as Admin
              </Link>
            )}
            <hr className="my-1 border-[#e5e5e0]" />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-left px-4 py-2 text-sm text-[#e85d5d] hover:bg-[#f5f5f0]"
              >
                Log Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}