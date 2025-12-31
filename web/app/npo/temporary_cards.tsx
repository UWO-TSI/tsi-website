"use client";

export default function TemporaryCards() {
  return (
    <div className="max-w-6xl mx-auto px-6 pb-24 space-y-32">
      <div className="glass-card p-12 rounded-3xl">
        <h2 className="font-heading text-4xl font-semibold mb-6">What We Offer</h2>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Our student developers work with your organization to build custom software
          solutions tailored to your needs. From web applications to mobile apps,
          we provide full-stack development services at no cost.
        </p>
      </div>

      <div className="glass-card p-12 rounded-3xl">
        <h2 className="font-heading text-4xl font-semibold mb-6">The Process</h2>
        <div className="grid md:grid-cols-3 gap-8 mt-8">
          <div>
            <div className="text-3xl font-bold text-[#002FA7] mb-3">01</div>
            <h3 className="font-heading text-xl font-semibold mb-2">Apply</h3>
            <p className="text-zinc-400">Submit your organization's information and project needs.</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#002FA7] mb-3">02</div>
            <h3 className="font-heading text-xl font-semibold mb-2">Match</h3>
            <p className="text-zinc-400">We pair you with a dedicated team of student developers.</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#002FA7] mb-3">03</div>
            <h3 className="font-heading text-xl font-semibold mb-2">Build</h3>
            <p className="text-zinc-400">Work together to create impactful software solutions.</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-12 rounded-3xl">
        <h2 className="font-heading text-4xl font-semibold mb-6">Success Stories</h2>
        <p className="text-lg text-zinc-400 leading-relaxed">
          See how we've helped nonprofits across the country leverage technology
          to amplify their impact and serve their communities more effectively.
        </p>
      </div>
    </div>
  );
}
