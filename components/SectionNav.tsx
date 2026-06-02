"use client";

import { useEffect, useState } from "react";
import type { LanguageCode } from "@/lib/i18n/translations";

type SectionItem = {
  id: string;
  label: string;
};

type SectionNavProps = {
  language: LanguageCode;
};

const sectionsByLanguage: Record<LanguageCode, SectionItem[]> = {
  en: [
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
  ],

  es: [
    { id: "program-definition", label: "Programa" },
    { id: "fighter-pathway", label: "Ruta" },
    { id: "tier-ladder", label: "Niveles" },
    { id: "gym-of-the-month", label: "Gimnasio del Mes" },
    { id: "expectations", label: "Estándares" },
    { id: "benefits", label: "Beneficios" },
    { id: "selection-process", label: "Proceso" },
    { id: "starter-kit-preview", label: "Starter Kit" },
    { id: "expansion-positioning", label: "Expansión" },
    { id: "application-form", label: "Aplicar" },
    { id: "faq", label: "FAQ" },
  ],

  pt: [
    { id: "program-definition", label: "Programa" },
    { id: "fighter-pathway", label: "Caminho" },
    { id: "tier-ladder", label: "Níveis" },
    { id: "gym-of-the-month", label: "Academia do Mês" },
    { id: "expectations", label: "Padrões" },
    { id: "benefits", label: "Benefícios" },
    { id: "selection-process", label: "Processo" },
    { id: "starter-kit-preview", label: "Starter Kit" },
    { id: "expansion-positioning", label: "Expansão" },
    { id: "application-form", label: "Candidatura" },
    { id: "faq", label: "FAQ" },
  ],

  ru: [
    { id: "program-definition", label: "Программа" },
    { id: "fighter-pathway", label: "Путь" },
    { id: "tier-ladder", label: "Уровни" },
    { id: "gym-of-the-month", label: "Зал месяца" },
    { id: "expectations", label: "Стандарты" },
    { id: "benefits", label: "Преимущества" },
    { id: "selection-process", label: "Процесс" },
    { id: "starter-kit-preview", label: "Starter Kit" },
    { id: "expansion-positioning", label: "Расширение" },
    { id: "application-form", label: "Заявка" },
    { id: "faq", label: "FAQ" },
  ],

  de: [
  { id: "program-definition", label: "Programm" },
  { id: "fighter-pathway", label: "Pfad" },
  { id: "tier-ladder", label: "Stufen" },
  { id: "gym-of-the-month", label: "Gym des Monats" },
  { id: "expectations", label: "Standards" },
  { id: "benefits", label: "Vorteile" },
  { id: "selection-process", label: "Prozess" },
  { id: "starter-kit-preview", label: "Starter Kit" },
  { id: "expansion-positioning", label: "Expansion" },
  { id: "application-form", label: "Bewerbung" },
  { id: "faq", label: "FAQ" },
],

it: [
  { id: "program-definition", label: "Programma" },
  { id: "fighter-pathway", label: "Percorso" },
  { id: "tier-ladder", label: "Livelli" },
  { id: "gym-of-the-month", label: "Palestra del mese" },
  { id: "expectations", label: "Standard" },
  { id: "benefits", label: "Vantaggi" },
  { id: "selection-process", label: "Processo" },
  { id: "starter-kit-preview", label: "Starter Kit" },
  { id: "expansion-positioning", label: "Espansione" },
  { id: "application-form", label: "Candidatura" },
  { id: "faq", label: "FAQ" },
],

pl: [
  { id: "program-definition", label: "Program" },
  { id: "fighter-pathway", label: "Ścieżka" },
  { id: "tier-ladder", label: "Poziomy" },
  { id: "gym-of-the-month", label: "Klub miesiąca" },
  { id: "expectations", label: "Standardy" },
  { id: "benefits", label: "Korzyści" },
  { id: "selection-process", label: "Proces" },
  { id: "starter-kit-preview", label: "Starter Kit" },
  { id: "expansion-positioning", label: "Ekspansja" },
  { id: "application-form", label: "Zgłoszenie" },
  { id: "faq", label: "FAQ" },
],

};

const applyCtaByLanguage: Record<LanguageCode, string> = {
  en: "Apply Now",
  es: "Aplicar Ahora",
  pt: "Candidatar-se",
  ru: "Подать заявку",
  de: "Jetzt bewerben",
  it: "Candidati ora",
  pl: "Aplikuj teraz",
};

export function SectionNav({ language }: SectionNavProps) {
  const [activeSection, setActiveSection] = useState("program-definition");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sections = sectionsByLanguage[language] ?? sectionsByLanguage.en;
  const applyCtaLabel = applyCtaByLanguage[language] ?? applyCtaByLanguage.en;

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
  }, [sections]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 769) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const mobileMenuId = "section-nav-menu";

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="section-nav" aria-label="Section navigation">
      <button
        type="button"
        className="section-nav-toggle"
        aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isMobileMenuOpen}
        aria-controls={mobileMenuId}
        onClick={() => setIsMobileMenuOpen((current) => !current)}
      >
        <span>Menu</span>
        <span className={`section-nav-toggle-icon ${isMobileMenuOpen ? "open" : ""}`}>
          <span />
          <span />
          <span />
        </span>
      </button>

      <div
        id={mobileMenuId}
        className={`section-nav-inner ${isMobileMenuOpen ? "open" : ""}`}
      >
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`section-nav-link ${
              activeSection === section.id ? "active" : ""
            }`}
            onClick={handleLinkClick}
          >
            {section.label}
          </a>
        ))}
        <a
          href="#application-form"
          className="section-nav-mobile-cta"
          onClick={handleLinkClick}
        >
          {applyCtaLabel}
        </a>
      </div>
    </nav>
  );
}
