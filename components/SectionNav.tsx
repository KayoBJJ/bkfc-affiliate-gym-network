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

};

export function SectionNav({ language }: SectionNavProps) {
  const [activeSection, setActiveSection] = useState("program-definition");
  const sections = sectionsByLanguage[language] ?? sectionsByLanguage.en;

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