"use client";

import { useEffect, useState } from "react";

const sections = [
  { id: "program-definition", label: "Program" },
  { id: "fighter-pathway", label: "Pathway" },
  { id: "tier-ladder", label: "Tiers" },
  { id: "gym-of-the-month", label: "Gym Month" },
  { id: "expectations", label: "Standards" },
  { id: "benefits", label: "Benefits" },
  { id: "selection-process", label: "Process" },
  { id: "starter-kit-preview", label: "Starter Kit" },
  { id: "expansion-positioning", label: "Expansion" },
  { id: "application-form", label: "Apply" },
  { id: "faq", label: "FAQ" },
];

export function SectionNav() {
  const [activeSection, setActiveSection] = useState("program-definition");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="section-nav" aria-label="Section navigation">
      <div className="section-nav-inner">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`section-nav-link ${
              activeSection === section.id ? "active" : ""
            }`}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}