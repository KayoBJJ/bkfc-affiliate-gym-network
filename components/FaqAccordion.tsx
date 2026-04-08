"use client";

import { useState } from "react";

const faqItems = [
  {
    question: "What is the BKFC Affiliate Gym Network?",
    answer:
      "The BKFC Affiliate Gym Network is an international affiliation program that connects approved combat sports facilities to the BKFC development ecosystem, including athlete visibility, program activation opportunities, and future integration into selected BKFC initiatives.",
  },
  {
    question: "Who can apply?",
    answer:
      "Combat sports gyms, training centres, and martial arts facilities with an established coaching structure, suitable training environment, and a clear commitment to athlete development may apply.",
  },
  {
    question: "Is every gym automatically accepted?",
    answer:
      "No. Submission of an application does not guarantee acceptance. Each facility is reviewed individually by BKFC International Development based on operational standards, program fit, and brand alignment.",
  },
  {
    question: "Is there a fee to apply?",
    answer:
      "No. Submission of an Affiliate Gym Application does not require a fee. Program fee details are shared only with selected gyms during the onboarding stage.",
  },
  {
    question: "Is there a membership fee after approval?",
    answer:
      "Yes. Current affiliation options are €100 per month or €250 for three months.",
  },
  {
    question: "What happens after I submit the application?",
    answer:
      "Applications are reviewed internally by BKFC International Development. During the evaluation process, additional information or clarification may be requested. Approved gyms are then contacted directly with the next steps for onboarding.",
  },
  {
    question: "How long does the review process take?",
    answer:
      "Applications are typically reviewed within 5–10 business days. In some cases, additional time may be required depending on submission volume or whether further information is needed.",
  },
  {
    question: "Can we use BKFC branding after submitting the application?",
    answer:
      "No. BKFC branding, affiliate status, and any related public representation may only be used after formal written approval has been granted by BKFC International Development.",
  },
  {
    question: "Can gyms outside the United States apply?",
    answer:
      "Yes. The BKFC Affiliate Gym Network is an international program and applications are accepted from qualifying gyms worldwide.",
  },
  {
    question: "Does affiliate status guarantee fighter selection for BKFC events?",
    answer:
      "No. Affiliate status may support athlete visibility within the BKFC ecosystem, but fighter participation in BKFC events remains subject to matchmaking evaluation, event requirements, and final internal approval.",
  },
  {
    question: "Can affiliate gyms host BKFC tryouts or official activities?",
    answer:
      "Affiliate status does not automatically grant hosting rights. Tryouts, seminars, and other official BKFC activities are approved separately and remain subject to BKFC’s event, territory, and operational requirements.",
  },
  {
    question: "What happens if our application is not approved?",
    answer:
      "Gyms that are not selected during the initial review may be invited to reapply in the future as the BKFC Affiliate Gym Network continues to expand into additional territories.",
  },
  {
    question: "Who do I contact if I need assistance?",
    answer:
      "For questions regarding applications, eligibility, or affiliate program details, contact affiliate@bkfc.com.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-list">
      {faqItems.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={item.question}
            className={`faq-item ${isOpen ? "open" : ""}`}
          >
            <button
              type="button"
              className="faq-question"
              onClick={() => toggleItem(index)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
             <span className={`faq-icon ${isOpen ? "open" : ""}`}>
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
</span>
            </button>

            <div className="faq-answer-wrap">
              <div className="faq-answer">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
