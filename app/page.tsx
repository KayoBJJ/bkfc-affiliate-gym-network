import { LogoPlaceholder } from "@/components/LogoPlaceholder";
import { RegistrationForm } from "@/components/RegistrationForm";
import { FaqAccordion } from "@/components/FaqAccordion";
import { SectionNav } from "@/components/SectionNav";

const tierItems = [
  {
    title: "Tier 1",
    copy:
      "Entry level affiliate status for approved gyms aligned with BKFC standards and ready to join the network foundation.",
  },
  {
    title: "Tier 2",
    copy:
      "Developing affiliate gyms demonstrating stronger activity, athlete pipeline potential, and local activation value.",
  },
  {
    title: "Tier 3",
    copy:
      "Top-performing gyms positioned for deeper BKFC visibility, stronger fighter opportunity, and special activation consideration.",
  },
];

const expectationItems = [
  "Professional training environment and strong operational standards",
  "Active coaching structure and athlete development focus",
  "Willingness to collaborate with BKFC program direction",
  "Capacity to represent the program properly at local level",
  "Commitment to long-term gym growth and brand alignment",
];

const benefitGroups = [
  {
    title: "Exposure",
    items: [
      "Official BKFC affiliate recognition",
      "Featured placement within the BKFC network ecosystem",
      "Social media and content visibility opportunities",
      "Stronger positioning for gyms looking to stand out locally and internationally",
    ],
  },
  {
    title: "Athlete Opportunity",
    items: [
      "Priority visibility for fighters connected to affiliate gyms",
      "Closer connection to BKFC tryouts, trials, and talent pathways",
      "Increased opportunity for athlete evaluation and development",
      "Stronger long-term bridge between gym talent and BKFC platforms",
    ],
  },
  {
    title: "Commercial & Program Advantages",
    items: [
      "Potential activation opportunities with BKFC initiatives",
      "Merchandising access and future promotional support",
      "Seminar and appearance opportunities connected to BKFC talent",
      "Access to a structured network designed for growth, not just affiliation",
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
            Built to support visibility, athlete opportunity, network growth,
            and future activation across serious gyms aligned with BKFC
            standards.
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
          <h2>What the BKFC Affiliate Gym Program is</h2>
        </div>
        <p>
          The BKFC Affiliate Gym Program is a structured affiliation model for
          selected combat sports gyms that demonstrate strong standards,
          development potential, and alignment with BKFC’s international growth
          direction. It is not simply a listing or badge. It is a performance-
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
          <div className="pathway-step">BKFC Tryouts / Trials</div>
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
        </div>

        <div className="three-card-grid">
          {tierItems.map((item) => (
            <article className="panel tier-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel content-section highlight-section" id="gym-of-the-month">
        <div className="section-heading">
          <p className="eyebrow">Gym of the Month</p>
          <h2>Ongoing recognition inside the affiliate network</h2>
        </div>
        <p>
          The program is designed to remain active, not static. Through a
          recurring Gym of the Month mechanism, BKFC can highlight strong gym
          performance, consistency, activity, and alignment. This creates
          momentum across the network while opening the door to additional
          visibility and future activation opportunities.
        </p>
      </section>

      <section className="panel content-section" id="expectations">
        <div className="section-heading">
          <p className="eyebrow">Expectations</p>
          <h2>What BKFC looks for in affiliate gyms</h2>
        </div>

        <ul className="clean-list">
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
              The BKFC Affiliate Gym Network is built to create meaningful value
              across visibility, athlete development, and long-term gym growth.
            </p>
          </div>

          <div className="benefit-groups">
            {benefitGroups.map((group) => (
              <article className="benefit-group-card" key={group.title}>
                <h3>{group.title}</h3>
                <ul className="clean-list">
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
          <h2>How gyms are reviewed</h2>
        </div>

        <div className="process-grid">
          <div className="process-step">
            <span>01</span>
            <h3>Application</h3>
            <p>Submit your gym information and supporting materials.</p>
          </div>
          <div className="process-step">
            <span>02</span>
            <h3>Internal Review</h3>
            <p>BKFC reviews operational fit, standards, and alignment.</p>
          </div>
          <div className="process-step">
            <span>03</span>
            <h3>Verification</h3>
            <p>Selected gyms may be contacted for additional confirmation.</p>
          </div>
          <div className="process-step">
            <span>04</span>
            <h3>Onboarding Decision</h3>
            <p>Approved gyms move into the next stage of program entry.</p>
          </div>
        </div>
      </section>

      <section className="info-grid" id="starter-kit-preview">
        <article className="panel">
          <div className="section-heading">
            <p className="eyebrow">Starter Kit Preview</p>
            <h2>What accepted gyms move toward</h2>
          </div>
          <p>
            Accepted gyms enter a more structured relationship with BKFC through
            onboarding support, recognition assets, program guidance, and a
            clearer pathway into future opportunities.
          </p>
        </article>

        <aside className="panel prep-panel">
          <div className="section-heading">
            <p className="eyebrow">Included direction</p>
            <h2>Preview items</h2>
          </div>
          <ul>
            {starterKitItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="panel content-section" id="expansion-positioning">
        <div className="section-heading">
          <p className="eyebrow">Expansion Positioning</p>
          <h2>Joining at the foundation stage of a growing network</h2>
        </div>
        <p>
          BKFC is building a broader international gym ecosystem around combat
          sports development, affiliate structure, and long-term market
          expansion. Early affiliate gyms are not entering late. They are
          entering while the network is still being shaped.
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
            <h3>Please prepare the following materials</h3>
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