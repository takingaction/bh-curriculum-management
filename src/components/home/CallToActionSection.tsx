export default function CallToActionSection() {
  return (
    <section className="bg-[#fcd9d3] py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-[#2d2926] mb-6">
          If you&apos;d like to bring Performers Ready! to your school or district, email us today or schedule an appointment to learn more.
        </h2>
        <p className="text-lg sm:text-xl text-[#2d2926] leading-relaxed mb-6">
          For customer support questions or general inquiries contact us at{" "}
          <a href="mailto:support@betterhumanseducation.com" className="text-[#0d7377] hover:underline">
            support@betterhumanseducation.com
          </a>{" "}
          or <a href="tel:916-212-7926" className="text-[#0d7377] hover:underline">(916) 212-7926</a>.
        </p>

        <a
          href="https://calendly.com/emilidanz/30min"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-4 bg-[#0d7377] text-white text-lg font-semibold rounded-lg hover:bg-[#0a5c5f] transition-colors shadow-md"
        >
          Schedule a Call
        </a>
      </div>
    </section>
  );
}
