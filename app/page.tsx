import { LogoPlaceholder } from "@/components/LogoPlaceholder";
import { RegistrationForm } from "@/components/RegistrationForm";
import { FaqAccordion } from "@/components/FaqAccordion";
import { SectionNav } from "@/components/SectionNav";

const prepItems = [
  "logo",
  "gym photos",
  "website / Instagram",
  "fighter list (optional)",
  "promo video (optional)",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-topbar">
          <img
            src="/bkfc-logo.png"
            alt="BKFC Logo"
            style={{ height: "80px" }}
          />
          <LogoPlaceholder label="Secondary Brand Mark Slot" compact />
        </div>

        <div className="hero-copy">
          <p className="eyebrow">Official Gym Affiliation Application</p>
          <h1>BKFC Affiliate Gym Network</h1>
          <p className="hero-subtitle">
            Official application page for combat sports facilities interested in becoming part of the BKFC Affiliate Gym Network.
          </p>
         
        </div>
      </section>

      <SectionNav />

      <section className="info-grid" aria-labelledby="about-heading"
      id="overview">
        <article className="panel">
          <div className="section-heading">
            <p className="eyebrow">Information</p>
            <h2 id="about-heading">Purpose of this form</h2>
          </div>
          <p>
            This intake form is intended for selected gyms to submit
            their operational, facility, coaching, and contact information
            for internal review as part of the BKFC Affiliate Gym Network
            onboarding process.
          </p>
        </article>

        <aside className="panel prep-panel" aria-labelledby="prep-heading">
          <div className="section-heading">
            <p className="eyebrow">Before submitting the form</p>
            <h2 id="prep-heading">Please prepare the following materials:</h2>
          </div>
          <ul>
            {prepItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="benefits-section" aria-labelledby="benefits-heading"
      id="benefits">
        <div className="benefits-container">
          <div className="benefits-header">
            <p className="benefits-label">Program Benefits</p>
            <h2 id="benefits-heading">Why join the BKFC Affiliate Gym Program</h2>
            <p className="benefits-subtitle">
              The BKFC Affiliate Gym Network is designed to give selected gyms stronger
visibility, closer connection to the BKFC ecosystem, and access to future
development opportunities within BKFC’s international growth framework.
            </p>
          </div>

          <div className="benefits-grid">
            <article className="benefit-card">
              <h3>Official BKFC affiliation</h3>
              <p>
                Be recognised as an official affiliated BKFC Gym and 
                featured on the BKFC website, giving your gym global visability
                and credability.
              </p>
            </article>

            <article className="benefit-card">
              <h3>Priority athlete selection</h3>
              <p>
                Gain priority access for your fighters to be considered for 
                BKFC events, ensuring your talent is seen and developed on the biggest
                stage.
              </p>
            </article>

            <article className="benefit-card">
              <h3>BKFC Event & Tryout Hosting</h3>
              <p>
                Host BKFC tryouts and official activities at your facility,
                increasing your gym's exposure through BKFC's global channels.
              </p>
            </article>

            <article className="benefit-card">
              <h3>Global Media Exposure</h3>
              <p>
                Recieve dedicated promotion through BKFC's social media
                platforms, content features and marketing activisations.
              </p>
            </article>

            <article className="benefit-card">
              <h3>Merchandising Opportunities</h3>
              <p>
                Access BKFC merchandise at preferential rates and unlock
                the ability to sell official BKFC products within your gym.
              </p>
            </article>

            <article className="benefit-card">
              <h3>Seminars with BKFC Athletes</h3>
              <p>
                Benefit from exclusive rates for seminars and appearances
                by BKFC fighters and personalities at your gym.
              </p>
            </article>

            <article className="benefit-card benefit-last">
              <h3>Marketing & Promotional Support</h3>
              <p>
                Participate in coordinated BKFC marketing
                activations designed to increase your gym's visability,
                membership growth and athlete exposure. 
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="cta-section" aria-labelledby="cta-heading">
        <div className="cta-container">
          <p className="cta-label">Apply</p>
          <h2 id="cta-heading">Ready to join the BKFC Affiliate Gym Program?</h2>
          <p className="cta-copy">
            Submit your gym for review and take the next step toward official
            recognition within the BKFC Affiliate Gym Network.
          </p>
          <a href="#application-form" className="cta-button">
            Apply Now
          </a>
          <p className="cta-note">
      Submission of an application does not guarantee acceptance. All
      applications are subject to review and approval by BKFC International
      Development.
    </p>

  

        </div>
      </section>

      

      <section className="faq-section" id="faq">
        <div className="faq-container">
          <div className="faq-header">
            <p className="faq-label">FAQ</p>
            <h2>Frequently Asked Questions</h2>
            <p className="faq-subtitle">
              Everything you need to know about the BKFC Affiliate Program. If you
              need additional assistance, contact{" "}
              <a href="mailto:affiliate@bkfc.com">affiliate@bkfc.com</a>
            </p>
          </div>

          <FaqAccordion />
        </div>
      </section>

<section
        id="application-form"
        className="form-section panel"
        aria-labelledby="form-heading"
      >
        <div className="section-heading">
          <p className="eyebrow">Gym information submission</p>
          <h2 id="form-heading">Affiliate gym submission</h2>

      <p className="form-confidence">
      Information submitted through this form is reviewed confidentally by
      BKFC International Development and used solely for Affiliate Gym Program 
      evaluation purposes.
    </p>

        </div>
        <RegistrationForm />
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
        Use of BKFC branding, affiliate status, or related representations is
        permitted only after formal approval by BKFC International Development.
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