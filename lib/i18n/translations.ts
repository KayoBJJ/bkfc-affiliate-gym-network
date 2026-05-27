export const languages = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "es", label: "Español", shortLabel: "ES" },
  { code: "pt", label: "Português", shortLabel: "PT" },
  { code: "ru", label: "Русский", shortLabel: "RU" },
  { code: "de", label: "Deutsch", shortLabel: "DE" },
  { code: "it", label: "Italiano", shortLabel: "IT"},
] as const;

export type LanguageCode = (typeof languages)[number]["code"];

export const translations = {
  en: {
    navApply: "Apply Now",
    heroEyebrow: "Official BKFC Development Network",
    heroTitle: "BKFC Gym Network",
    heroSubtitle:
      "A global affiliate program connecting approved combat sports gyms with the BKFC international development system.",
    heroSupporting: 
      "Build for gyms with serious standards, ahtlete potential, and long-term growth ambition inside an expanding BKFC network.",
    heroPrimaryCta: "Apply to Join",
    heroSecondaryCta: "Explore the Program",

    
    sectionProgramEyebrow: "Program Definition",
    sectionProgramTitle: "What the BKFC Affiliate Gym Program is",
    sectionProgramText:
      "The BKFC Gym Network gives selected gyms official alignment with BKFC, increased visibility, athlete pathway opportunities, and access to future activations across the BKFC ecosystem.",
    sectionProgramSupport:
      "It is a performance-driven network designed to connect serious gyms with visibility, athlete pathways, and future activation opportunities inside the BKFC ecosystem.",

      fighterPathwayEyebrow: "Fighter Pathway",
      fighterPathwayTitle: "How gyms connect athletes to the BKFC ecosystem",
      fighterPathwayStep1: "Affiliate Gym",
      fighterPathwayStep2: "Talent Visibility",
      fighterPathwayStep3: "BKFC Tryouts",
      fighterPathwayStep4: "Selection Opportunity",
      fighterPathwaySupport:
        "The program is designed to create a more direct bridge between strong gyms, emerging athletes, and future BKFC opportunities.",

    tierEyebrow: "Tier Ladder",
    tierTitle: "Performance-based progression inside the network",
    tierIntro:
      "The BKFC Affiliate Gym Program is built as a tier-based network, allowing gyms to strengthen their position over time through consistency, standards, activity, and overall program value.",
    tierKicker: "Affiliate Level",
    tier1Title: "Tier 1",
    tier1Copy:
      "Official entry into the BKFC Affiliate Gym Network for approved gyms that meet core standards and show strong structural potential.",
    tier2Title: "Tier 2",
    tier2Copy:
      "Progressive affiliate level for gyms demonstrating stronger activity, athlete development consistency, and growing value inside the network.",
    tier3Title: "Tier 3",
    tier3Copy:
      "Top-tier affiliate level reserved for standout gyms with the strongest momentum, recognition potential, and long-term BKFC activation upside.",

    gymMonthEyebrow: "Gym of the Month",
    gymMonthTitle: "Recurring recognition for standout affiliate gyms",
    gymMonthText:
      "The BKFC Affiliate Gym Program is designed to stay active throughout the year. Through a recurring Gym of the Month feature, BKFC can spotlight affiliate gyms that demonstrate strong standards, visible activity, and meaningful contribution to the network.",
    gymMonthSupport:
      "More than simple recognition, this mechanism creates momentum across the program and gives standout gyms an additional layer of visibility, prestige, and future activation potential within the BKFC ecosystem.",
    gymMonthPill1: "Monthly spotlight",
    gymMonthPill2: "Extra visibility",
    gymMonthPill3: "Program prestige",
    gymMonthPill4: "Future activation potential",

    expectationsEyebrow: "Expectations",
    expectationsTitle: "What BKFC looks for in affiliate gyms",
    expectationsText:
      "The BKFC Affiliate Gym Program is intended for serious gyms that can represent the standard of the network properly. Acceptance is based not only on interest, but on structure, professionalism, development value, and long-term alignment.",
    expectation1: "A professional training environment with strong operational discipline",
    expectation2: "Active coaching structure and a clear athlete development culture",
    expectation3: "Willingness to align with BKFC program standards and direction",
    expectation4: "Capacity to represent the program properly at local market level",
    expectation5: "Long-term mindset toward gym growth, quality, and brand alignment",

    benefitsEyebrow: "Benefits",
    benefitsTitle: "Why selected gyms join the program",
    benefitsSubtitle: 
      "The BKFC Affiliate Gym Program is designed to create value across brand visibility, fighter opportunity, and long-term gym development iside structured international network",
    
    
    benefitKicker: "Program Value",

    
    benefitGroup1Title: "Exposure",
    benefitGroup1Item1: "Official BKFC affiliate recognition",
    benefitGroup1Item2: "Positioning inside the BKFC international gym network",
    benefitGroup1Item3: "Visibility opportunities across BKFC digitital and content channels",
    benefitGroup1Item4: "Stronger credibility for gyms looking to grow locally and internationally",

    benefitGroup2Title: "Athele Opportunity",
    benefitGroup2Item1: "Priority visibility for fighters connected to affiliate gyms",
    benefitGroup2Item2: "Closer connection to BKFC tryouts, trials, and talent pathways",
    benefitGroup2Item3: "Stronger long-term bridge betweengym athletes and BKFC opportunity channels",
    benefitGroup2Item4: "Additionalvalue for gyms focused on developing competitive fighter",


    benefitGroup3Title: "Commercial & Program Advantages",
    benefitGroup3Item1: "Potential access to selected BKFC-related acctivations",
    benefitGroup3Item2: "Merchandising and promotional opportunity framework",
    benefitGroup3Item3: "Seminar and appearance possibilities connected to BKFC talent",
    benefitGroup3Item4: "Entry into a structured program built for growth, not just affiliation",


    selectionEyebrow: "Selection Process",
    selectionTitle: "How gyms enter the program",
    selectionText:
     "Entry into the BKFC Affiliate Gym Program follows a structured evaluation process. Each application is reviewed individually to ensure alignment with program standards, coaching structure, and long-term development potential.",
    selectionStep1: "Application submission through the official affiliate form",
    selectionStep2: "Internal review by BKFC International Development",
    selectionStep3: "Evaluation of gym structure, coaching environment, and positioning",
    selectionStep4: "Program alignment confirmation and onboarding preparation",


    starterEyebrow: "Starter Kit Preview",
    starterTitle: "What accepted gyms move toward",
    starterText:
      "Accepted gyms enter a structured onboarding pathway designed to position them inside the BKFC international development network.",
    starterSupport:
      "More than a welcome layer, the starter kit acts as the first operational step in aligning a gym with BKFC program structure, communication standards, and future opportunity channels.",
    starterIncludedEyebrow: "Included direction",
    starterIncludedTitle: "Preview items",
    starterItem1: "Affiliate onboarding guidance",
    starterItem2: "Program recognition assets",
    starterItem3: "Brand usage direction",
    starterItem4: "Program support framework",
    starterItem5: "Future activation and opportunity pathway",


  expansionEyebrow: "Expansion Positioning",
  expansionTitle: "Entering at the foundation stage of a growing network",
  expansionText:
    "BKFC is building a broader international gym ecosystem around affiliate structure, athlete development, and long-term market expansion.",
  expansionSupport:
    "Early affiliate gyms are not joining after the system is already crowded. They are entering while the network is still being shaped, creating stronger long-term positioning inside a developing BKFC international framework.",


  applicationEyebrow: "Official Affiliation Application",
applicationTitle: "Submit your gym for BKFC affiliate review",
applicationText:
  "Complete the official application below to present your gym for review by BKFC International Development.",
applicationConfidence:
  "Submission does not guarantee acceptance. Each application is reviewed individually based on program fit, operational standards, and long-term alignment with the BKFC affiliate network.",

prepEyebrow: "Before submitting",
prepTitle: "Prepare the following materials",
prepCopy:
  "Having these items ready will help BKFC review your application more efficiently and accurately.",
prepItem1: "Gym logo",
prepItem2: "Facility photos",
prepItem3: "Website or primary social media profile",
prepItem4: "Active fighter roster (optional)",
prepItem5: "Promotional video (optional)",

submissionTrustNote:
  "All submitted information is handled confidentially and used solely for internal BKFC affiliate program evaluation.",
applicationMarker: "Application Form",


faqEyebrow: "FAQ",
faqTitle: "Frequently Asked Questions",
faqSubtitleStart: 
 "Everything you need to know about the BKFC Affiliate Gym Program. If you need additional assistance, contact",


footerSupportLabel: "Program Support",
footerSupportText: 
 "Questions regarding the Affiliate Gym Program may be directed to:",
footerNoticeLabel: "Program notice",
footerNoticeText:
 "Use of BKFC branding, affiliate status, or related representations is premitted only after formal approval  by BKFC International Development",
footerLegal:
  "© Bare Knuckle Fighting Championship. All rights reserved.",


    formTitle: "Apply for BKFC Gym Network",
    formSubtitle:
      "Submit your gym details for review by the BKFC international development team.",
    submitButton: "Submit Application",
  },

  es: {
    navApply: "Aplicar Ahora",
    heroEyebrow: "Red Oficial de Desarrollo BKFC",
    heroTitle: "BKFC Gym Network",
    heroSubtitle:
      "Un programa global de afiliación que conecta gimnasios de deportes de combate aprobados con el sistema internacional de desarrollo de BKFC.",
    heroSupporting:
      "Creado para gimnasios con estándares serios, potencial atlético y ambición de crecimiento a largo plazo dentro de una red BKFC en expansión.",
    heroPrimaryCta: "Solicitar Adhesión",
    heroSecondaryCta: "Explorar el Programa",

    sectionProgramEyebrow: "El Programa",
    sectionProgramTitle: "Creado para gimnasios serios de deportes de combate.",
    sectionProgramText:
      "BKFC Gym Network ofrece a los gimnasios seleccionados una alineación oficial con BKFC, mayor visibilidad, oportunidades para atletas y acceso a futuras activaciones dentro del ecosistema BKFC.",
      sectionProgramSupport:
      "Es una red orientada al rendimiento, diseñada para conectar gimnasios serios con visibilidad, vías de desarrollo para atletas y futuras oportunidades de activación dentro del ecosistema BKFC.",

      fighterPathwayEyebrow: "Ruta del Atleta",
      fighterPathwayTitle: "Cómo los gimnasios conectan atletas con el ecosistema BKFC",
      fighterPathwayStep1: "Gimnasio Afiliado",
      fighterPathwayStep2: "Visibilidad del Talento",
      fighterPathwayStep3: "Tryouts BKFC",
      fighterPathwayStep4: "Oportunidad de Selección",
      fighterPathwaySupport:
        "El programa está diseñado para crear un puente más directo entre gimnasios sólidos, atletas emergentes y futuras oportunidades dentro de BKFC.",

        tierEyebrow: "Niveles del Programa",
    tierTitle: "Progresión basada en rendimiento dentro de la red",
    tierIntro:
      "El BKFC Affiliate Gym Program está construido como una red por niveles, permitiendo que los gimnasios fortalezcan su posición con el tiempo mediante consistencia, estándares, actividad y valor general para el programa.",
    tierKicker: "Nivel de Afiliación",
    tier1Title: "Nivel 1",
    tier1Copy:
      "Entrada oficial a BKFC Affiliate Gym Network para gimnasios aprobados que cumplen estándares básicos y muestran fuerte potencial estructural.",
    tier2Title: "Nivel 2",
    tier2Copy:
      "Nivel progresivo para gimnasios que demuestran mayor actividad, consistencia en el desarrollo de atletas y valor creciente dentro de la red.",
    tier3Title: "Nivel 3",
    tier3Copy:
      "Nivel superior reservado para gimnasios destacados con mayor impulso, potencial de reconocimiento y proyección de activación a largo plazo con BKFC.",

   
    gymMonthEyebrow: "Gimnasio del Mes",
    gymMonthTitle: "Reconocimiento recurrente para gimnasios afiliados destacados",
    gymMonthText:
      "El BKFC Affiliate Gym Program está diseñado para mantenerse activo durante todo el año. A través de la función Gimnasio del Mes, BKFC puede destacar gimnasios afiliados que demuestran altos estándares, actividad visible y una contribución significativa a la red.",
    gymMonthSupport:
      "Más que un simple reconocimiento, este mecanismo crea impulso dentro del programa y ofrece a los gimnasios destacados una capa adicional de visibilidad, prestigio y potencial de activación futura dentro del ecosistema BKFC.",
    gymMonthPill1: "Destacado mensual",
    gymMonthPill2: "Visibilidad adicional",
    gymMonthPill3: "Prestigio del programa",
    gymMonthPill4: "Potencial de activación futura",

    expectationsEyebrow: "Expectativas",
    expectationsTitle: "Qué busca BKFC en los gimnasios afiliados",
    expectationsText:
      "El BKFC Affiliate Gym Program está dirigido a gimnasios serios que puedan representar correctamente el estándar de la red. La aceptación no se basa solo en el interés, sino también en la estructura, el profesionalismo, el valor de desarrollo y la alineación a largo plazo.",
    expectation1: "Un entorno de entrenamiento profesional con fuerte disciplina operativa",
    expectation2: "Estructura activa de entrenadores y una cultura clara de desarrollo de atletas",
    expectation3: "Disposición para alinearse con los estándares y la dirección del programa BKFC",
    expectation4: "Capacidad para representar correctamente el programa en el mercado local",
    expectation5: "Mentalidad a largo plazo hacia el crecimiento, la calidad y la alineación de marca",

    benefitsEyebrow: "Beneficios",
benefitsTitle: "Por qué los gimnasios seleccionados se unen al programa",
benefitsSubtitle:
  "El BKFC Affiliate Gym Program está diseñado para crear valor en visibilidad de marca, oportunidades para atletas y desarrollo a largo plazo del gimnasio dentro de una red internacional estructurada.",

benefitKicker: "Valor del Programa",

benefitGroup1Title: "Exposición",
benefitGroup1Item1: "Reconocimiento oficial como gimnasio afiliado a BKFC",
benefitGroup1Item2: "Posicionamiento dentro de la red internacional de gimnasios BKFC",
benefitGroup1Item3: "Oportunidades de visibilidad en canales digitales y de contenido de BKFC",
benefitGroup1Item4: "Mayor credibilidad para gimnasios que buscan crecer local e internacionalmente",

benefitGroup2Title: "Oportunidad para Atletas",
benefitGroup2Item1: "Visibilidad prioritaria para peleadores conectados a gimnasios afiliados",
benefitGroup2Item2: "Conexión más cercana con tryouts, pruebas y vías de talento de BKFC",
benefitGroup2Item3: "Puente más sólido a largo plazo entre atletas de gimnasio y oportunidades BKFC",
benefitGroup2Item4: "Valor adicional para gimnasios enfocados en desarrollar peleadores competitivos",

benefitGroup3Title: "Ventajas Comerciales y del Programa",
benefitGroup3Item1: "Acceso potencial a activaciones seleccionadas relacionadas con BKFC",
benefitGroup3Item2: "Marco de oportunidades de merchandising y promoción",
benefitGroup3Item3: "Posibilidades de seminarios y apariciones vinculadas a talento BKFC",
benefitGroup3Item4: "Entrada a un programa estructurado para crecimiento, no solo afiliación",


selectionEyebrow: "Proceso de Selección",
selectionTitle: "Cómo los gimnasios entran al programa",
selectionText:
  "La entrada al BKFC Affiliate Gym Program sigue un proceso de evaluación estructurado. Cada solicitud se revisa individualmente para asegurar alineación con los estándares del programa, la estructura de entrenamiento y el potencial de desarrollo a largo plazo.",
selectionStep1: "Envío de la solicitud mediante el formulario oficial de afiliación",
selectionStep2: "Revisión interna por BKFC International Development",
selectionStep3: "Evaluación de la estructura del gimnasio, entorno de entrenamiento y posicionamiento",
selectionStep4: "Confirmación de alineación con el programa y preparación de onboarding",


starterEyebrow: "Vista Previa del Starter Kit",
starterTitle: "Hacia dónde avanzan los gimnasios aceptados",
starterText:
  "Los gimnasios aceptados entran en un proceso de onboarding estructurado, diseñado para posicionarlos dentro de la red internacional de desarrollo de BKFC.",
starterSupport:
  "Más que una capa de bienvenida, el starter kit funciona como el primer paso operativo para alinear un gimnasio con la estructura del programa BKFC, los estándares de comunicación y futuros canales de oportunidad.",
starterIncludedEyebrow: "Dirección incluida",
starterIncludedTitle: "Elementos incluidos",
starterItem1: "Guía de onboarding para afiliados",
starterItem2: "Materiales de reconocimiento del programa",
starterItem3: "Dirección de uso de marca",
starterItem4: "Marco de soporte del programa",
starterItem5: "Ruta hacia futuras activaciones y oportunidades",


expansionEyebrow: "Posicionamiento de Expansión",
expansionTitle: "Entrar en la etapa fundacional de una red en crecimiento",
expansionText:
  "BKFC está construyendo un ecosistema internacional más amplio de gimnasios alrededor de la estructura de afiliación, el desarrollo de atletas y la expansión de mercado a largo plazo.",
expansionSupport:
  "Los primeros gimnasios afiliados no entran cuando el sistema ya está saturado. Entran mientras la red todavía se está formando, creando un posicionamiento más fuerte a largo plazo dentro de un marco internacional BKFC en desarrollo.",


  applicationEyebrow: "Solicitud Oficial de Afiliación",
applicationTitle: "Envía tu gimnasio para revisión como afiliado BKFC",
applicationText:
  "Completa la solicitud oficial a continuación para presentar tu gimnasio a revisión por BKFC International Development.",
applicationConfidence:
  "El envío de la solicitud no garantiza la aceptación. Cada solicitud se revisa individualmente según el ajuste al programa, los estándares operativos y la alineación a largo plazo con la red de afiliados BKFC.",

prepEyebrow: "Antes de enviar",
prepTitle: "Prepara los siguientes materiales",
prepCopy:
  "Tener estos elementos listos ayudará a BKFC a revisar tu solicitud de forma más eficiente y precisa.",
prepItem1: "Logo del gimnasio",
prepItem2: "Fotos de la instalación",
prepItem3: "Sitio web o perfil principal en redes sociales",
prepItem4: "Roster activo de peleadores (opcional)",
prepItem5: "Video promocional (opcional)",

submissionTrustNote:
  "Toda la información enviada se maneja de forma confidencial y se utiliza únicamente para la evaluación interna del programa de afiliados BKFC.",
applicationMarker: "Formulario de Solicitud",


faqEyebrow: "FAQ",
faqTitle: "Preguntas Frecuentes",
faqSubtitleStart:
  "Todo lo que necesitas saber sobre el BKFC Affiliate Program. Si necesitas asistencia adicional, contacta a",


footerSupportLabel: "Soporte del Programa",
footerSupportText:
  "Las preguntas sobre el Affiliate Gym Program pueden dirigirse a:",
footerNoticeLabel: "Aviso del Programa",
footerNoticeText:
  "El uso de la marca BKFC, el estatus de afiliado o cualquier representación relacionada solo está permitido después de la aprobación formal de BKFC International Development.",
footerLegal:
  "© Bare Knuckle Fighting Championship. Todos los derechos reservados.",


    formTitle: "Aplicar a BKFC Gym Network",
    formSubtitle:
      "Envía los datos de tu gimnasio para revisión por el equipo internacional de desarrollo de BKFC.",
    submitButton: "Enviar Solicitud",
  },

  pt: {
    navApply: "Candidatar-se",
    heroEyebrow: "Rede Oficial de Desenvolvimento BKFC",
    heroTitle: "BKFC Gym Network",
    heroSubtitle:
      "Um programa global de afiliação que conecta academias aprovadas de esportes de combate ao sistema internacional de desenvolvimento da BKFC.",
    heroSupporting:
      "Criado para academias com padrões sérios, potencial atlético e ambição de crescimento a longo prazo dentro de uma rede BKFC em expansão.",
    heroPrimaryCta: "Solicitar Entrada",
    heroSecondaryCta: "Explorar o Programa",

    sectionProgramEyebrow: "O Programa",
    sectionProgramTitle: "Criado para academias sérias de esportes de combate.",
    sectionProgramText:
      "A BKFC Gym Network oferece às academias selecionadas alinhamento oficial com a BKFC, maior visibilidade, oportunidades para atletas e acesso a futuras ativações dentro do ecossistema BKFC.",
      sectionProgramSupport:
      "É uma rede orientada por desempenho, criada para conectar academias sérias com visibilidade, caminhos para atletas e futuras oportunidades de ativação dentro do ecossistema BKFC.",

      fighterPathwayEyebrow: "Caminho do Atleta",
      fighterPathwayTitle: "Como as academias conectam atletas ao ecossistema BKFC",
      fighterPathwayStep1: "Academia Afiliada",
      fighterPathwayStep2: "Visibilidade do Talento",
      fighterPathwayStep3: "Tryouts BKFC",
      fighterPathwayStep4: "Oportunidade de Seleção",
      fighterPathwaySupport:
        "O programa foi criado para formar uma ponte mais direta entre academias fortes, atletas em desenvolvimento e futuras oportunidades dentro da BKFC.",

    tierEyebrow: "Níveis do Programa",
    tierTitle: "Progressão baseada em desempenho dentro da rede",
    tierIntro:
      "O BKFC Affiliate Gym Program é construído como uma rede por níveis, permitindo que as academias fortaleçam sua posição ao longo do tempo por meio de consistência, padrões, atividade e valor geral para o programa.",
    tierKicker: "Nível de Afiliação",
    tier1Title: "Nível 1",
    tier1Copy:
      "Entrada oficial na BKFC Affiliate Gym Network para academias aprovadas que cumprem os padrões principais e demonstram forte potencial estrutural.",
    tier2Title: "Nível 2",
    tier2Copy:
      "Nível progressivo para academias que demonstram maior atividade, consistência no desenvolvimento de atletas e valor crescente dentro da rede.",
    tier3Title: "Nível 3",
    tier3Copy:
      "Nível superior reservado para academias de destaque com maior impulso, potencial de reconhecimento e projeção de ativação a longo prazo com a BKFC.",

    gymMonthEyebrow: "Academia do Mês",
    gymMonthTitle: "Reconhecimento recorrente para academias afiliadas de destaque",
    gymMonthText:
      "O BKFC Affiliate Gym Program foi criado para permanecer ativo durante todo o ano. Por meio do recurso Academia do Mês, a BKFC pode destacar academias afiliadas que demonstram padrões elevados, atividade visível e contribuição significativa para a rede.",
    gymMonthSupport:
      "Mais do que simples reconhecimento, esse mecanismo cria impulso dentro do programa e oferece às academias de destaque uma camada adicional de visibilidade, prestígio e potencial de ativação futura dentro do ecossistema BKFC.",
    gymMonthPill1: "Destaque mensal",
    gymMonthPill2: "Visibilidade extra",
    gymMonthPill3: "Prestígio do programa",
    gymMonthPill4: "Potencial de ativação futura",

    expectationsEyebrow: "Expectativas",
    expectationsTitle: "O que a BKFC procura nas academias afiliadas",
    expectationsText:
      "O BKFC Affiliate Gym Program é destinado a academias sérias que possam representar corretamente o padrão da rede. A aceitação não se baseia apenas no interesse, mas também na estrutura, profissionalismo, valor de desenvolvimento e alinhamento a longo prazo.",
    expectation1: "Um ambiente de treino profissional com forte disciplina operacional",
    expectation2: "Estrutura ativa de treinadores e uma cultura clara de desenvolvimento de atletas",
    expectation3: "Disposição para se alinhar aos padrões e à direção do programa BKFC",
    expectation4: "Capacidade de representar corretamente o programa no mercado local",
    expectation5: "Mentalidade de longo prazo voltada para crescimento, qualidade e alinhamento de marca",

    benefitsEyebrow: "Benefícios",
benefitsTitle: "Por que academias selecionadas entram no programa",
benefitsSubtitle:
  "O BKFC Affiliate Gym Program foi criado para gerar valor em visibilidade de marca, oportunidades para atletas e desenvolvimento de longo prazo da academia dentro de uma rede internacional estruturada.",

benefitKicker: "Valor do Programa",

benefitGroup1Title: "Exposição",
benefitGroup1Item1: "Reconhecimento oficial como academia afiliada à BKFC",
benefitGroup1Item2: "Posicionamento dentro da rede internacional de academias BKFC",
benefitGroup1Item3: "Oportunidades de visibilidade nos canais digitais e de conteúdo da BKFC",
benefitGroup1Item4: "Maior credibilidade para academias que buscam crescer local e internacionalmente",

benefitGroup2Title: "Oportunidade para Atletas",
benefitGroup2Item1: "Visibilidade prioritária para lutadores conectados a academias afiliadas",
benefitGroup2Item2: "Conexão mais próxima com tryouts, seletivas e caminhos de talento da BKFC",
benefitGroup2Item3: "Ponte mais forte de longo prazo entre atletas de academia e oportunidades BKFC",
benefitGroup2Item4: "Valor adicional para academias focadas no desenvolvimento de lutadores competitivos",

benefitGroup3Title: "Vantagens Comerciais e do Programa",
benefitGroup3Item1: "Acesso potencial a ativações selecionadas relacionadas à BKFC",
benefitGroup3Item2: "Estrutura de oportunidades de merchandising e promoção",
benefitGroup3Item3: "Possibilidades de seminários e aparições conectadas a talentos BKFC",
benefitGroup3Item4: "Entrada em um programa estruturado para crescimento, não apenas afiliação",


selectionEyebrow: "Processo de Seleção",
selectionTitle: "Como as academias entram no programa",
selectionText:
  "A entrada no BKFC Affiliate Gym Program segue um processo estruturado de avaliação. Cada candidatura é analisada individualmente para garantir alinhamento com os padrões do programa, estrutura de treino e potencial de desenvolvimento a longo prazo.",
selectionStep1: "Envio da candidatura pelo formulário oficial de afiliação",
selectionStep2: "Revisão interna pela BKFC International Development",
selectionStep3: "Avaliação da estrutura da academia, ambiente de treino e posicionamento",
selectionStep4: "Confirmação de alinhamento com o programa e preparação do onboarding",


starterEyebrow: "Prévia do Starter Kit",
starterTitle: "Para onde avançam as academias aceitas",
starterText:
  "As academias aceitas entram em um processo estruturado de onboarding, criado para posicioná-las dentro da rede internacional de desenvolvimento da BKFC.",
starterSupport:
  "Mais do que uma camada de boas-vindas, o starter kit funciona como o primeiro passo operacional para alinhar uma academia com a estrutura do programa BKFC, os padrões de comunicação e futuros canais de oportunidade.",
starterIncludedEyebrow: "Direção incluída",
starterIncludedTitle: "Itens de prévia",
starterItem1: "Guia de onboarding para afiliados",
starterItem2: "Materiais de reconhecimento do programa",
starterItem3: "Direção de uso da marca",
starterItem4: "Estrutura de suporte do programa",
starterItem5: "Caminho para futuras ativações e oportunidades",


expansionEyebrow: "Posicionamento de Expansão",
expansionTitle: "Entrar na fase fundacional de uma rede em crescimento",
expansionText:
  "A BKFC está construindo um ecossistema internacional mais amplo de academias em torno da estrutura de afiliação, desenvolvimento de atletas e expansão de mercado a longo prazo.",
expansionSupport:
  "As primeiras academias afiliadas não entram depois que o sistema já está lotado. Elas entram enquanto a rede ainda está sendo formada, criando um posicionamento mais forte a longo prazo dentro de uma estrutura internacional BKFC em desenvolvimento.",


  applicationEyebrow: "Candidatura Oficial de Afiliação",
applicationTitle: "Envie sua academia para revisão de afiliação BKFC",
applicationText:
  "Preencha a candidatura oficial abaixo para apresentar sua academia à análise da BKFC International Development.",
applicationConfidence:
  "O envio da candidatura não garante aceitação. Cada candidatura é analisada individualmente com base no ajuste ao programa, padrões operacionais e alinhamento de longo prazo com a rede de afiliados BKFC.",

prepEyebrow: "Antes de enviar",
prepTitle: "Prepare os seguintes materiais",
prepCopy:
  "Ter esses itens prontos ajudará a BKFC a analisar sua candidatura com mais eficiência e precisão.",
prepItem1: "Logo da academia",
prepItem2: "Fotos da instalação",
prepItem3: "Site ou principal perfil em redes sociais",
prepItem4: "Lista ativa de lutadores (opcional)",
prepItem5: "Vídeo promocional (opcional)",

submissionTrustNote:
  "Todas as informações enviadas são tratadas de forma confidencial e usadas exclusivamente para avaliação interna do programa de afiliados BKFC.",
applicationMarker: "Formulário de Candidatura",


faqEyebrow: "FAQ",
faqTitle: "Perguntas Frequentes",
faqSubtitleStart:
  "Tudo o que você precisa saber sobre o BKFC Affiliate Program. Se precisar de assistência adicional, entre em contato com",


footerSupportLabel: "Suporte do Programa",
footerSupportText:
  "Perguntas sobre o Affiliate Gym Program podem ser enviadas para:",
footerNoticeLabel: "Aviso do Programa",
footerNoticeText:
  "O uso da marca BKFC, status de afiliado ou representações relacionadas só é permitido após aprovação formal da BKFC International Development.",
footerLegal:
  "© Bare Knuckle Fighting Championship. Todos os direitos reservados.",


    formTitle: "Candidatar-se à BKFC Gym Network",
    formSubtitle:
      "Envie os dados da sua academia para análise pela equipe internacional de desenvolvimento da BKFC.",
    submitButton: "Enviar Candidatura",
  },

  ru: {
    navApply: "Подать заявку",
    heroEyebrow: "Официальная сеть развития BKFC",
    heroTitle: "BKFC Gym Network",
    heroSubtitle:
      "Глобальная партнерская программа, объединяющая одобренные залы единоборств с международной системой развития BKFC.",
    heroSupporting:
      "Создано для залов с серьезными стандартами, спортивным потенциалом и долгосрочными амбициями роста внутри расширяющейся сети BKFC.",
    heroPrimaryCta: "Подать заявку",
    heroSecondaryCta: "Изучить программу",

    sectionProgramEyebrow: "Программа",
    sectionProgramTitle: "Создано для серьезных залов единоборств.",
    sectionProgramText:
      "BKFC Gym Network предоставляет отобранным залам официальный статус в системе BKFC, повышенную видимость, возможности для спортсменов и доступ к будущим активациям внутри экосистемы BKFC.",
      sectionProgramSupport:
       "Это сеть, ориентированная на результат, созданная для того, чтобы соединять серьезные залы с видимостью, путями развития спортсменов и будущими возможностями активации внутри экосистемы BKFC.",

       fighterPathwayEyebrow: "Путь спортсмена",
       fighterPathwayTitle: "Как залы связывают спортсменов с экосистемой BKFC",
       fighterPathwayStep1: "Партнёрский зал",
       fighterPathwayStep2: "Видимость таланта",
       fighterPathwayStep3: "Tryouts BKFC",
       fighterPathwayStep4: "Возможность отбора",
       fighterPathwaySupport:
         "Программа создана для более прямой связи между сильными залами, перспективными спортсменами и будущими возможностями внутри BKFC.",

    tierEyebrow: "Уровни программы",
    tierTitle: "Прогресс внутри сети на основе результатов",
    tierIntro:
      "BKFC Affiliate Gym Program построена как многоуровневая сеть, позволяющая залам усиливать свои позиции со временем через стабильность, стандарты, активность и общую ценность для программы.",
    tierKicker: "Уровень партнёрства",
    tier1Title: "Уровень 1",
    tier1Copy:
      "Официальный вход в BKFC Affiliate Gym Network для одобренных залов, которые соответствуют базовым стандартам и показывают сильный структурный потенциал.",
    tier2Title: "Уровень 2",
    tier2Copy:
      "Прогрессивный партнёрский уровень для залов, демонстрирующих более высокую активность, стабильное развитие спортсменов и растущую ценность внутри сети.",
    tier3Title: "Уровень 3",
    tier3Copy:
      "Высший партнёрский уровень для выдающихся залов с сильной динамикой, потенциалом признания и долгосрочными возможностями активации с BKFC.",

    gymMonthEyebrow: "Зал месяца",
    gymMonthTitle: "Регулярное признание для выдающихся партнёрских залов",
    gymMonthText:
      "BKFC Affiliate Gym Program создана так, чтобы оставаться активной в течение всего года. Через формат «Зал месяца» BKFC может выделять партнёрские залы, которые демонстрируют высокий уровень стандартов, видимую активность и значимый вклад в развитие сети.",
    gymMonthSupport:
      "Это не просто признание. Такой механизм создаёт движение внутри программы и даёт выдающимся залам дополнительную видимость, престиж и потенциал для будущих активаций внутри экосистемы BKFC.",
    gymMonthPill1: "Ежемесячный фокус",
    gymMonthPill2: "Дополнительная видимость",
    gymMonthPill3: "Престиж программы",
    gymMonthPill4: "Потенциал будущих активаций",

    expectationsEyebrow: "Ожидания",
    expectationsTitle: "Что BKFC ищет в партнёрских залах",
    expectationsText:
      "BKFC Affiliate Gym Program предназначена для серьёзных залов, которые способны достойно представлять стандарт сети. Одобрение зависит не только от интереса, но и от структуры, профессионализма, ценности для развития и долгосрочного соответствия направлению BKFC.",
    expectation1: "Профессиональная тренировочная среда с сильной операционной дисциплиной",
    expectation2: "Активная тренерская структура и чёткая культура развития спортсменов",
    expectation3: "Готовность соответствовать стандартам и направлению программы BKFC",
    expectation4: "Способность правильно представлять программу на локальном рынке",
    expectation5: "Долгосрочное мышление в отношении роста зала, качества и соответствия бренду",

    benefitsEyebrow: "Преимущества",
benefitsTitle: "Почему отобранные залы присоединяются к программе",
benefitsSubtitle:
  "BKFC Affiliate Gym Program создана для того, чтобы давать ценность через видимость бренда, возможности для спортсменов и долгосрочное развитие зала внутри структурированной международной сети.",

benefitKicker: "Ценность программы",

benefitGroup1Title: "Медийность",
benefitGroup1Item1: "Официальное признание в качестве партнёрского зала BKFC",
benefitGroup1Item2: "Позиционирование внутри международной сети залов BKFC",
benefitGroup1Item3: "Возможности видимости через цифровые и контентные каналы BKFC",
benefitGroup1Item4: "Более сильная репутация для залов, стремящихся расти локально и международно",

benefitGroup2Title: "Возможности для спортсменов",
benefitGroup2Item1: "Приоритетная видимость для бойцов, связанных с партнёрскими залами",
benefitGroup2Item2: "Более тесная связь с tryouts, отборами и путями развития талантов BKFC",
benefitGroup2Item3: "Более прочный долгосрочный мост между спортсменами зала и возможностями BKFC",
benefitGroup2Item4: "Дополнительная ценность для залов, ориентированных на развитие конкурентных бойцов",

benefitGroup3Title: "Коммерческие и программные преимущества",
benefitGroup3Item1: "Потенциальный доступ к выбранным активациям, связанным с BKFC",
benefitGroup3Item2: "Структура возможностей для мерча и промо-активаций",
benefitGroup3Item3: "Возможности семинаров и появлений, связанных с талантами BKFC",
benefitGroup3Item4: "Вход в структурированную программу роста, а не просто получение статуса",


selectionEyebrow: "Процесс отбора",
selectionTitle: "Как залы входят в программу",
selectionText:
  "Вход в BKFC Affiliate Gym Program проходит через структурированный процесс оценки. Каждая заявка рассматривается индивидуально, чтобы подтвердить соответствие стандартам программы, тренерской структуре и долгосрочному потенциалу развития.",
selectionStep1: "Подача заявки через официальную форму партнёрской программы",
selectionStep2: "Внутренняя проверка командой BKFC International Development",
selectionStep3: "Оценка структуры зала, тренировочной среды и позиционирования",
selectionStep4: "Подтверждение соответствия программе и подготовка к onboarding",


starterEyebrow: "Превью стартового пакета",
starterTitle: "К чему переходят одобренные залы",
starterText:
  "Одобренные залы входят в структурированный onboarding-процесс, созданный для их позиционирования внутри международной сети развития BKFC.",
starterSupport:
  "Это не просто приветственный пакет. Starter kit становится первым операционным шагом в выравнивании зала со структурой программы BKFC, стандартами коммуникации и будущими каналами возможностей.",
starterIncludedEyebrow: "Что входит",
starterIncludedTitle: "Предварительный список",
starterItem1: "Инструкции по onboarding для партнёров",
starterItem2: "Материалы признания программы",
starterItem3: "Правила использования бренда",
starterItem4: "Структура поддержки программы",
starterItem5: "Путь к будущим активациям и возможностям",


expansionEyebrow: "Позиционирование в расширении",
expansionTitle: "Вход на фундаментальном этапе растущей сети",
expansionText:
  "BKFC строит более широкую международную экосистему залов вокруг партнёрской структуры, развития спортсменов и долгосрочного расширения рынка.",
expansionSupport:
  "Ранние партнёрские залы входят не тогда, когда система уже переполнена. Они входят в момент, когда сеть ещё формируется, создавая более сильное долгосрочное позиционирование внутри развивающейся международной структуры BKFC.",


  applicationEyebrow: "Официальная заявка на партнёрство",
applicationTitle: "Отправьте ваш зал на рассмотрение для партнёрства с BKFC",
applicationText:
  "Заполните официальную заявку ниже, чтобы представить ваш зал на рассмотрение команды BKFC International Development.",
applicationConfidence:
  "Подача заявки не гарантирует одобрение. Каждая заявка рассматривается индивидуально на основе соответствия программе, операционных стандартов и долгосрочного соответствия партнёрской сети BKFC.",

prepEyebrow: "Перед отправкой",
prepTitle: "Подготовьте следующие материалы",
prepCopy:
  "Наличие этих материалов поможет BKFC рассмотреть вашу заявку более эффективно и точно.",
prepItem1: "Логотип зала",
prepItem2: "Фотографии зала",
prepItem3: "Сайт или основной профиль в социальных сетях",
prepItem4: "Активный список бойцов (опционально)",
prepItem5: "Промо-видео (опционально)",

submissionTrustNote:
  "Вся отправленная информация обрабатывается конфиденциально и используется исключительно для внутренней оценки партнёрской программы BKFC.",
applicationMarker: "Форма заявки",


faqEyebrow: "FAQ",
faqTitle: "Часто задаваемые вопросы",
faqSubtitleStart:
  "Всё, что нужно знать о BKFC Affiliate Program. Если вам нужна дополнительная помощь, свяжитесь с",


footerSupportLabel: "Поддержка программы",
footerSupportText:
  "Вопросы по Affiliate Gym Program можно направлять на:",
footerNoticeLabel: "Уведомление программы",
footerNoticeText:
  "Использование брендинга BKFC, партнёрского статуса или любых связанных публичных заявлений разрешено только после официального одобрения BKFC International Development.",
footerLegal:
  "© Bare Knuckle Fighting Championship. Все права защищены.",


    formTitle: "Подать заявку в BKFC Gym Network",
    formSubtitle:
      "Отправьте данные вашего зала на рассмотрение международной команды развития BKFC.",
    submitButton: "Отправить заявку",
  },

  de: {
  navApply: "Jetzt bewerben",
  heroEyebrow: "Offizielles BKFC Entwicklungsnetzwerk",
  heroTitle: "BKFC Gym Network",
  heroSubtitle:
    "Ein globales Affiliate-Programm, das zugelassene Kampfsport-Gyms mit dem internationalen Entwicklungssystem von BKFC verbindet.",
  heroSupporting:
    "Entwickelt für Gyms mit hohen Standards, sportlichem Potenzial und langfristigem Wachstum innerhalb eines expandierenden BKFC Netzwerks.",
  heroPrimaryCta: "Bewerbung einreichen",
  heroSecondaryCta: "Programm ansehen",

  sectionProgramEyebrow: "Programmdefinition",
  sectionProgramTitle: "Was das BKFC Affiliate Gym Program ist",
  sectionProgramText:
    "Das BKFC Affiliate Gym Program ist ein strukturiertes Affiliate-Modell für ausgewählte Kampfsport-Gyms, die hohe Standards, Entwicklungspotenzial und eine Ausrichtung auf die internationale Wachstumsstrategie von BKFC zeigen. Es ist nicht einfach nur ein Eintrag oder ein Badge.",
  sectionProgramSupport:
    "Es ist ein leistungsorientiertes Netzwerk, das seriöse Gyms mit Sichtbarkeit, Athletenpfaden und zukünftigen Aktivierungsmöglichkeiten innerhalb des BKFC Ökosystems verbindet.",

  fighterPathwayEyebrow: "Athletenpfad",
  fighterPathwayTitle: "Wie Gyms Athleten mit dem BKFC Ökosystem verbinden",
  fighterPathwayStep1: "Affiliate Gym",
  fighterPathwayStep2: "Talent-Sichtbarkeit",
  fighterPathwayStep3: "BKFC Tryouts",
  fighterPathwayStep4: "Auswahlmöglichkeit",
  fighterPathwaySupport:
    "Das Programm ist darauf ausgelegt, eine direktere Brücke zwischen starken Gyms, aufstrebenden Athleten und zukünftigen BKFC Möglichkeiten zu schaffen.",

  tierEyebrow: "Stufenmodell",
  tierTitle: "Leistungsbasierter Fortschritt innerhalb des Netzwerks",
  tierIntro:
    "Das BKFC Affiliate Gym Program ist als stufenbasiertes Netzwerk aufgebaut und ermöglicht es Gyms, ihre Position im Laufe der Zeit durch Konstanz, Standards, Aktivität und Gesamtwert für das Programm zu stärken.",
  tierKicker: "Affiliate-Stufe",
  tier1Title: "Stufe 1",
  tier1Copy:
    "Offizieller Einstieg in das BKFC Affiliate Gym Network für zugelassene Gyms, die zentrale Standards erfüllen und starkes strukturelles Potenzial zeigen.",
  tier2Title: "Stufe 2",
  tier2Copy:
    "Fortgeschrittene Affiliate-Stufe für Gyms, die stärkere Aktivität, konstante Athletenentwicklung und wachsenden Wert innerhalb des Netzwerks demonstrieren.",
  tier3Title: "Stufe 3",
  tier3Copy:
    "Höchste Affiliate-Stufe für herausragende Gyms mit starker Dynamik, hohem Anerkennungspotenzial und langfristigem BKFC Aktivierungspotenzial.",

  gymMonthEyebrow: "Gym des Monats",
  gymMonthTitle: "Regelmäßige Anerkennung für herausragende Affiliate-Gyms",
  gymMonthText:
    "Das BKFC Affiliate Gym Program ist darauf ausgelegt, das ganze Jahr über aktiv zu bleiben. Durch das wiederkehrende Gym des Monats Feature kann BKFC Affiliate-Gyms hervorheben, die hohe Standards, sichtbare Aktivität und einen wertvollen Beitrag zum Netzwerk zeigen.",
  gymMonthSupport:
    "Mehr als einfache Anerkennung schafft dieser Mechanismus Dynamik im Programm und gibt herausragenden Gyms zusätzliche Sichtbarkeit, Prestige und zukünftiges Aktivierungspotenzial innerhalb des BKFC Ökosystems.",
  gymMonthPill1: "Monatliches Spotlight",
  gymMonthPill2: "Zusätzliche Sichtbarkeit",
  gymMonthPill3: "Programm-Prestige",
  gymMonthPill4: "Zukünftiges Aktivierungspotenzial",

  expectationsEyebrow: "Erwartungen",
  expectationsTitle: "Was BKFC bei Affiliate-Gyms sucht",
  expectationsText:
    "Das BKFC Affiliate Gym Program richtet sich an seriöse Gyms, die den Standard des Netzwerks angemessen repräsentieren können. Die Aufnahme basiert nicht nur auf Interesse, sondern auf Struktur, Professionalität, Entwicklungswert und langfristiger Ausrichtung.",
  expectation1: "Ein professionelles Trainingsumfeld mit starker operativer Disziplin",
  expectation2: "Aktive Trainerstruktur und klare Kultur der Athletenentwicklung",
  expectation3: "Bereitschaft, sich an den Standards und der Ausrichtung des BKFC Programms zu orientieren",
  expectation4: "Fähigkeit, das Programm auf lokaler Marktebene angemessen zu repräsentieren",
  expectation5: "Langfristige Denkweise in Bezug auf Gym-Wachstum, Qualität und Markenalignment",

  benefitsEyebrow: "Vorteile",
  benefitsTitle: "Warum ausgewählte Gyms dem Programm beitreten",
  benefitsSubtitle:
    "Das BKFC Affiliate Gym Program ist darauf ausgelegt, Wert in den Bereichen Marken-Sichtbarkeit, Athletenchancen und langfristige Gym-Entwicklung innerhalb eines strukturierten internationalen Netzwerks zu schaffen.",

  benefitKicker: "Programmwert",

  benefitGroup1Title: "Sichtbarkeit",
  benefitGroup1Item1: "Offizielle Anerkennung als BKFC Affiliate-Gym",
  benefitGroup1Item2: "Positionierung innerhalb des internationalen BKFC Gym-Netzwerks",
  benefitGroup1Item3: "Sichtbarkeitsmöglichkeiten über digitale BKFC Kanäle und Content-Plattformen",
  benefitGroup1Item4: "Stärkere Glaubwürdigkeit für Gyms, die lokal und international wachsen wollen",

  benefitGroup2Title: "Athletenchancen",
  benefitGroup2Item1: "Priorisierte Sichtbarkeit für Fighter aus Affiliate-Gyms",
  benefitGroup2Item2: "Nähere Verbindung zu BKFC Tryouts, Trials und Talentpfaden",
  benefitGroup2Item3: "Stärkere langfristige Brücke zwischen Gym-Athleten und BKFC Chancen",
  benefitGroup2Item4: "Zusätzlicher Wert für Gyms, die wettkampforientierte Fighter entwickeln",

  benefitGroup3Title: "Kommerzielle & Programmvorteile",
  benefitGroup3Item1: "Potenzieller Zugang zu ausgewählten BKFC-bezogenen Aktivierungen",
  benefitGroup3Item2: "Rahmen für Merchandising- und Promotion-Möglichkeiten",
  benefitGroup3Item3: "Seminar- und Auftrittsmöglichkeiten mit BKFC Talenten",
  benefitGroup3Item4: "Eintritt in ein strukturiertes Wachstumsprogramm, nicht nur in eine einfache Affiliation",

  selectionEyebrow: "Auswahlprozess",
  selectionTitle: "Wie Gyms in das Programm aufgenommen werden",
  selectionText:
    "Der Eintritt in das BKFC Affiliate Gym Program folgt einem strukturierten Bewertungsprozess. Jede Bewerbung wird individuell geprüft, um die Ausrichtung auf Programmstandards, Trainerstruktur und langfristiges Entwicklungspotenzial sicherzustellen.",
  selectionStep1: "Einreichung der Bewerbung über das offizielle Affiliate-Formular",
  selectionStep2: "Interne Prüfung durch BKFC International Development",
  selectionStep3: "Bewertung der Gym-Struktur, des Trainingsumfelds und der Positionierung",
  selectionStep4: "Bestätigung der Programmausrichtung und Vorbereitung des Onboardings",

  starterEyebrow: "Starter Kit Vorschau",
  starterTitle: "Worauf akzeptierte Gyms hinarbeiten",
  starterText:
    "Akzeptierte Gyms treten in einen strukturierten Onboarding-Prozess ein, der sie innerhalb des internationalen BKFC Entwicklungsnetzwerks positioniert.",
  starterSupport:
    "Mehr als nur eine Willkommensschicht ist das Starter Kit der erste operative Schritt, um ein Gym mit der BKFC Programmstruktur, Kommunikationsstandards und zukünftigen Chancenkanälen auszurichten.",
  starterIncludedEyebrow: "Enthaltene Richtung",
  starterIncludedTitle: "Vorschau-Elemente",
  starterItem1: "Affiliate-Onboarding-Leitfaden",
  starterItem2: "Anerkennungsassets des Programms",
  starterItem3: "Richtlinien zur Markennutzung",
  starterItem4: "Support-Struktur des Programms",
  starterItem5: "Pfad zu zukünftigen Aktivierungen und Chancen",

  expansionEyebrow: "Expansionspositionierung",
  expansionTitle: "Eintritt in die Grundphase eines wachsenden Netzwerks",
  expansionText:
    "BKFC baut ein breiteres internationales Gym-Ökosystem rund um Affiliate-Struktur, Athletenentwicklung und langfristige Marktexpansion auf.",
  expansionSupport:
    "Frühe Affiliate-Gyms treten nicht bei, nachdem das System bereits überfüllt ist. Sie treten ein, während das Netzwerk noch geformt wird, und schaffen dadurch eine stärkere langfristige Positionierung innerhalb eines wachsenden internationalen BKFC Rahmens.",

  applicationEyebrow: "Offizielle Affiliate-Bewerbung",
  applicationTitle: "Reichen Sie Ihr Gym zur BKFC Affiliate-Prüfung ein",
  applicationText:
    "Füllen Sie die offizielle Bewerbung unten aus, um Ihr Gym zur Prüfung durch BKFC International Development einzureichen.",
  applicationConfidence:
    "Die Einreichung garantiert keine Aufnahme. Jede Bewerbung wird individuell auf Programmfit, operative Standards und langfristige Ausrichtung mit dem BKFC Affiliate-Netzwerk geprüft.",

  prepEyebrow: "Vor der Einreichung",
  prepTitle: "Bereiten Sie folgende Materialien vor",
  prepCopy:
    "Wenn diese Materialien bereitstehen, kann BKFC Ihre Bewerbung effizienter und genauer prüfen.",
  prepItem1: "Gym-Logo",
  prepItem2: "Fotos der Trainingsstätte",
  prepItem3: "Website oder wichtigstes Social-Media-Profil",
  prepItem4: "Aktive Fighter-Liste (optional)",
  prepItem5: "Promovideo (optional)",

  submissionTrustNote:
    "Alle eingereichten Informationen werden vertraulich behandelt und ausschließlich für die interne Bewertung des BKFC Affiliate-Programms verwendet.",
  applicationMarker: "Bewerbungsformular",

  faqEyebrow: "FAQ",
  faqTitle: "Häufig gestellte Fragen",
  faqSubtitleStart:
    "Alles, was Sie über das BKFC Affiliate Program wissen müssen. Wenn Sie zusätzliche Unterstützung benötigen, kontaktieren Sie",

  footerSupportLabel: "Programmsupport",
  footerSupportText:
    "Fragen zum Affiliate Gym Program können gerichtet werden an:",
  footerNoticeLabel: "Programmhinweis",
  footerNoticeText:
    "Die Nutzung von BKFC Branding, Affiliate-Status oder damit verbundenen Darstellungen ist nur nach formeller Genehmigung durch BKFC International Development erlaubt.",
  footerLegal:
    "© Bare Knuckle Fighting Championship. Alle Rechte vorbehalten.",

  formTitle: "Für das BKFC Gym Network bewerben",
  formSubtitle:
    "Reichen Sie Ihre Gym-Daten zur Prüfung durch das internationale BKFC Entwicklungsteam ein.",
  submitButton: "Bewerbung absenden",
},

it: {
  navApply: "Candidati ora",
  heroEyebrow: "Rete ufficiale di sviluppo BKFC",
  heroTitle: "BKFC Gym Network",
  heroSubtitle:
    "Un programma globale di affiliazione che collega palestre di sport da combattimento approvate al sistema internazionale di sviluppo BKFC.",
  heroSupporting:
    "Creato per palestre con standard seri, potenziale atletico e ambizione di crescita a lungo termine all’interno di una rete BKFC in espansione.",
  heroPrimaryCta: "Invia la candidatura",
  heroSecondaryCta: "Scopri il programma",

  sectionProgramEyebrow: "Definizione del programma",
  sectionProgramTitle: "Cos’è il BKFC Affiliate Gym Program",
  sectionProgramText:
    "Il BKFC Affiliate Gym Program è un modello strutturato di affiliazione per palestre di sport da combattimento selezionate che dimostrano standard elevati, potenziale di sviluppo e allineamento con la direzione di crescita internazionale di BKFC. Non è semplicemente una lista o un badge.",
  sectionProgramSupport:
    "È una rete orientata alla performance, progettata per collegare palestre serie con visibilità, percorsi per atleti e future opportunità di attivazione all’interno dell’ecosistema BKFC.",

  fighterPathwayEyebrow: "Percorso dell’atleta",
  fighterPathwayTitle: "Come le palestre collegano gli atleti all’ecosistema BKFC",
  fighterPathwayStep1: "Palestra affiliata",
  fighterPathwayStep2: "Visibilità del talento",
  fighterPathwayStep3: "Tryouts BKFC",
  fighterPathwayStep4: "Opportunità di selezione",
  fighterPathwaySupport:
    "Il programma è progettato per creare un ponte più diretto tra palestre forti, atleti emergenti e future opportunità BKFC.",

  tierEyebrow: "Livelli del programma",
  tierTitle: "Progressione basata sulla performance all’interno della rete",
  tierIntro:
    "Il BKFC Affiliate Gym Program è costruito come una rete a livelli, permettendo alle palestre di rafforzare la propria posizione nel tempo attraverso costanza, standard, attività e valore complessivo per il programma.",
  tierKicker: "Livello affiliato",
  tier1Title: "Livello 1",
  tier1Copy:
    "Ingresso ufficiale nel BKFC Affiliate Gym Network per palestre approvate che soddisfano gli standard principali e mostrano forte potenziale strutturale.",
  tier2Title: "Livello 2",
  tier2Copy:
    "Livello affiliato progressivo per palestre che dimostrano maggiore attività, continuità nello sviluppo degli atleti e valore crescente all’interno della rete.",
  tier3Title: "Livello 3",
  tier3Copy:
    "Livello superiore riservato a palestre di spicco con forte slancio, potenziale di riconoscimento e prospettiva di attivazione BKFC a lungo termine.",

  gymMonthEyebrow: "Palestra del mese",
  gymMonthTitle: "Riconoscimento ricorrente per palestre affiliate di spicco",
  gymMonthText:
    "Il BKFC Affiliate Gym Program è progettato per rimanere attivo durante tutto l’anno. Attraverso la funzione Palestra del mese, BKFC può mettere in evidenza palestre affiliate che dimostrano standard elevati, attività visibile e contributo significativo alla rete.",
  gymMonthSupport:
    "Più di un semplice riconoscimento, questo meccanismo crea slancio all’interno del programma e offre alle palestre di spicco un ulteriore livello di visibilità, prestigio e potenziale di attivazione futura nell’ecosistema BKFC.",
  gymMonthPill1: "Spotlight mensile",
  gymMonthPill2: "Visibilità extra",
  gymMonthPill3: "Prestigio del programma",
  gymMonthPill4: "Potenziale di attivazione futura",

  expectationsEyebrow: "Aspettative",
  expectationsTitle: "Cosa cerca BKFC nelle palestre affiliate",
  expectationsText:
    "Il BKFC Affiliate Gym Program è pensato per palestre serie che possano rappresentare correttamente lo standard della rete. L’accettazione non si basa solo sull’interesse, ma su struttura, professionalità, valore di sviluppo e allineamento a lungo termine.",
  expectation1: "Un ambiente di allenamento professionale con forte disciplina operativa",
  expectation2: "Struttura tecnica attiva e chiara cultura di sviluppo degli atleti",
  expectation3: "Disponibilità ad allinearsi agli standard e alla direzione del programma BKFC",
  expectation4: "Capacità di rappresentare correttamente il programma nel mercato locale",
  expectation5: "Mentalità a lungo termine verso crescita, qualità e allineamento con il brand",

  benefitsEyebrow: "Vantaggi",
  benefitsTitle: "Perché le palestre selezionate entrano nel programma",
  benefitsSubtitle:
    "Il BKFC Affiliate Gym Program è progettato per creare valore attraverso visibilità del brand, opportunità per gli atleti e sviluppo a lungo termine della palestra dentro una rete internazionale strutturata.",

  benefitKicker: "Valore del programma",

  benefitGroup1Title: "Esposizione",
  benefitGroup1Item1: "Riconoscimento ufficiale come palestra affiliata BKFC",
  benefitGroup1Item2: "Posizionamento all’interno della rete internazionale di palestre BKFC",
  benefitGroup1Item3: "Opportunità di visibilità sui canali digitali e contenuti BKFC",
  benefitGroup1Item4: "Maggiore credibilità per palestre che vogliono crescere localmente e internazionalmente",

  benefitGroup2Title: "Opportunità per atleti",
  benefitGroup2Item1: "Visibilità prioritaria per fighter collegati a palestre affiliate",
  benefitGroup2Item2: "Connessione più stretta con tryouts, trials e percorsi di talento BKFC",
  benefitGroup2Item3: "Ponte più forte a lungo termine tra atleti della palestra e opportunità BKFC",
  benefitGroup2Item4: "Valore aggiuntivo per palestre focalizzate sullo sviluppo di fighter competitivi",

  benefitGroup3Title: "Vantaggi commerciali e di programma",
  benefitGroup3Item1: "Accesso potenziale ad attivazioni selezionate collegate a BKFC",
  benefitGroup3Item2: "Struttura per opportunità di merchandising e promozione",
  benefitGroup3Item3: "Possibilità di seminari e apparizioni con talenti BKFC",
  benefitGroup3Item4: "Ingresso in un programma strutturato per la crescita, non solo in una semplice affiliazione",

  selectionEyebrow: "Processo di selezione",
  selectionTitle: "Come le palestre entrano nel programma",
  selectionText:
    "L’ingresso nel BKFC Affiliate Gym Program segue un processo di valutazione strutturato. Ogni candidatura viene esaminata individualmente per garantire allineamento con gli standard del programma, struttura tecnica e potenziale di sviluppo a lungo termine.",
  selectionStep1: "Invio della candidatura tramite il modulo ufficiale di affiliazione",
  selectionStep2: "Revisione interna da parte di BKFC International Development",
  selectionStep3: "Valutazione della struttura della palestra, ambiente di allenamento e posizionamento",
  selectionStep4: "Conferma dell’allineamento al programma e preparazione dell’onboarding",

  starterEyebrow: "Anteprima Starter Kit",
  starterTitle: "Verso cosa avanzano le palestre accettate",
  starterText:
    "Le palestre accettate entrano in un percorso strutturato di onboarding, progettato per posizionarle all’interno della rete internazionale di sviluppo BKFC.",
  starterSupport:
    "Più di un semplice livello di benvenuto, lo starter kit rappresenta il primo passo operativo per allineare una palestra alla struttura del programma BKFC, agli standard di comunicazione e ai futuri canali di opportunità.",
  starterIncludedEyebrow: "Direzione inclusa",
  starterIncludedTitle: "Elementi in anteprima",
  starterItem1: "Guida all’onboarding affiliato",
  starterItem2: "Asset di riconoscimento del programma",
  starterItem3: "Direzione sull’uso del brand",
  starterItem4: "Struttura di supporto del programma",
  starterItem5: "Percorso verso future attivazioni e opportunità",

  expansionEyebrow: "Posizionamento di espansione",
  expansionTitle: "Entrare nella fase fondativa di una rete in crescita",
  expansionText:
    "BKFC sta costruendo un ecosistema internazionale più ampio di palestre attorno a struttura di affiliazione, sviluppo degli atleti ed espansione di mercato a lungo termine.",
  expansionSupport:
    "Le prime palestre affiliate non entrano quando il sistema è già saturo. Entrano mentre la rete è ancora in fase di costruzione, creando un posizionamento più forte a lungo termine all’interno di un framework internazionale BKFC in sviluppo.",

  applicationEyebrow: "Candidatura ufficiale di affiliazione",
  applicationTitle: "Invia la tua palestra per la revisione affiliata BKFC",
  applicationText:
    "Completa la candidatura ufficiale qui sotto per presentare la tua palestra alla revisione di BKFC International Development.",
  applicationConfidence:
    "L’invio della candidatura non garantisce l’accettazione. Ogni candidatura viene esaminata individualmente in base alla compatibilità con il programma, agli standard operativi e all’allineamento a lungo termine con la rete affiliata BKFC.",

  prepEyebrow: "Prima dell’invio",
  prepTitle: "Prepara i seguenti materiali",
  prepCopy:
    "Avere questi elementi pronti aiuterà BKFC a valutare la tua candidatura in modo più efficiente e accurato.",
  prepItem1: "Logo della palestra",
  prepItem2: "Foto della struttura",
  prepItem3: "Sito web o profilo social principale",
  prepItem4: "Roster attivo dei fighter (opzionale)",
  prepItem5: "Video promozionale (opzionale)",

  submissionTrustNote:
    "Tutte le informazioni inviate vengono gestite in modo confidenziale e utilizzate esclusivamente per la valutazione interna del programma affiliati BKFC.",
  applicationMarker: "Modulo di candidatura",

  faqEyebrow: "FAQ",
  faqTitle: "Domande frequenti",
  faqSubtitleStart:
    "Tutto ciò che devi sapere sul BKFC Affiliate Program. Se hai bisogno di ulteriore assistenza, contatta",

  footerSupportLabel: "Supporto del programma",
  footerSupportText:
    "Le domande relative all’Affiliate Gym Program possono essere inviate a:",
  footerNoticeLabel: "Avviso del programma",
  footerNoticeText:
    "L’uso del branding BKFC, dello status affiliato o di rappresentazioni correlate è consentito solo dopo approvazione formale da parte di BKFC International Development.",
  footerLegal:
    "© Bare Knuckle Fighting Championship. Tutti i diritti riservati.",

  formTitle: "Candidati al BKFC Gym Network",
  formSubtitle:
    "Invia i dettagli della tua palestra per la revisione da parte del team internazionale di sviluppo BKFC.",
  submitButton: "Invia candidatura",
},

} satisfies Record<LanguageCode, Record<string, string>>;