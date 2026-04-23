import { LogoPlaceholder } from "@/components/LogoPlaceholder";
import { RegistrationForm } from "@/components/RegistrationForm";
import { FaqAccordion } from "@/components/FaqAccordion";
import { SectionNav } from "@/components/SectionNav";

const tierItems = [
  {
    title: "Tier 1",
    copy:
      "Official entry into the BKFC Affiliate Gym Network for approved gyms that meet core standards and show strong structural potential.",
  },
  {
    title: "Tier 2",
    copy:
      "Progressive affiliate level for gyms demonstrating stronger activity, athlete development consistency, and growing value inside the network.",
  },
  {
    title: "Tier 3",
    copy:
      "Top-tier affiliate level reserved for standout gyms with the strongest momentum, recognition potential, and long-term BKFC activation upside.",
  },
];

const expectationItems = [
  "A professional training environment with strong operational discipline",
  "Active coaching structure and a clear athlete development culture",
  "Willingness to align with BKFC program standards and direction",
  "Capacity to represent the program properly at local market level",
  "Long-term mindset toward gym growth, quality, and brand alignment",
];

const benefitGroups = [
  {
    title: "Exposure",
    items: [
      "Official BKFC affiliate recognition",
      "Positioning inside the BKFC international gym network",
      "Visibility opportunities across BKFC digital and content channels",
      "Stronger credibility for gyms looking to grow locally and internationally",
    ],
  },
  {
    title: "Athlete Opportunity",
    items: [
      "Priority visibility for fighters connected to affiliate gyms",
      "Closer connection to BKFC tryouts, trials, and talent pathways",
      "Stronger long-term bridge between gym athletes and BKFC opportunity channels",
      "Additional value for gyms focused on developing competitive fighters",
    ],
  },
  {
    title: "Commercial & Program Advantages",
    items: [
      "Potential access to selected BKFC-related activations",
      "Merchandising and promotional opportunity framework",
      "Seminar and appearance possibilities connected to BKFC talent",
      "Entry into a structured program built for growth, not just affiliation",
    ],
  },
];

const starterKitItems = [
  "Affiliate onboarding guidance",
  "Program recognition assets",
  "Brand usage direction",
  "Program support framework",
  "Future activation and opportunity pathway",
];

const prepItems = [
  "Gym logo",
  "Facility photos",
  "Website or primary social media profile",
  "Active fighter roster (optional)",
  "Promotional video (optional)",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero" id="hero">
        <div className="hero-topbar">
          <img
            src="/bkfc-logo.png"
            alt="BKFC Logo"
            style={{ height: "80px" }}
          />
          <LogoPlaceholder label="Secondary Brand Mark Slot" compact />
        </div>

        <div className="hero-copy">
          <p className="eyebrow">Official Gym Affiliation Program</p>
          <h1>BKFC Affiliate Gym Network</h1>
          <p className="hero-subtitle">
            A structured gym development program connecting selected combat
            sports facilities to the BKFC international ecosystem.
          </p>
          <p className="hero-supporting">
            Built for gyms with serious standards, athlete potential,
            and long-term growth ambition inside and expanding 
            BKFC network.
        
          
          
          </p>

          <div className="hero-actions">
            <a href="#application-form" className="cta-button">
              Apply Now
            </a>
            <a href="#program-definition" className="secondary-button">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      <SectionNav />

      <section className="panel content-section" id="program-definition">
        <div className="section-heading">
          <p className="eyebrow">Program Definition</p>
          <h2>What the BKFC Affiliate Gym Program is:</h2>
        </div>
        <p>
          The BKFC Affiliate Gym Program is a structured affiliation model for
          selected combat sports gyms that demonstrate strong standards,
          development potential, and alignment with BKFC’s international growth
          direction. It is not simply a listing or badge. 
          </p>
          <p className="section-support">
            It is a performance-
          driven network designed to connect serious gyms with visibility,
          athlete pathways, and future activation opportunities inside the BKFC
          ecosystem.
          </p>
      </section>

      <section className="panel content-section" id="fighter-pathway">
        <div className="section-heading">
          <p className="eyebrow">Fighter Pathway</p>
          <h2>How gyms connect athletes to the BKFC ecosystem</h2>
        </div>

        <div className="pathway-grid">
          <div className="pathway-step">Affiliate Gym</div>
          <div className="pathway-arrow">→</div>
          <div className="pathway-step">Talent Visibility</div>
          <div className="pathway-arrow">→</div>
          <div className="pathway-step">BKFC Tryouts</div>
          <div className="pathway-arrow">→</div>
          <div className="pathway-step">Selection Opportunity</div>
        </div>

        <p className="section-support">
          The program is designed to create a more direct bridge between strong
          gyms, emerging athletes, and future BKFC opportunities.
        </p>
      </section>

      <section className="content-section" id="tier-ladder">
        <div className="section-heading center-heading">
          <p className="eyebrow">Tier Ladder</p>
          <h2>Performance-based progression inside the network</h2>
          <p className="section-support tier-intro">
            The BKFC Affiliate Gym Program is build as a tier-based network,
            allowing gyms to strengthen their position over time through consistency,
            standards, activity and overall program value.
          </p>
        </div>

        <div className="three-card-grid">
          {tierItems.map((item) => (
            <article className="panel tier-card" key={item.title}>
              <span className="tier-kicker">Affiliate Level</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
  className="panel content-section highlight-section"
  id="gym-of-the-month"
>
  <div className="section-heading">
    <p className="eyebrow">Gym of the Month</p>
    <h2>Recurring recognition for standout affiliate gyms</h2>
  </div>

  <p>
    The BKFC Affiliate Gym Program is designed to stay active throughout the
    year. Through a recurring Gym of the Month feature, BKFC can spotlight
    affiliate gyms that demonstrate strong standards, visible activity, and
    meaningful contribution to the network.
  </p>

  <p className="section-support">
    More than simple recognition, this mechanism creates momentum across the
    program and gives standout gyms an additional layer of visibility, prestige,
    and future activation potential within the BKFC ecosystem.
  </p>

  <div className="recognition-strip">
    <div className="recognition-pill">Monthly spotlight</div>
    <div className="recognition-pill">Extra visibility</div>
    <div className="recognition-pill">Program prestige</div>
    <div className="recognition-pill">Future activation potential</div>
  </div>
</section>

      <section className="panel content-section" id="expectations">
  <div className="section-heading">
    <p className="eyebrow">Expectations</p>
    <h2>What BKFC looks for in affiliate gyms</h2>
  </div>

  <p>
    The BKFC Affiliate Gym Program is intended for serious gyms that can
    represent the standard of the network properly. Acceptance is based not only
    on interest, but on structure, professionalism, development value, and
    long-term alignment.
  </p>

  <ul className="clean-list expectations-list">
    {expectationItems.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
</section>

      <section className="benefits-section" id="benefits">
        <div className="benefits-container">
          <div className="benefits-header">
            <p className="benefits-label">Benefits</p>
            <h2>Why selected gyms join the program</h2>
            <p className="benefits-subtitle">
  The BKFC Affiliate Gym Program is designed to create value across brand
  visibility, fighter opportunity, and long-term gym development inside a
  structured international network.
</p>
          </div>

          <div className="benefit-groups">
            {benefitGroups.map((group) => (
              <article className="benefit-group-card" key={group.title}>
                <span className="benefit-kicker">Program Value</span>
                <h3>{group.title}</h3>
                <ul className="clean-list benefit-list">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

     <section className="panel content-section" id="selection-process">
  <div className="section-heading">
    <p className="eyebrow">Selection Process</p>
    <h2>How gyms enter the program</h2>
  </div>

  <p>
    Entry into the BKFC Affiliate Gym Program follows a structured evaluation
    process. Each application is reviewed individually to ensure alignment with
    program standards, coaching structure, and long-term development potential.
  </p>

  <ol className="selection-steps">
    <li>Application submission through the official affiliate form</li>
    <li>Internal review by BKFC International Development</li>
    <li>Evaluation of gym structure, coaching environment, and positioning</li>
    <li>Program alignment confirmation and onboarding preparation</li>
  </ol>
</section>

      <section className="info-grid" id="starter-kit-preview">
  <article className="panel">
    <div className="section-heading">
      <p className="eyebrow">Starter Kit Preview</p>
      <h2>What accepted gyms move toward</h2>
    </div>
    <p>
  Accepted gyms enter a structured onboarding pathway designed to position
  them inside the BKFC international development network.
</p>
<p className="section-support">
  More than a welcome layer, the starter kit acts as the first operational
  step in aligning a gym with BKFC program structure, communication standards,
  and future opportunity channels.
</p>
  </article>

  <aside className="panel prep-panel">
    <div className="section-heading">
      <p className="eyebrow">Included direction</p>
      <h2>Preview items</h2>
    </div>
    <ul className="starter-kit-list">
      {starterKitItems.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  </aside>
</section>

     <section className="panel content-section expansion-section" id="expansion-positioning">
  <div className="section-heading">
    <p className="eyebrow">Expansion Positioning</p>
    <h2>Entering at the foundation stage of a growing network</h2>
  </div>

  <p>
    BKFC is building a broader international gym ecosystem around affiliate
    structure, athlete development, and long-term market expansion.
  </p>

  <p className="section-support">
    Early affiliate gyms are not joining after the system is already crowded.
    They are entering while the network is still being shaped, creating stronger
    long-term positioning inside a developing BKFC international framework.
  </p>
</section>

      <section
        id="application-form"
        className="form-section panel"
        aria-labelledby="form-heading"
      >
        <div className="section-heading">
          <p className="eyebrow">Official Affiliation Application</p>
          <h2 id="form-heading">Apply for BKFC Affiliate Gym Network review</h2>

          <p className="form-confidence">
            All information submitted through this application is reviewed
            confidentially by BKFC International Development and used solely for
            internal evaluation of affiliation eligibility, operational fit, and
            program alignment.
          </p>
        </div>

        <div className="prep-inline panel-soft">
          <div>
            <p className="eyebrow">Before submitting</p>
            <h3>Please prepare the following materials:</h3>
          </div>
          <ul>
            {prepItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <RegistrationForm />
      </section>

      <section className="faq-section" id="faq">
        <div className="faq-container">
          <div className="faq-header">
            <p className="faq-label">FAQ</p>
            <h2>Frequently Asked Questions</h2>
            <p className="faq-subtitle">
              Everything you need to know about the BKFC Affiliate Program. If
              you need additional assistance, contact{" "}
              <a href="mailto:affiliate@bkfc.com">affiliate@bkfc.com</a>
            </p>
          </div>

          <FaqAccordion />
        </div>
      </section>

      <footer className="site-footer" id="support">
        <div className="footer-inner">
          <div className="footer-brand">
            <img
              src="/bkfc-footer-logo.png"
              alt="BKFC"
              className="footer-logo"
            />
          </div>

          <div className="footer-column">
            <p className="footer-label">Program Support</p>
            <p>Questions regarding the Affiliate Gym Program may be directed to:</p>
            <a href="mailto:affiliate@bkfc.com">affiliate@bkfc.com</a>
          </div>

          <div className="footer-column">
            <p className="footer-label">Program notice</p>
            <p>
              Use of BKFC branding, affiliate status, or related representations
              is permitted only after formal approval by BKFC International
              Development.
            </p>
          </div>
        </div>

        <div className="footer-legal">
          © Bare Knuckle Fighting Championship. All rights reserved.
        </div>
      </footer>
    </main>
  );
}