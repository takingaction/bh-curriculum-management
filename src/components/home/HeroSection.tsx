import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20">
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.jpg"
          alt="Hero background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
          Performers Ready!
        </h1>
        <p className="text-lg sm:text-xl lg:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto">
          A Performing Arts curricula designed for ALL elementary teachers to feel confident and successful delivering dance, music, and theatre (even if they have no prior experience teaching the arts).
        </p>
      </div>
    </section>
  );
}
