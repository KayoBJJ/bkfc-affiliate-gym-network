"use client";

import { useState } from "react";
import { RegistrationForm } from "@/components/RegistrationForm";
import { FaqAccordion } from "@/components/FaqAccordion";
import { SectionNav } from "@/components/SectionNav";
import {
  languages,
  translations,
  type LanguageCode,
} from "@/lib/i18n/translations";


const expectationItems = [
  "A professional training environment with strong operational discipline",
  "Active coaching structure and a clear athlete development culture",
  "Willingness to align with BKFC program standards and direction",
  "Capacity to represent the program properly at local market level",
  "Long-term mindset toward gym growth, quality, and brand alignment",
];

export default function HomePage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const t = translations[language];
  
  const tierItems = [
  {
    title: t.tier1Title,
    copy: t.tier1Copy,
  },
  {
    title: t.tier2Title,
    copy: t.tier2Copy,
  },
  {
    title: t.tier3Title,
    copy: t.tier3Copy,
  },
];

const gymMonthPills = [
  t.gymMonthPill1,
  t.gymMonthPill2,
  t.gymMonthPill3,
  t.gymMonthPill4,
];

const expectationItems = [
  t.expectation1,
  t.expectation2,
  t.expectation3,
  t.expectation4,
  t.expectation5,
];

const benefitGroups = [
  {
    title: t.benefitGroup1Title,
    items: [
      t.benefitGroup1Item1,
      t.benefitGroup1Item2,
      t.benefitGroup1Item3,
      t.benefitGroup1Item4,
    ],
  },
  {
    title: t.benefitGroup2Title,
    items: [
      t.benefitGroup2Item1,
      t.benefitGroup2Item2,
      t.benefitGroup2Item3,
      t.benefitGroup2Item4,
    ],
  },
  {
    title: t.benefitGroup3Title,
    items: [
      t.benefitGroup3Item1,
      t.benefitGroup3Item2,
      t.benefitGroup3Item3,
      t.benefitGroup3Item4,
    ],
  },
];

const selectionSteps = [
   t.selectionStep1,
   t.selectionStep2,
   t.selectionStep3,
   t.selectionStep4,
];

const starterKitItems = [
   t.starterItem1,
   t.starterItem2,
   t.starterItem3,
   t.starterItem4,
   t.starterItem5,
]

 const prepItems = [
  t.prepItem1,
  t.prepItem2,
  t.prepItem3,
  t.prepItem4,
  t.prepItem5,
 ]

  return (
    <main className="page-shell">
      <section className="hero" id="hero">
        <div className="hero-topbar">
  <img src="/bkfc-logo.png" alt="BKFC Logo" style={{ height: "80px" }} />

  <div className="hero-topbar-actions">
    <div className="language-switcher">
  <select
    value={language}
    onChange={(event) => setLanguage(event.target.value as LanguageCode)}
    className="language-select"
    aria-label="Select language"
  >
    {languages.map((item) => (
      <option key={item.code} value={item.code}>
        {item.shortLabel}
      </option>
    ))}
  </select>

  <span className="language-chevron" aria-hidden="true">
    ▾
  </span>
 </div>
</div>
</div>

        <div className="hero-copy">
          <p className="eyebrow">{t.heroEyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="hero-subtitle">{t.heroSubtitle}</p>
          <p className="hero-supporting">{t.heroSupporting}</p>

          <div className="hero-actions">
            <a href="#application-form" className="cta-button">
              {t.heroPrimaryCta}
            </a>
            <a href="#program-definition" className="secondary-button">
              {t.heroSecondaryCta}
            </a>
          </div>
        </div>
      </section>

      <SectionNav language={language} />

      <section className="panel content-section" id="program-definition">
        <div className="section-heading">
  <p className="eyebrow">{t.sectionProgramEyebrow}</p>
  <h2>{t.sectionProgramTitle}</h2>
</div>

<p>{t.sectionProgramText}</p>

<p className="section-support">{t.sectionProgramSupport}</p>
      </section>

      <section className="panel content-section" id="fighter-pathway">
  <div className="section-heading">
    <p className="eyebrow">{t.fighterPathwayEyebrow}</p>
    <h2>{t.fighterPathwayTitle}</h2>
  </div>

  <div className="pathway-grid">
    <div className="pathway-step">{t.fighterPathwayStep1}</div>
    <div className="pathway-arrow">→</div>
    <div className="pathway-step">{t.fighterPathwayStep2}</div>
    <div className="pathway-arrow">→</div>
    <div className="pathway-step">{t.fighterPathwayStep3}</div>
    <div className="pathway-arrow">→</div>
    <div className="pathway-step">{t.fighterPathwayStep4}</div>
  </div>

  <p className="section-support">{t.fighterPathwaySupport}</p>
</section>

      <section className="content-section" id="tier-ladder">
  <div className="section-heading center-heading">
    <p className="eyebrow">{t.tierEyebrow}</p>
    <h2>{t.tierTitle}</h2>
    <p className="section-support tier-intro">{t.tierIntro}</p>
  </div>

        <div className="three-card-grid">
          {tierItems.map((item) => (
            <article className="panel tier-card" key={item.title}>
              <span className="tier-kicker">{t.tierKicker}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel content-section highlight-section" id="gym-of-the-month">
        <div className="section-heading">
  <p className="eyebrow">{t.gymMonthEyebrow}</p>
  <h2>{t.gymMonthTitle}</h2>
</div>

<p>{t.gymMonthText}</p>

<p className="section-support">{t.gymMonthSupport}</p>

<div className="recognition-strip">
  {gymMonthPills.map((pill) => (
    <div className="recognition-pill" key={pill}>
      {pill}
    </div>
  ))}
</div>
</section>

      <section className="panel content-section" id="expectations">
  <div className="section-heading">
    <p className="eyebrow">{t.expectationsEyebrow}</p>
    <h2>{t.expectationsTitle}</h2>
  </div>

  <p>{t.expectationsText}</p>

  <ul className="clean-list expectations-list">
    {expectationItems.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
</section>

      <section className="benefits-section" id="benefits">
  <div className="benefits-container">
    <div className="benefits-header">
      <p className="benefits-label">{t.benefitsEyebrow}</p>
      <h2>{t.benefitsTitle}</h2>
      <p className="benefits-subtitle">{t.benefitsSubtitle}</p>
    </div>

          <div className="benefit-groups">
            {benefitGroups.map((group) => (
              <article className="benefit-group-card panel" key={group.title}>
                <span className="benefit-kicker">{t.benefitKicker}</span>
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
    <p className="eyebrow">{t.selectionEyebrow}</p>
    <h2>{t.selectionTitle}</h2>
  </div>

  <p>{t.selectionText}</p>

  <ol className="selection-steps">
    {selectionSteps.map((step) => (
      <li key={step}>{step}</li>
    ))}
  </ol>
</section>

     <section className="info-grid" id="starter-kit-preview">
  <article className="panel">
    <div className="section-heading">
      <p className="eyebrow">{t.starterEyebrow}</p>
      <h2>{t.starterTitle}</h2>
    </div>
    <p>{t.starterText}</p>
    <p className="section-support">{t.starterSupport}</p>
  </article>

  <aside className="panel prep-panel">
    <div className="section-heading">
      <p className="eyebrow">{t.starterIncludedEyebrow}</p>
      <h2>{t.starterIncludedTitle}</h2>
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
    <p className="eyebrow">{t.expansionEyebrow}</p>
    <h2>{t.expansionTitle}</h2>
  </div>

  <p>{t.expansionText}</p>

  <p className="section-support">{t.expansionSupport}</p>
</section>

      <section
        id="application-form"
        className="form-section panel"
        aria-labelledby="form-heading"
      >
        <div className="section-heading">
  <p className="eyebrow">{t.applicationEyebrow}</p>
  <h2 id="form-heading">{t.applicationTitle}</h2>

  <p>{t.applicationText}</p>

  <p className="form-confidence">{t.applicationConfidence}</p>
</div>

        <div className="prep-inline panel-soft">
          <div>
  <p className="eyebrow">{t.prepEyebrow}</p>
  <h3>{t.prepTitle}</h3>
  <p className="prep-copy">{t.prepCopy}</p>
</div>
          <ul className="prep-materials-list">
            {prepItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

       <p className="submission-trust-note">{t.submissionTrustNote}</p>

<div className="form-start-marker">
  <span>{t.applicationMarker}</span>
</div>

        <RegistrationForm language={language} />
      </section>

      <section className="faq-section" id="faq">
        <div className="faq-container">
          <div className="faq-header">
            <p className="faq-label">{t.faqEyebrow}</p>
            <h2>{t.faqTitle}</h2>
            <p className="faq-subtitle">
              {t.faqSubtitleStart}{" "}
              <a href="mailto:affiliate@bkfc.com">affiliate@bkfc.com</a>
            </p>
          </div>

          <FaqAccordion  language={language} />
        </div>
      </section>

      <footer className="site-footer" id="support">
  <div className="footer-inner">
    <div className="footer-brand">
      <img src="/bkfc-footer-logo.png" alt="BKFC" className="footer-logo" />
    </div>

    <div className="footer-column">
      <p className="footer-label">{t.footerSupportLabel}</p>
      <p>{t.footerSupportText}</p>
      <a href="mailto:affiliate@bkfc.com">affiliate@bkfc.com</a>
    </div>

    <div className="footer-column">
      <p className="footer-label">{t.footerNoticeLabel}</p>
      <p>{t.footerNoticeText}</p>
    </div>
  </div>

  <div className="footer-legal">{t.footerLegal}</div>
</footer>
    </main>
  );
}
