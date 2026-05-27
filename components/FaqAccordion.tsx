"use client";

import { useState } from "react";
import type { LanguageCode } from "@/lib/i18n/translations";

type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: Record<LanguageCode, FaqItem[]> = {
  en: [
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
  ],

  es: [
    {
      question: "¿Qué es BKFC Affiliate Gym Network?",
      answer:
        "BKFC Affiliate Gym Network es un programa internacional de afiliación que conecta instalaciones aprobadas de deportes de combate con el ecosistema de desarrollo de BKFC, incluyendo visibilidad para atletas, oportunidades de activación del programa e integración futura en iniciativas seleccionadas de BKFC.",
    },
    {
      question: "¿Quién puede aplicar?",
      answer:
        "Pueden aplicar gimnasios de deportes de combate, centros de entrenamiento e instalaciones de artes marciales con una estructura de entrenadores establecida, un entorno de entrenamiento adecuado y un compromiso claro con el desarrollo de atletas.",
    },
    {
      question: "¿Todos los gimnasios son aceptados automáticamente?",
      answer:
        "No. Enviar una solicitud no garantiza la aceptación. Cada instalación es revisada individualmente por BKFC International Development según estándares operativos, ajuste al programa y alineación con la marca.",
    },
    {
      question: "¿Hay una tarifa para aplicar?",
      answer:
        "No. Enviar una solicitud para Affiliate Gym no requiere pago. Los detalles de la tarifa del programa se comparten únicamente con gimnasios seleccionados durante la etapa de onboarding.",
    },
    {
      question: "¿Hay una cuota de membresía después de la aprobación?",
      answer:
        "Sí. Las opciones actuales de afiliación son €100 al mes o €250 por tres meses.",
    },
    {
      question: "¿Qué sucede después de enviar la solicitud?",
      answer:
        "Las solicitudes son revisadas internamente por BKFC International Development. Durante el proceso de evaluación, puede solicitarse información adicional o aclaraciones. Los gimnasios aprobados son contactados directamente con los próximos pasos de onboarding.",
    },
    {
      question: "¿Cuánto tarda el proceso de revisión?",
      answer:
        "Las solicitudes normalmente se revisan en un plazo de 5 a 10 días hábiles. En algunos casos, puede requerirse más tiempo según el volumen de solicitudes o si se necesita información adicional.",
    },
    {
      question: "¿Podemos usar la marca BKFC después de enviar la solicitud?",
      answer:
        "No. La marca BKFC, el estatus de afiliado y cualquier representación pública relacionada solo pueden utilizarse después de recibir aprobación formal por escrito de BKFC International Development.",
    },
    {
      question: "¿Pueden aplicar gimnasios fuera de Estados Unidos?",
      answer:
        "Sí. BKFC Affiliate Gym Network es un programa internacional y acepta solicitudes de gimnasios calificados en todo el mundo.",
    },
    {
      question: "¿El estatus de afiliado garantiza selección de peleadores para eventos BKFC?",
      answer:
        "No. El estatus de afiliado puede apoyar la visibilidad de atletas dentro del ecosistema BKFC, pero la participación de peleadores en eventos BKFC sigue sujeta a evaluación de matchmaking, requisitos del evento y aprobación interna final.",
    },
    {
      question: "¿Los gimnasios afiliados pueden organizar tryouts o actividades oficiales BKFC?",
      answer:
        "El estatus de afiliado no concede automáticamente derechos de organización. Tryouts, seminarios y otras actividades oficiales BKFC se aprueban por separado y están sujetos a requisitos de evento, territorio y operación de BKFC.",
    },
    {
      question: "¿Qué pasa si nuestra solicitud no es aprobada?",
      answer:
        "Los gimnasios no seleccionados durante la revisión inicial pueden ser invitados a aplicar nuevamente en el futuro a medida que BKFC Affiliate Gym Network continúa expandiéndose hacia nuevos territorios.",
    },
    {
      question: "¿A quién contacto si necesito ayuda?",
      answer:
        "Para preguntas sobre solicitudes, elegibilidad o detalles del programa de afiliados, contacta a affiliate@bkfc.com.",
    },
  ],

  pt: [
    {
      question: "O que é a BKFC Affiliate Gym Network?",
      answer:
        "A BKFC Affiliate Gym Network é um programa internacional de afiliação que conecta instalações aprovadas de esportes de combate ao ecossistema de desenvolvimento da BKFC, incluindo visibilidade para atletas, oportunidades de ativação do programa e futura integração em iniciativas selecionadas da BKFC.",
    },
    {
      question: "Quem pode se candidatar?",
      answer:
        "Academias de esportes de combate, centros de treinamento e instalações de artes marciais com estrutura de treinadores estabelecida, ambiente adequado de treino e compromisso claro com o desenvolvimento de atletas podem se candidatar.",
    },
    {
      question: "Toda academia é aceita automaticamente?",
      answer:
        "Não. O envio da candidatura não garante aceitação. Cada instalação é analisada individualmente pela BKFC International Development com base em padrões operacionais, ajuste ao programa e alinhamento com a marca.",
    },
    {
      question: "Existe taxa para se candidatar?",
      answer:
        "Não. O envio da candidatura para Affiliate Gym não exige pagamento. Os detalhes da taxa do programa são compartilhados apenas com academias selecionadas durante a etapa de onboarding.",
    },
    {
      question: "Existe mensalidade após a aprovação?",
      answer:
        "Sim. As opções atuais de afiliação são €100 por mês ou €250 por três meses.",
    },
    {
      question: "O que acontece depois que envio a candidatura?",
      answer:
        "As candidaturas são analisadas internamente pela BKFC International Development. Durante o processo de avaliação, informações adicionais ou esclarecimentos podem ser solicitados. Academias aprovadas são contatadas diretamente com os próximos passos de onboarding.",
    },
    {
      question: "Quanto tempo leva o processo de análise?",
      answer:
        "As candidaturas normalmente são analisadas em 5 a 10 dias úteis. Em alguns casos, pode ser necessário mais tempo dependendo do volume de submissões ou da necessidade de informações adicionais.",
    },
    {
      question: "Podemos usar a marca BKFC depois de enviar a candidatura?",
      answer:
        "Não. A marca BKFC, o status de afiliado e qualquer representação pública relacionada só podem ser usados após aprovação formal por escrito da BKFC International Development.",
    },
    {
      question: "Academias fora dos Estados Unidos podem se candidatar?",
      answer:
        "Sim. A BKFC Affiliate Gym Network é um programa internacional e aceita candidaturas de academias qualificadas no mundo todo.",
    },
    {
      question: "O status de afiliado garante seleção de lutadores para eventos BKFC?",
      answer:
        "Não. O status de afiliado pode apoiar a visibilidade de atletas dentro do ecossistema BKFC, mas a participação de lutadores em eventos BKFC continua sujeita à avaliação de matchmaking, requisitos do evento e aprovação interna final.",
    },
    {
      question: "Academias afiliadas podem sediar tryouts ou atividades oficiais BKFC?",
      answer:
        "O status de afiliado não concede automaticamente direitos de organização. Tryouts, seminários e outras atividades oficiais BKFC são aprovados separadamente e permanecem sujeitos aos requisitos de evento, território e operação da BKFC.",
    },
    {
      question: "O que acontece se nossa candidatura não for aprovada?",
      answer:
        "Academias não selecionadas na análise inicial podem ser convidadas a se candidatar novamente no futuro, conforme a BKFC Affiliate Gym Network continua se expandindo para novos territórios.",
    },
    {
      question: "Quem devo contatar se precisar de ajuda?",
      answer:
        "Para perguntas sobre candidaturas, elegibilidade ou detalhes do programa de afiliados, entre em contato pelo affiliate@bkfc.com.",
    },
  ],

  ru: [
    {
      question: "Что такое BKFC Affiliate Gym Network?",
      answer:
        "BKFC Affiliate Gym Network — это международная партнёрская программа, которая связывает одобренные залы единоборств с экосистемой развития BKFC, включая видимость спортсменов, возможности программных активаций и будущую интеграцию в выбранные инициативы BKFC.",
    },
    {
      question: "Кто может подать заявку?",
      answer:
        "Подать заявку могут залы единоборств, тренировочные центры и объекты боевых искусств с установленной тренерской структурой, подходящей тренировочной средой и ясной приверженностью развитию спортсменов.",
    },
    {
      question: "Каждый зал автоматически принимается?",
      answer:
        "Нет. Подача заявки не гарантирует принятие. Каждый зал рассматривается индивидуально командой BKFC International Development на основе операционных стандартов, соответствия программе и соответствия бренду.",
    },
    {
      question: "Есть ли плата за подачу заявки?",
      answer:
        "Нет. Подача заявки Affiliate Gym не требует оплаты. Детали программных взносов сообщаются только выбранным залам на этапе onboarding.",
    },
    {
      question: "Есть ли членский взнос после одобрения?",
      answer:
        "Да. Текущие варианты партнёрства: €100 в месяц или €250 за три месяца.",
    },
    {
      question: "Что происходит после отправки заявки?",
      answer:
        "Заявки рассматриваются внутри BKFC International Development. В процессе оценки может быть запрошена дополнительная информация или уточнение. Одобренные залы получают прямой контакт с дальнейшими шагами onboarding.",
    },
    {
      question: "Сколько занимает процесс рассмотрения?",
      answer:
        "Обычно заявки рассматриваются в течение 5–10 рабочих дней. В некоторых случаях может потребоваться больше времени в зависимости от количества заявок или необходимости дополнительной информации.",
    },
    {
      question: "Можно ли использовать бренд BKFC после подачи заявки?",
      answer:
        "Нет. Брендинг BKFC, партнёрский статус и любые публичные заявления, связанные с этим, могут использоваться только после официального письменного одобрения BKFC International Development.",
    },
    {
      question: "Могут ли подавать заявки залы за пределами США?",
      answer:
        "Да. BKFC Affiliate Gym Network — международная программа, и заявки принимаются от квалифицированных залов по всему миру.",
    },
    {
      question: "Гарантирует ли партнёрский статус отбор бойцов на события BKFC?",
      answer:
        "Нет. Партнёрский статус может поддержать видимость спортсменов внутри экосистемы BKFC, но участие бойцов в событиях BKFC зависит от оценки matchmaking, требований события и финального внутреннего одобрения.",
    },
    {
      question: "Могут ли партнёрские залы проводить tryouts или официальные активности BKFC?",
      answer:
        "Партнёрский статус не даёт автоматического права проведения. Tryouts, семинары и другие официальные активности BKFC утверждаются отдельно и зависят от требований BKFC к событию, территории и операционной части.",
    },
    {
      question: "Что происходит, если наша заявка не одобрена?",
      answer:
        "Залы, не выбранные на первом этапе рассмотрения, могут быть приглашены подать заявку снова в будущем по мере расширения BKFC Affiliate Gym Network на новые территории.",
    },
    {
      question: "К кому обратиться за помощью?",
      answer:
        "По вопросам заявок, eligibility или деталей партнёрской программы обращайтесь на affiliate@bkfc.com.",
    },
  ],

  de: [
  {
    question: "Was ist das BKFC Affiliate Gym Network?",
    answer:
      "Das BKFC Affiliate Gym Network ist ein internationales Affiliate-Programm, das zugelassene Kampfsport-Einrichtungen mit dem BKFC Entwicklungsökosystem verbindet, einschließlich Athleten-Sichtbarkeit, Programmaktivierungen und zukünftiger Integration in ausgewählte BKFC Initiativen.",
  },
  {
    question: "Wer kann sich bewerben?",
    answer:
      "Kampfsport-Gyms, Trainingszentren und Kampfsport-Einrichtungen mit etablierter Trainerstruktur, geeignetem Trainingsumfeld und klarem Engagement für Athletenentwicklung können sich bewerben.",
  },
  {
    question: "Wird jedes Gym automatisch akzeptiert?",
    answer:
      "Nein. Die Einreichung einer Bewerbung garantiert keine Aufnahme. Jede Einrichtung wird individuell von BKFC International Development auf operative Standards, Programmfit und Markenalignment geprüft.",
  },
  {
    question: "Gibt es eine Gebühr für die Bewerbung?",
    answer:
      "Nein. Die Einreichung einer Affiliate Gym Bewerbung erfordert keine Gebühr. Details zu Programmgebühren werden nur ausgewählten Gyms während der Onboarding-Phase mitgeteilt.",
  },
  {
    question: "Gibt es nach der Genehmigung eine Mitgliedsgebühr?",
    answer:
      "Ja. Die aktuellen Affiliate-Optionen betragen €100 pro Monat oder €250 für drei Monate.",
  },
  {
    question: "Was passiert, nachdem ich die Bewerbung abgeschickt habe?",
    answer:
      "Bewerbungen werden intern von BKFC International Development geprüft. Während des Bewertungsprozesses können zusätzliche Informationen oder Klarstellungen angefordert werden. Zugelassene Gyms werden anschließend direkt mit den nächsten Schritten für das Onboarding kontaktiert.",
  },
  {
    question: "Wie lange dauert der Prüfungsprozess?",
    answer:
      "Bewerbungen werden in der Regel innerhalb von 5–10 Werktagen geprüft. In einigen Fällen kann zusätzliche Zeit erforderlich sein, abhängig vom Bewerbungsvolumen oder davon, ob weitere Informationen benötigt werden.",
  },
  {
    question: "Können wir BKFC Branding nach dem Einreichen der Bewerbung verwenden?",
    answer:
      "Nein. BKFC Branding, Affiliate-Status und jede damit verbundene öffentliche Darstellung dürfen erst nach formeller schriftlicher Genehmigung durch BKFC International Development verwendet werden.",
  },
  {
    question: "Können sich Gyms außerhalb der Vereinigten Staaten bewerben?",
    answer:
      "Ja. Das BKFC Affiliate Gym Network ist ein internationales Programm und nimmt Bewerbungen von qualifizierten Gyms weltweit an.",
  },
  {
    question: "Garantiert der Affiliate-Status die Auswahl von Fightern für BKFC Events?",
    answer:
      "Nein. Der Affiliate-Status kann die Sichtbarkeit von Athleten innerhalb des BKFC Ökosystems unterstützen, aber die Teilnahme von Fightern an BKFC Events bleibt abhängig von Matchmaking-Bewertung, Eventanforderungen und finaler interner Genehmigung.",
  },
  {
    question: "Können Affiliate-Gyms BKFC Tryouts oder offizielle Aktivitäten ausrichten?",
    answer:
      "Der Affiliate-Status gewährt nicht automatisch Ausrichtungsrechte. Tryouts, Seminare und andere offizielle BKFC Aktivitäten werden separat genehmigt und bleiben abhängig von BKFC Event-, Gebiets- und Betriebsanforderungen.",
  },
  {
    question: "Was passiert, wenn unsere Bewerbung nicht genehmigt wird?",
    answer:
      "Gyms, die bei der ersten Prüfung nicht ausgewählt werden, können eingeladen werden, sich in Zukunft erneut zu bewerben, während das BKFC Affiliate Gym Network weiter in zusätzliche Gebiete expandiert.",
  },
  {
    question: "Wen kontaktiere ich, wenn ich Unterstützung benötige?",
    answer:
      "Bei Fragen zu Bewerbungen, Eignung oder Details des Affiliate-Programms kontaktieren Sie affiliate@bkfc.com.",
  },
],

it: [
  {
    question: "Cos’è il BKFC Affiliate Gym Network?",
    answer:
      "Il BKFC Affiliate Gym Network è un programma internazionale di affiliazione che collega strutture approvate di sport da combattimento all’ecosistema di sviluppo BKFC, includendo visibilità per gli atleti, opportunità di attivazione del programma e futura integrazione in iniziative selezionate BKFC.",
  },
  {
    question: "Chi può candidarsi?",
    answer:
      "Possono candidarsi palestre di sport da combattimento, centri di allenamento e strutture di arti marziali con una struttura tecnica consolidata, un ambiente di allenamento adeguato e un chiaro impegno nello sviluppo degli atleti.",
  },
  {
    question: "Ogni palestra viene accettata automaticamente?",
    answer:
      "No. L’invio di una candidatura non garantisce l’accettazione. Ogni struttura viene valutata individualmente da BKFC International Development in base agli standard operativi, alla compatibilità con il programma e all’allineamento con il brand.",
  },
  {
    question: "C’è una quota per candidarsi?",
    answer:
      "No. L’invio di una candidatura come Affiliate Gym non richiede alcuna quota. I dettagli sulle quote del programma vengono condivisi solo con le palestre selezionate durante la fase di onboarding.",
  },
  {
    question: "C’è una quota di membership dopo l’approvazione?",
    answer:
      "Sì. Le opzioni attuali di affiliazione sono €100 al mese o €250 per tre mesi.",
  },
  {
    question: "Cosa succede dopo aver inviato la candidatura?",
    answer:
      "Le candidature vengono esaminate internamente da BKFC International Development. Durante il processo di valutazione possono essere richieste informazioni aggiuntive o chiarimenti. Le palestre approvate vengono poi contattate direttamente con i prossimi passaggi per l’onboarding.",
  },
  {
    question: "Quanto dura il processo di revisione?",
    answer:
      "Le candidature vengono normalmente esaminate entro 5–10 giorni lavorativi. In alcuni casi potrebbe essere necessario più tempo, a seconda del volume delle candidature o della necessità di ulteriori informazioni.",
  },
  {
    question: "Possiamo usare il branding BKFC dopo aver inviato la candidatura?",
    answer:
      "No. Il branding BKFC, lo status affiliato e qualsiasi rappresentazione pubblica correlata possono essere utilizzati solo dopo l’approvazione formale scritta da parte di BKFC International Development.",
  },
  {
    question: "Possono candidarsi palestre fuori dagli Stati Uniti?",
    answer:
      "Sì. Il BKFC Affiliate Gym Network è un programma internazionale e accetta candidature da palestre qualificate in tutto il mondo.",
  },
  {
    question: "Lo status affiliato garantisce la selezione di fighter per eventi BKFC?",
    answer:
      "No. Lo status affiliato può supportare la visibilità degli atleti all’interno dell’ecosistema BKFC, ma la partecipazione dei fighter agli eventi BKFC resta soggetta alla valutazione del matchmaking, ai requisiti dell’evento e all’approvazione interna finale.",
  },
  {
    question: "Le palestre affiliate possono ospitare tryouts o attività ufficiali BKFC?",
    answer:
      "Lo status affiliato non concede automaticamente diritti di organizzazione. Tryouts, seminari e altre attività ufficiali BKFC vengono approvati separatamente e restano soggetti ai requisiti di evento, territorio e operatività di BKFC.",
  },
  {
    question: "Cosa succede se la nostra candidatura non viene approvata?",
    answer:
      "Le palestre non selezionate durante la revisione iniziale possono essere invitate a candidarsi nuovamente in futuro, man mano che il BKFC Affiliate Gym Network continua a espandersi in nuovi territori.",
  },
  {
    question: "Chi devo contattare se ho bisogno di assistenza?",
    answer:
      "Per domande sulle candidature, sull’idoneità o sui dettagli del programma affiliati, contatta affiliate@bkfc.com.",
  },
],
pl: [
  {
    question: "Czym jest BKFC Affiliate Gym Network?",
    answer:
      "BKFC Affiliate Gym Network to międzynarodowy program afiliacyjny, który łączy zatwierdzone obiekty sportów walki z ekosystemem rozwoju BKFC, obejmując widoczność zawodników, możliwości aktywacji programu oraz przyszłą integrację z wybranymi inicjatywami BKFC.",
  },
  {
    question: "Kto może aplikować?",
    answer:
      "Aplikować mogą kluby sportów walki, centra treningowe i obiekty sztuk walki z ustaloną strukturą trenerską, odpowiednim środowiskiem treningowym oraz jasnym zaangażowaniem w rozwój zawodników.",
  },
  {
    question: "Czy każdy klub jest automatycznie akceptowany?",
    answer:
      "Nie. Złożenie zgłoszenia nie gwarantuje akceptacji. Każdy obiekt jest oceniany indywidualnie przez BKFC International Development na podstawie standardów operacyjnych, dopasowania do programu i zgodności z marką.",
  },
  {
    question: "Czy aplikowanie jest płatne?",
    answer:
      "Nie. Złożenie zgłoszenia do Affiliate Gym nie wymaga opłaty. Szczegóły dotyczące opłat programowych są przekazywane wyłącznie wybranym klubom na etapie onboardingu.",
  },
  {
    question: "Czy po zatwierdzeniu obowiązuje opłata członkowska?",
    answer:
      "Tak. Aktualne opcje afiliacji wynoszą €100 miesięcznie lub €250 za trzy miesiące.",
  },
  {
    question: "Co dzieje się po wysłaniu zgłoszenia?",
    answer:
      "Zgłoszenia są analizowane wewnętrznie przez BKFC International Development. W trakcie procesu oceny może zostać poproszona dodatkowa informacja lub wyjaśnienie. Zatwierdzone kluby otrzymają bezpośredni kontakt z kolejnymi krokami onboardingu.",
  },
  {
    question: "Ile trwa proces oceny?",
    answer:
      "Zgłoszenia są zazwyczaj analizowane w ciągu 5–10 dni roboczych. W niektórych przypadkach może być wymagany dodatkowy czas, zależnie od liczby zgłoszeń lub potrzeby uzyskania dodatkowych informacji.",
  },
  {
    question: "Czy możemy używać brandingu BKFC po wysłaniu zgłoszenia?",
    answer:
      "Nie. Branding BKFC, status afiliacyjny oraz jakiekolwiek powiązane publiczne reprezentacje mogą być używane wyłącznie po formalnej pisemnej zgodzie BKFC International Development.",
  },
  {
    question: "Czy kluby spoza Stanów Zjednoczonych mogą aplikować?",
    answer:
      "Tak. BKFC Affiliate Gym Network jest programem międzynarodowym i przyjmuje zgłoszenia od kwalifikujących się klubów na całym świecie.",
  },
  {
    question: "Czy status afiliacyjny gwarantuje wybór zawodników na wydarzenia BKFC?",
    answer:
      "Nie. Status afiliacyjny może wspierać widoczność zawodników w ekosystemie BKFC, ale udział fighterów w wydarzeniach BKFC pozostaje zależny od oceny matchmakingu, wymagań wydarzenia i końcowej wewnętrznej zgody.",
  },
  {
    question: "Czy kluby afiliacyjne mogą organizować BKFC tryouts lub oficjalne aktywności?",
    answer:
      "Status afiliacyjny nie daje automatycznego prawa do organizacji. Tryouts, seminaria i inne oficjalne aktywności BKFC są zatwierdzane osobno i zależą od wymagań BKFC dotyczących wydarzenia, terytorium oraz operacji.",
  },
  {
    question: "Co się stanie, jeśli nasze zgłoszenie nie zostanie zatwierdzone?",
    answer:
      "Kluby, które nie zostaną wybrane podczas pierwszej oceny, mogą zostać zaproszone do ponownego aplikowania w przyszłości, wraz z dalszą ekspansją BKFC Affiliate Gym Network na kolejne terytoria.",
  },
  {
    question: "Z kim mam się skontaktować, jeśli potrzebuję pomocy?",
    answer:
      "W przypadku pytań dotyczących zgłoszeń, kwalifikacji lub szczegółów programu afiliacyjnego skontaktuj się z affiliate@bkfc.com.",
  },
],

};

type FaqAccordionProps = {
  language: LanguageCode;
};

export function FaqAccordion({ language }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const items = faqItems[language];

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-list">
      {items.map((item, index) => {
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