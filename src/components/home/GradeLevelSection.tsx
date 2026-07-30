export default function GradeLevelSection() {
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          <div className="flex-1">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2d2926] mb-6">
              Every Child Deserves Arts Education
            </h2>
            <p className="text-lg text-[#2d2926]/80 leading-relaxed">
              Our curricula is intended to be flexible for students of all abilities and capacities, with simple, easy-to-follow lessons that can be customized to meet the needs of every classroom. Performers Ready! includes social emotional learning strategies in each lesson, and is culturally responsive to address historic and lasting inequities in arts education.
            </p>
          </div>

          <div className="flex-1 space-y-6">
            <div>
              <p className="font-bold text-[#0d7377]">GRADES TK – K</p>
              <p className="text-[#2d2926]">Exploring the world through the arts.</p>
            </div>
            <div>
              <p className="font-bold text-[#0d7377]">GRADES 1 – 2</p>
              <p className="text-[#2d2926]">Foundational elements of dance, music, and theatre.</p>
            </div>
            <div>
              <p className="font-bold text-[#0d7377]">GRADE 3</p>
              <p className="text-[#2d2926]">MUSIC: Recorder | DANCE: Social Dances | THEATRE: Story + Character</p>
            </div>
            <div>
              <p className="font-bold text-[#0d7377]">GRADE 4</p>
              <p className="text-[#2d2926]">MUSIC: Voice | DANCE: A Common Language | THEATRE: Creative Collaboration</p>
            </div>
            <div>
              <p className="font-bold text-[#0d7377]">GRADE 5</p>
              <p className="text-[#2d2926]">MUSIC: Drumming | DANCE: Communication + Expression | THEATRE: Monologues + Playwriting</p>
            </div>
            <div>
              <p className="font-bold text-[#0d7377]">GRADE 6</p>
              <p className="text-[#2d2926]">MUSIC: Ukulele | DANCE: Evolution in America | THEATRE: Spoken Word + Scenes</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
