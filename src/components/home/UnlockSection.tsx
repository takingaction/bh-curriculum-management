import Image from "next/image";

export default function UnlockSection() {
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 w-full max-w-lg lg:max-w-none">
            <Image
              src="/images/opportunities-image.png"
              alt="Unlock new opportunities"
              width={600}
              height={400}
              className="w-full h-auto rounded-lg"
            />
          </div>

          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2d2926] mb-6">
              Unlock New Opportunities.
            </h2>
            <p className="text-lg text-[#2d2926]/80 leading-relaxed">
              The performing arts are deeply interconnected, and our curricula opens doors for developing interdisciplinary skills and facilitating creativity beyond any single subject. Access for 1 year is only $800 per license, allowing teachers to explore and use as many lessons as they would like!
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
