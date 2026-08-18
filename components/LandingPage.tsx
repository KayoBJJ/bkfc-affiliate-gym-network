"use client";

import { Fragment, useEffect, useState } from "react";
import { FaqAccordion } from "@/components/FaqAccordion";
import { RegistrationForm } from "@/components/RegistrationForm";
import { SectionNav } from "@/components/SectionNav";
import {
  languages,
  translations,
  type LanguageCode,
} from "@/lib/i18n/translations";

const languageSelectLabels: Record<LanguageCode, string> = {
  en: "Select language",
  es: "Seleccionar idioma",
  pt: "Selecionar idioma",
  ru: "Выбрать язык",
  de: "Sprache auswählen",
  it: "Seleziona lingua",
  pl: "Wybierz język",
};

export function LandingPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const t = translations[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const tierItems = [
    { title: t.tier1Title, copy: t.tier1Copy },
    { title: t.tier2Title, copy: t.tier2Copy },
    { title: t.tier3Title, copy: t.tier3Copy },
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
    {
      title: t.benefitGroup4Title,
      items: [t.benefitGroup4Item1],
    },
  ];

  const selectionSteps = [
    t.selectionStep1,
    t.selectionStep2,
    t.selectionStep3,
    t.selectionStep4,
  ];

  const fighterPathwaySteps = [
    { title: t.fighterPathwayStep1, microcopy: t.fighterPathwayStep1Microcopy },
    { title: t.fighterPathwayStep2, microcopy: t.fighterPathwayStep2Microcopy },
    { title: t.fighterPathwayStep3, microcopy: t.fighterPathwayStep3Microcopy },
    { title: t.fighterPathwayStep4, microcopy: t.fighterPathwayStep4Microcopy },
  ];

  const starterKitItems = [
    t.starterItem1,
    t.starterItem2,
    t.starterItem3,
    t.starterItem4,
    t.starterItem5,
  ];

  const prepItems = [
    t.prepItem1,
    t.prepItem2,
    t.prepItem3,
    t.prepItem4,
    t.prepItem5,
  ];

  return (
    <main className="landing-page">
      <div className="landing-grain" aria-hidden="true" />

      <section className="fight-hero" id="hero">
        <header className="fight-header">
          <a className="fight-brand" href="#hero" aria-label="BKFC Affiliate Gym Network home">
            <img src="/bkfc-logo.png" alt="BKFC" />
          </a>

          <div className="fight-header-meta">
            <a href="#application-form">{t.navApply}</a>
          </div>

          <div className="language-switcher fight-language-switcher">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              className="language-select"
              aria-label={languageSelectLabels[language]}
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.shortLabel}
                </option>
              ))}
            </select>
            <span className="language-chevron" aria-hidden="true">▾</span>
          </div>
        </header>

        <div className="fight-hero-stage">
          <div className="fight-hero-copy">
            <p className="fight-kicker">
              {t.heroEyebrow}
            </p>
            <h1>{t.heroTitle}</h1>
            <p className="fight-hero-subtitle">{t.heroSubtitle}</p>
            <p className="fight-hero-supporting">{t.heroSupporting}</p>

            <div className="fight-actions">
              <a href="#application-form" className="fight-button fight-button-primary">
                {t.heroPrimaryCta}<span aria-hidden="true">→</span>
              </a>
              <a href="#program-definition" className="fight-button fight-button-secondary">
                {t.heroSecondaryCta}
              </a>
            </div>
          </div>

          <div className="fight-hero-rail" aria-label="Program highlights">
            <div><span>01</span><strong>{t.sectionProgramEyebrow}</strong></div>
            <div><span>02</span><strong>{t.fighterPathwayEyebrow}</strong></div>
            <div><span>03</span><strong>{t.expansionEyebrow}</strong></div>
          </div>
        </div>
      </section>

      <SectionNav language={language} />

      <section className="editorial-section program-intro" id="program-definition">
        <div className="section-index" aria-hidden="true">01</div>
        <div className="editorial-heading">
          <p className="fight-eyebrow">{t.sectionProgramEyebrow}</p>
          <h2>{t.sectionProgramTitle}</h2>
        </div>
        <div className="editorial-copy">
          <p>{t.sectionProgramText}</p>
          <p className="editorial-support">{t.sectionProgramSupport}</p>
        </div>
      </section>

      <section className="pathway-section" id="fighter-pathway">
        <div className="pathway-intro">
          <p className="fight-eyebrow">{t.fighterPathwayEyebrow}</p>
          <h2>{t.fighterPathwayTitle}</h2>
          <p>{t.fighterPathwaySupport}</p>
        </div>

        <div className="pathway-grid">
          {fighterPathwaySteps.map((step, index) => (
            <Fragment key={step.title}>
              <article className="pathway-step">
                <span className="pathway-number">0{index + 1}</span>
                <span className="pathway-step-title">{step.title}</span>
                <span className="pathway-step-copy">{step.microcopy}</span>
              </article>
              {index < fighterPathwaySteps.length - 1 ? (
                <span className="pathway-arrow" aria-hidden="true">→</span>
              ) : null}
            </Fragment>
          ))}
        </div>
      </section>

      <section className="tier-section" id="tier-ladder">
        <div className="section-title-row">
          <div>
            <p className="fight-eyebrow">{t.tierEyebrow}</p>
            <h2>{t.tierTitle}</h2>
          </div>
          <p>{t.tierIntro}</p>
        </div>

        <div className="tier-grid">
          {tierItems.map((item, index) => (
            <article className="tier-card" key={item.title}>
              <div className="tier-card-topline">
                <span>{t.tierKicker}</span>
                <strong>0{index + 1}</strong>
              </div>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="spotlight-section" id="gym-of-the-month">
        <div className="spotlight-image" aria-hidden="true">
          <span>{t.gymMonthEyebrow}</span>
        </div>
        <div className="spotlight-copy">
          <p className="fight-eyebrow">{t.gymMonthEyebrow}</p>
          <h2>{t.gymMonthTitle}</h2>
          <p>{t.gymMonthText}</p>
          <p className="editorial-support">{t.gymMonthSupport}</p>
          <div className="recognition-strip">
            {gymMonthPills.map((pill) => <span key={pill}>{pill}</span>)}
          </div>
        </div>
      </section>

      <section className="standards-section" id="expectations">
        <div className="standards-heading">
          <p className="fight-eyebrow">{t.expectationsEyebrow}</p>
          <h2>{t.expectationsTitle}</h2>
          <p>{t.expectationsText}</p>
        </div>
        <ol className="standards-list">
          {expectationItems.map((item, index) => (
            <li key={item}><span>0{index + 1}</span><p>{item}</p></li>
          ))}
        </ol>
      </section>

      <section className="benefits-section" id="benefits">
        <div className="section-title-row benefits-header">
          <div>
            <p className="fight-eyebrow">{t.benefitsEyebrow}</p>
            <h2>{t.benefitsTitle}</h2>
          </div>
          <p>{t.benefitsSubtitle}</p>
        </div>

        <div className="benefit-groups">
          {benefitGroups.map((group, index) => (
            <article className="benefit-card" key={group.title}>
              <div className="benefit-card-index">0{index + 1}</div>
              <p className="benefit-kicker">{t.benefitKicker}</p>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="process-section" id="selection-process">
        <div className="process-copy">
          <p className="fight-eyebrow">{t.selectionEyebrow}</p>
          <h2>{t.selectionTitle}</h2>
          <p>{t.selectionText}</p>
        </div>
        <ol className="process-rail">
          {selectionSteps.map((step, index) => (
            <li key={step}>
              <span>0{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="starter-section" id="starter-kit-preview">
        <div className="starter-copy">
          <p className="fight-eyebrow">{t.starterEyebrow}</p>
          <h2>{t.starterTitle}</h2>
          <p>{t.starterText}</p>
          <p className="editorial-support">{t.starterSupport}</p>
        </div>
        <aside className="starter-card">
          <p className="fight-eyebrow">{t.starterIncludedEyebrow}</p>
          <h3>{t.starterIncludedTitle}</h3>
          <ul>
            {starterKitItems.map((item, index) => (
              <li key={item}><span>0{index + 1}</span>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="expansion-section" id="expansion-positioning">
        <div>
          <p className="fight-eyebrow">{t.expansionEyebrow}</p>
          <h2>{t.expansionTitle}</h2>
          <p>{t.expansionText}</p>
          <p className="editorial-support">{t.expansionSupport}</p>
        </div>
        <span className="expansion-mark" aria-hidden="true">BKFC</span>
      </section>

      <section id="application-form" className="application-section" aria-labelledby="form-heading">
        <div className="application-header">
          <p className="fight-eyebrow">{t.applicationEyebrow}</p>
          <h2 id="form-heading">{t.applicationTitle}</h2>
          <p>{t.applicationText}</p>
          <p className="form-confidence">{t.applicationConfidence}</p>
        </div>

        <div className="prep-inline">
          <div>
            <p className="fight-eyebrow">{t.prepEyebrow}</p>
            <h3>{t.prepTitle}</h3>
            <p className="prep-copy">{t.prepCopy}</p>
          </div>
          <ul className="prep-materials-list">
            {prepItems.map((item, index) => (
              <li key={item}><span>0{index + 1}</span>{item}</li>
            ))}
          </ul>
        </div>

        <p className="submission-trust-note">{t.submissionTrustNote}</p>
        <div className="form-start-marker"><span>{t.applicationMarker}</span></div>
        <RegistrationForm language={language} />
      </section>

      <section className="faq-section" id="faq">
        <div className="faq-header">
          <p className="fight-eyebrow">{t.faqEyebrow}</p>
          <h2>{t.faqTitle}</h2>
          <p>
            {t.faqSubtitleStart}{" "}
            <a href="mailto:affiliate@bkfc.com">affiliate@bkfc.com</a>
          </p>
        </div>
        <FaqAccordion language={language} />
      </section>

      <footer className="site-footer" id="support">
        <div className="footer-brand">
          <img src="/bkfc-footer-logo.png" alt="BKFC Bare Knuckle Fighting Championship" />
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
        <div className="footer-legal">{t.footerLegal}</div>
      </footer>
    </main>
  );
}
