"use client";

import { useState, useEffect } from "react";

export default function MigrationNotice() {
  const [isVisible, setIsVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(80);
  const [bannerHeight, setBannerHeight] = useState(56);

  useEffect(() => {
    const updatePositions = () => {
      const header = document.getElementById("main-header");
      if (header) {
        const newHeaderHeight = header.offsetHeight;
        setHeaderHeight(newHeaderHeight);
        document.documentElement.style.setProperty("--header-height", `${newHeaderHeight}px`);
      }
    };

    updatePositions();

    window.addEventListener("resize", updatePositions);
    return () => window.removeEventListener("resize", updatePositions);
  }, []);

  useEffect(() => {
    if (isVisible) {
      document.documentElement.style.setProperty("--banner-height", "56px");
    } else {
      document.documentElement.style.setProperty("--banner-height", "0px");
    }
  }, [isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleShow = () => {
    setIsVisible(true);
  };

  return (
    <>
      {isVisible && (
        <section
          className="fixed left-0 right-0 z-[60] bg-[#0d7377] py-4 px-4"
          style={{ top: `${headerHeight}px` }}
        >
          <div className="max-w-7xl mx-auto text-center relative">
            <button
              onClick={handleDismiss}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-1"
              aria-label="Dismiss notice"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <p className="text-white text-sm sm:text-base pr-8">
              We have just moved to our much more robust and powerful custom platform! Your account has been migrated. Just use the{" "}
              <strong>magic link option</strong> to sign in using your email (you can add a password if you wish on your profile page once logged in).{" "}
              If you run into any issues, please email us at{" "}
              <a href="mailto:support@betterhumanseducation.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80">
                support@betterhumanseducation.com
              </a>
              .
            </p>
          </div>
        </section>
      )}

      <div id="floating-notice-btn" className={`fixed top-24 right-4 z-50 ${isVisible ? "hidden" : ""}`}>
        <button
          onClick={handleShow}
          className="w-12 h-12 rounded-full bg-[#0d7377] text-white shadow-lg hover:bg-[#0a5c5f] flex items-center justify-center"
          aria-label="Show notice"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>
    </>
  );
}
