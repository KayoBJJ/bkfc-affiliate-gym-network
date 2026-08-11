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
    { id: "expectations", label: "Standards" },
    { id: "benefits", label: "Benefits" },
    { id: "selection-process", label: "Process" },
    { id: "faq", label: "FAQ" },
  ],

  es: [
    { id: "program-definition", label: "Programa" },
    { id: "fighter-pathway", label: "Ruta" },
    { id: "expectations", label: "Estándares" },
    { id: "benefits", label: "Beneficios" },
    { id: "selection-process", label: "Proceso" },
    { id: "faq", label: "FAQ" },
  ],

  pt: [
    { id: "program-definition", label: "Programa" },
    { id: "fighter-pathway", label: "Caminho" },
    { id: "expectations", label: "Padrões" },
    { id: "benefits", label: "Benefícios" },
    { id: "selection-process", label: "Processo" },
    { id: "faq", label: "FAQ" },
  ],

  ru: [
    { id: "program-definition", label: "Программа" },
    { id: "fighter-pathway", label: "Путь" },
    { id: "expectations", label: "Стандарты" },
    { id: "benefits", label: "Преимущества" },
    { id: "selection-process", label: "Процесс" },
    { id: "faq", label: "FAQ" },
  ],

  de: [
    { id: "program-definition", label: "Programm" },
    { id: "fighter-pathway", label: "Pfad" },
    { id: "expectations", label: "Standards" },
    { id: "benefits", label: "Vorteile" },
    { id: "selection-process", label: "Prozess" },
    { id: "faq", label: "FAQ" },
  ],

  it: [
    { id: "program-definition", label: "Programma" },
    { id: "fighter-pathway", label: "Percorso" },
    { id: "expectations", label: "Standard" },
    { id: "benefits", label: "Vantaggi" },
    { id: "selection-process", label: "Processo" },
    { id: "faq", label: "FAQ" },
  ],

  pl: [
    { id: "program-definition", label: "Program" },
    { id: "fighter-pathway", label: "Ścieżka" },
    { id: "expectations", label: "Standardy" },
    { id: "benefits", label: "Korzyści" },
    { id: "selection-process", label: "Proces" },
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

const navigationCopyByLanguage: Record<
  LanguageCode,
  { label: string; menu: string; open: string; close: string }
> = {
  en: { label: "Section navigation", menu: "Menu", open: "Open navigation menu", close: "Close navigation menu" },
  es: { label: "Navegación por secciones", menu: "Menú", open: "Abrir menú de navegación", close: "Cerrar menú de navegación" },
  pt: { label: "Navegação por seções", menu: "Menu", open: "Abrir menu de navegação", close: "Fechar menu de navegação" },
  ru: { label: "Навигация по разделам", menu: "Меню", open: "Открыть меню навигации", close: "Закрыть меню навигации" },
  de: { label: "Bereichsnavigation", menu: "Menü", open: "Navigationsmenü öffnen", close: "Navigationsmenü schließen" },
  it: { label: "Navigazione delle sezioni", menu: "Menu", open: "Apri il menu di navigazione", close: "Chiudi il menu di navigazione" },
  pl: { label: "Nawigacja po sekcjach", menu: "Menu", open: "Otwórz menu nawigacji", close: "Zamknij menu nawigacji" },
};

export function SectionNav({ language }: SectionNavProps) {
  const [activeSection, setActiveSection] = useState("program-definition");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sections = sectionsByLanguage[language] ?? sectionsByLanguage.en;
  const applyCtaLabel = applyCtaByLanguage[language] ?? applyCtaByLanguage.en;
  const navigationCopy = navigationCopyByLanguage[language] ?? navigationCopyByLanguage.en;

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

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  const mobileMenuId = "section-nav-menu";

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="section-nav" aria-label={navigationCopy.label}>
      <button
        type="button"
        className="section-nav-toggle"
        aria-label={isMobileMenuOpen ? navigationCopy.close : navigationCopy.open}
        aria-expanded={isMobileMenuOpen}
        aria-controls={mobileMenuId}
        onClick={() => setIsMobileMenuOpen((current) => !current)}
      >
        <span>{navigationCopy.menu}</span>
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
            aria-current={activeSection === section.id ? "location" : undefined}
            onClick={handleLinkClick}
          >
            {section.label}
          </a>
        ))}
        <a
          href="#application-form"
          className="section-nav-cta"
          onClick={handleLinkClick}
        >
          {applyCtaLabel}<span aria-hidden="true">→</span>
        </a>
      </div>
    </nav>
  );
}
