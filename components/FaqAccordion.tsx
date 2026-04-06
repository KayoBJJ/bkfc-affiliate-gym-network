"use client";

import { useState } from "react";

const faqItems = [
  {
    question: "What is the BKFC Affiliate Program?",
    answer:
      "The BKFC Affiliate Program connects approved combat sports gyms with the official BKFC international development network.",
  },
  {
    question: "Who can apply?",
    answer:
      "Combat sports gyms, training centers, and martial arts facilities with a professional training environment may apply.",
  },
  {
    question: "Is every gym automatically accepted?",
    answer:
      "No. Submission of an application does not guarantee acceptance. Each gym is reviewed individually by BKFC International Development.",
  },
  {
    question: "Is there a membership fee?",
    answer:
      "Yes. Current membership options are €100 per month or €250 for three months.",
  },
  {
    question: "Who do I contact if I need assistance?",
    answer:
      "For questions regarding applications, eligibility, or affiliate benefits, contact affiliate@bkfc.com.",
  },
  {
    question: "What happens after I submit the application?",
    answer:
      "Applications are reviewed by BKFC International Development. During evaluation, additional information may be requested if necessary. Approved gyms will be contacted directly with the next steps for onboarding into the BKFC Affiliate Gym Network.",
  },
  {
    question: "Does submitting an application guarantee acceptance?",
    answer:
      "No. Submission of an application begins the evaluation process only. Affiliate Gym status is granted at the discretion of BKFC International Development following internal review.",
  },
  {
    question: "How long does the review process take?",
    answer:
      "Applications are typically reviewed within 5–10 business days. In some cases, additional time may be required depending on the volume of submissions or if further information is requested.",
  },
  {
    question: "Can we use BKFC branding after submitting the application?",
    answer:
      "No. Use of BKFC branding, affiliate status, or related representations is permitted only after formal approval by BKFC International Development.",
  },
  {
    question: "What types of gyms are eligible to apply?",
    answer:
      "Gyms with active coaching programs, structured training environments, and a demonstrated commitment to athlete development in combat sports are encouraged to apply. Each submission is reviewed individually as part of the evaluation process.",
  },
  {
    question: "Is there a fee to apply?",
    answer:
      "No. Submission of an Affiliate Gym Application does not require a fee. Additional program details will be provided to selected gyms during the onboarding process.",
  },
  {
    question: "Can gyms outside the United States apply?",
    answer:
      "Yes. The BKFC Affiliate Gym Program is an international initiative. Applications are accepted from gyms worldwide.",
  },
  {
    question: "What happens if our application is not approved?",
    answer:
      "Gyms that are not selected at the time of application may be invited to reapply in the future as the BKFC Affiliate Gym Network continues to expand.",
  },
  {
    question: "Does affiliate status guarantee fighter selection for BKFC events?",
    answer:
      "Affiliate status supports athlete visibility within the BKFC ecosystem but does not guarantee selection for events. Fighter participation decisions remain subject to matchmaking evaluation and event requirements.",
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
