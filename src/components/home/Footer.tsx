export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#2d2926] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-white/60 text-sm">
          &copy; {currentYear} Better Humans, LLC. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
