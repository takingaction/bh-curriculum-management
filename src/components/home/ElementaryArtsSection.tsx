import Image from "next/image";

export default function ElementaryArtsSection() {
  return (
    <section className="bg-[#fcd9d3] py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2d2926] mb-6">
              Elementary Arts Curriculum
            </h2>
            <p className="text-lg text-[#2d2926]/80 leading-relaxed">
              Performers Ready! provides 30 weeks of sequential lessons for each grade level, TK-6, in dance, music, and theatre. The content meets all California VAPA standards and aligns with the Arts Framework to ensure students receive comprehensive instruction in the performing arts.
            </p>
          </div>

          <div className="flex-1 w-full max-w-lg lg:max-w-none">
            <Image
              src="/images/kids-dancing.png"
              alt="Two young kids dancing with their instructor"
              width={600}
              height={400}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
