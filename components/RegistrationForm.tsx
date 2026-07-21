"use client";

import { FormEvent, useRef, useState } from "react";
import type { LanguageCode } from "@/lib/i18n/translations"
import {
  BOT_TRAP_FIELD,
  FORM_STARTED_AT_FIELD,
} from "@/lib/application/bot-policy";
import type { UploadSessionResponse } from "@/lib/application/direct-upload-contract";
import {
  anonymousUploadAccess,
  resumableUpload,
  selectedUploadFiles,
} from "@/lib/application/resumable-upload-client";

type SubmissionState =
  | {
      status: "idle";
      message: "";
    }
  | {
      status: "success" | "error";
      message: string;
    };

type ApiPayload = {
  code?: string;
  field?: string;
  applicationReference?: string;
};

type UploadSessionPayload = ApiPayload & Partial<UploadSessionResponse>;

const initialState: SubmissionState = {
  status: "idle",
  message: ""
};

const technicalCopy: Record<LanguageCode, {
  logoHelp: string; photosHelp: string; fighterHelp: string; promoHelp: string;
  received: string; reference: string; next: string; genericError: string;
  validationError: string; duplicate: string; rateLimit: string; fileError: string;
}> = {
  en: { logoHelp: "Required: PNG, JPG or WebP; maximum 5 MB.", photosHelp: "Required: 1–6 PNG, JPG or WebP files; maximum 8 MB each.", fighterHelp: "Optional: PDF, DOC, DOCX, XLS or XLSX; maximum 10 MB.", promoHelp: "Optional URL only; video files cannot be uploaded here.", received: "Your application has been received for review.", reference: "Application reference", next: "The BKFC team will review the submission and contact you using the details provided.", genericError: "The application could not be processed. Your entered text has been preserved; please try again.", validationError: "Please check the highlighted field and try again.", duplicate: "An application with these details was recently received. Contact BKFC if you need help with a legitimate reapplication.", rateLimit: "The application cannot be submitted right now. Please wait and try again.", fileError: "This file does not meet the upload requirements and must be replaced." },
  es: { logoHelp: "Obligatorio: PNG, JPG o WebP; máximo 5 MB.", photosHelp: "Obligatorio: 1–6 archivos PNG, JPG o WebP; máximo 8 MB cada uno.", fighterHelp: "Opcional: PDF, DOC, DOCX, XLS o XLSX; máximo 10 MB.", promoHelp: "Solo URL opcional; aquí no se pueden subir archivos de video.", received: "Tu solicitud ha sido recibida para revisión.", reference: "Referencia de la solicitud", next: "El equipo de BKFC revisará la solicitud y te contactará usando los datos proporcionados.", genericError: "No se pudo procesar la solicitud. El texto introducido se ha conservado; inténtalo de nuevo.", validationError: "Revisa el campo indicado e inténtalo de nuevo.", duplicate: "Se recibió recientemente una solicitud con estos datos. Contacta con BKFC si necesitas ayuda para volver a solicitar legítimamente.", rateLimit: "La solicitud no puede enviarse ahora. Espera e inténtalo de nuevo.", fileError: "Este archivo no cumple los requisitos y debe sustituirse." },
  pt: { logoHelp: "Obrigatório: PNG, JPG ou WebP; máximo de 5 MB.", photosHelp: "Obrigatório: 1–6 arquivos PNG, JPG ou WebP; máximo de 8 MB cada.", fighterHelp: "Opcional: PDF, DOC, DOCX, XLS ou XLSX; máximo de 10 MB.", promoHelp: "Somente URL opcional; arquivos de vídeo não podem ser enviados aqui.", received: "Sua candidatura foi recebida para análise.", reference: "Referência da candidatura", next: "A equipe BKFC analisará o envio e entrará em contato usando os dados fornecidos.", genericError: "A candidatura não pôde ser processada. O texto digitado foi preservado; tente novamente.", validationError: "Verifique o campo indicado e tente novamente.", duplicate: "Uma candidatura com estes dados foi recebida recentemente. Contate a BKFC para uma recandidatura legítima.", rateLimit: "A candidatura não pode ser enviada agora. Aguarde e tente novamente.", fileError: "Este arquivo não atende aos requisitos e deve ser substituído." },
  ru: { logoHelp: "Обязательно: PNG, JPG или WebP; максимум 5 МБ.", photosHelp: "Обязательно: 1–6 файлов PNG, JPG или WebP; максимум 8 МБ каждый.", fighterHelp: "Необязательно: PDF, DOC, DOCX, XLS или XLSX; максимум 10 МБ.", promoHelp: "Только необязательная URL-ссылка; видеофайлы здесь не загружаются.", received: "Ваша заявка получена на рассмотрение.", reference: "Номер заявки", next: "Команда BKFC рассмотрит заявку и свяжется с вами по предоставленным контактным данным.", genericError: "Не удалось обработать заявку. Введённый текст сохранён; попробуйте снова.", validationError: "Проверьте указанное поле и повторите попытку.", duplicate: "Заявка с этими данными недавно уже получена. Для повторной подачи свяжитесь с BKFC.", rateLimit: "Сейчас заявку отправить нельзя. Подождите и попробуйте снова.", fileError: "Файл не соответствует требованиям и должен быть заменён." },
  de: { logoHelp: "Erforderlich: PNG, JPG oder WebP; maximal 5 MB.", photosHelp: "Erforderlich: 1–6 PNG-, JPG- oder WebP-Dateien; maximal 8 MB je Datei.", fighterHelp: "Optional: PDF, DOC, DOCX, XLS oder XLSX; maximal 10 MB.", promoHelp: "Nur optionale URL; Videodateien können hier nicht hochgeladen werden.", received: "Ihre Bewerbung wurde zur Prüfung erhalten.", reference: "Bewerbungsreferenz", next: "Das BKFC-Team prüft die Einreichung und kontaktiert Sie über die angegebenen Daten.", genericError: "Die Bewerbung konnte nicht verarbeitet werden. Ihre Texteingaben wurden beibehalten; versuchen Sie es erneut.", validationError: "Prüfen Sie das angegebene Feld und versuchen Sie es erneut.", duplicate: "Eine Bewerbung mit diesen Daten wurde kürzlich erhalten. Kontaktieren Sie BKFC bei einer berechtigten erneuten Bewerbung.", rateLimit: "Die Bewerbung kann derzeit nicht gesendet werden. Warten Sie und versuchen Sie es erneut.", fileError: "Diese Datei erfüllt die Anforderungen nicht und muss ersetzt werden." },
  it: { logoHelp: "Obbligatorio: PNG, JPG o WebP; massimo 5 MB.", photosHelp: "Obbligatorio: 1–6 file PNG, JPG o WebP; massimo 8 MB ciascuno.", fighterHelp: "Opzionale: PDF, DOC, DOCX, XLS o XLSX; massimo 10 MB.", promoHelp: "Solo URL opzionale; qui non è possibile caricare file video.", received: "La candidatura è stata ricevuta per la revisione.", reference: "Riferimento candidatura", next: "Il team BKFC esaminerà l'invio e ti contatterà utilizzando i dati forniti.", genericError: "Impossibile elaborare la candidatura. Il testo inserito è stato conservato; riprova.", validationError: "Controlla il campo indicato e riprova.", duplicate: "Una candidatura con questi dati è stata ricevuta di recente. Contatta BKFC per una nuova candidatura legittima.", rateLimit: "La candidatura non può essere inviata ora. Attendi e riprova.", fileError: "Il file non soddisfa i requisiti e deve essere sostituito." },
  pl: { logoHelp: "Wymagane: PNG, JPG lub WebP; maksymalnie 5 MB.", photosHelp: "Wymagane: 1–6 plików PNG, JPG lub WebP; maksymalnie 8 MB każdy.", fighterHelp: "Opcjonalne: PDF, DOC, DOCX, XLS lub XLSX; maksymalnie 10 MB.", promoHelp: "Tylko opcjonalny adres URL; plików wideo nie można tu przesyłać.", received: "Zgłoszenie zostało przyjęte do oceny.", reference: "Numer zgłoszenia", next: "Zespół BKFC oceni zgłoszenie i skontaktuje się przy użyciu podanych danych.", genericError: "Nie udało się przetworzyć zgłoszenia. Wpisany tekst został zachowany; spróbuj ponownie.", validationError: "Sprawdź wskazane pole i spróbuj ponownie.", duplicate: "Zgłoszenie z tymi danymi zostało niedawno odebrane. Skontaktuj się z BKFC w sprawie uzasadnionego ponownego zgłoszenia.", rateLimit: "Zgłoszenia nie można teraz wysłać. Poczekaj i spróbuj ponownie.", fileError: "Plik nie spełnia wymagań i należy go zastąpić." },
};

function RequiredMark() {
  return (
    <span className="required-mark" aria-hidden="true">
      *
    </span>
  );
}

type RegistrationFormProps = {
  language: LanguageCode;
};

const formCopy: Record<LanguageCode, {
  gymName: string;
  cityCountry: string;
  contactPerson: string;
  email: string;
  phone: string;
  websiteInstagram: string;
  websitePlaceholder: string;
  disciplinesOffered: string;
  disciplinesPlaceholder: string;
  logoUpload: string;
  gymPhotosUpload: string;
  fighterListUpload: string;
  promoVideoLink: string;
  promoVideoPlaceholder: string;
  consentEyebrow: string;
  consentTitle: string;
  privacyCopy: string;
  reviewConsent: string;
  followUpConsent: string;
  bkfcAppAccessInterest: string;
  bkfcAppAccessInterestHelper: string;
  submitting: string;
  submit: string;
  successMessage: string;
  fallbackError: string;
}> = {
  en: {
    gymName: "Gym name",
    cityCountry: "City / Country",
    contactPerson: "Primary contact / Owner",
    email: "Email address",
    phone: "Phone number",
    websiteInstagram: "Website / Social media profile",
    websitePlaceholder: "https://example.com or @gymhandle",
    disciplinesOffered: "Disciplines offered",
    disciplinesPlaceholder:
      "Example: Boxing, Muay Thai, MMA, strength and conditioning, youth classes...",
    logoUpload: "Logo upload",
    gymPhotosUpload: "Gym photos upload",
    fighterListUpload: "Fighter list upload",
    promoVideoLink: "Promo video link",
    promoVideoPlaceholder:
      "YouTube, Google Drive, Dropbox, WeTransfer or Instagram link",
    consentEyebrow: "Consent",
    consentTitle: "Data collection and review",
    privacyCopy:
      "Submitted information will be collected and stored for affiliate network evaluation, internal processing, and follow-up communication related to onboarding.",
    reviewConsent:
      "I agree to submit the provided information for review and internal processing.",
    followUpConsent: "I would like to receive follow-up communication.",
    bkfcAppAccessInterest: "I am interested in BKFC App access for my gym.",
    bkfcAppAccessInterestHelper:
      "If your application is approved, BKFC will follow up separately with details about available app access options.",
    submitting: "Submitting...",
    submit: "Submit for Review",
    successMessage:
      "Registration submitted successfully. Your materials have been received for review by BKFC International Development. Applications are typically reviewed within 5–10 business days. If additional information is required during evaluation, you will be contacted at the email provided.",
    fallbackError: "Unable to submit registration.",
  },

  es: {
    gymName: "Nombre del gimnasio",
    cityCountry: "Ciudad / País",
    contactPerson: "Contacto principal / Propietario",
    email: "Correo electrónico",
    phone: "Número de teléfono",
    websiteInstagram: "Sitio web / Perfil de redes sociales",
    websitePlaceholder: "https://example.com o @gymhandle",
    disciplinesOffered: "Disciplinas ofrecidas",
    disciplinesPlaceholder:
      "Ejemplo: Boxeo, Muay Thai, MMA, fuerza y acondicionamiento, clases juveniles...",
    logoUpload: "Subir logo",
    gymPhotosUpload: "Subir fotos del gimnasio",
    fighterListUpload: "Subir lista de peleadores",
    promoVideoLink: "Enlace de video promocional",
    promoVideoPlaceholder:
      "YouTube, Google Drive, Dropbox, WeTransfer o enlace de Instagram",
    consentEyebrow: "Consentimiento",
    consentTitle: "Recopilación y revisión de datos",
    privacyCopy:
      "La información enviada será recopilada y almacenada para evaluación de la red de afiliados, procesamiento interno y comunicación de seguimiento relacionada con el onboarding.",
    reviewConsent:
      "Acepto enviar la información proporcionada para revisión y procesamiento interno.",
    followUpConsent: "Deseo recibir comunicación de seguimiento.",
    bkfcAppAccessInterest: "Estoy interesado en acceso a la BKFC App para mi gimnasio.",
    bkfcAppAccessInterestHelper:
      "Si tu solicitud es aprobada, BKFC hará seguimiento por separado con detalles sobre las opciones disponibles de acceso a la app.",
    submitting: "Enviando...",
    submit: "Enviar para Revisión",
    successMessage:
      "Solicitud enviada correctamente. Tus materiales han sido recibidos para revisión por BKFC International Development. Las solicitudes normalmente se revisan en un plazo de 5 a 10 días hábiles. Si se requiere información adicional durante la evaluación, serás contactado en el correo electrónico proporcionado.",
    fallbackError: "No se pudo enviar la solicitud.",
  },

  pt: {
    gymName: "Nome da academia",
    cityCountry: "Cidade / País",
    contactPerson: "Contato principal / Proprietário",
    email: "Endereço de email",
    phone: "Número de telefone",
    websiteInstagram: "Site / Perfil de redes sociais",
    websitePlaceholder: "https://example.com ou @gymhandle",
    disciplinesOffered: "Disciplinas oferecidas",
    disciplinesPlaceholder:
      "Exemplo: Boxe, Muay Thai, MMA, força e condicionamento, aulas juvenis...",
    logoUpload: "Upload do logo",
    gymPhotosUpload: "Upload de fotos da academia",
    fighterListUpload: "Upload da lista de lutadores",
    promoVideoLink: "Link do vídeo promocional",
    promoVideoPlaceholder:
      "YouTube, Google Drive, Dropbox, WeTransfer ou link do Instagram",
    consentEyebrow: "Consentimento",
    consentTitle: "Coleta e revisão de dados",
    privacyCopy:
      "As informações enviadas serão coletadas e armazenadas para avaliação da rede de afiliados, processamento interno e comunicação de acompanhamento relacionada ao onboarding.",
    reviewConsent:
      "Concordo em enviar as informações fornecidas para revisão e processamento interno.",
    followUpConsent: "Gostaria de receber comunicação de acompanhamento.",
    bkfcAppAccessInterest: "Tenho interesse em acesso à BKFC App para minha academia.",
    bkfcAppAccessInterestHelper:
      "Se sua candidatura for aprovada, a BKFC fará contato separadamente com detalhes sobre as opções disponíveis de acesso ao app.",
    submitting: "Enviando...",
    submit: "Enviar para Revisão",
    successMessage:
      "Candidatura enviada com sucesso. Seus materiais foram recebidos para análise pela BKFC International Development. As candidaturas normalmente são analisadas em 5 a 10 dias úteis. Se informações adicionais forem necessárias durante a avaliação, você será contatado pelo email fornecido.",
    fallbackError: "Não foi possível enviar a candidatura.",
  },

  ru: {
    gymName: "Название зала",
    cityCountry: "Город / Страна",
    contactPerson: "Основной контакт / Владелец",
    email: "Email адрес",
    phone: "Номер телефона",
    websiteInstagram: "Сайт / Профиль в соцсетях",
    websitePlaceholder: "https://example.com или @gymhandle",
    disciplinesOffered: "Предлагаемые дисциплины",
    disciplinesPlaceholder:
      "Пример: бокс, Муай Тай, MMA, силовая и функциональная подготовка, детские группы...",
    logoUpload: "Загрузка логотипа",
    gymPhotosUpload: "Загрузка фотографий зала",
    fighterListUpload: "Загрузка списка бойцов",
    promoVideoLink: "Ссылка на промо-видео",
    promoVideoPlaceholder:
      "Ссылка на YouTube, Google Drive, Dropbox, WeTransfer или Instagram",
    consentEyebrow: "Согласие",
    consentTitle: "Сбор и рассмотрение данных",
    privacyCopy:
      "Отправленная информация будет собрана и сохранена для оценки партнёрской сети, внутренней обработки и последующей коммуникации, связанной с onboarding.",
    reviewConsent:
      "Я согласен отправить предоставленную информацию для рассмотрения и внутренней обработки.",
    followUpConsent: "Я хотел бы получать последующую коммуникацию.",
    bkfcAppAccessInterest: "Меня интересует доступ к BKFC App для моего зала.",
    bkfcAppAccessInterestHelper:
      "Если ваша заявка будет одобрена, BKFC отдельно свяжется с вами и предоставит детали доступных вариантов доступа к приложению.",
    submitting: "Отправка...",
    submit: "Отправить на рассмотрение",
    successMessage:
      "Заявка успешно отправлена. Ваши материалы получены для рассмотрения BKFC International Development. Обычно заявки рассматриваются в течение 5–10 рабочих дней. Если в процессе оценки потребуется дополнительная информация, с вами свяжутся по указанному email.",
    fallbackError: "Не удалось отправить заявку.",
  },

  de: {
  gymName: "Name des Gyms",
  cityCountry: "Stadt / Land",
  contactPerson: "Hauptkontakt / Eigentümer",
  email: "E-Mail-Adresse",
  phone: "Telefonnummer",
  websiteInstagram: "Website / Social-Media-Profil",
  websitePlaceholder: "https://example.com oder @gymhandle",
  disciplinesOffered: "Angebotene Disziplinen",
  disciplinesPlaceholder:
    "Beispiel: Boxen, Muay Thai, MMA, Kraft- und Athletiktraining, Jugendkurse...",
  logoUpload: "Logo hochladen",
  gymPhotosUpload: "Gym-Fotos hochladen",
  fighterListUpload: "Fighter-Liste hochladen",
  promoVideoLink: "Link zum Promovideo",
  promoVideoPlaceholder:
    "YouTube, Google Drive, Dropbox, WeTransfer oder Instagram-Link",
  consentEyebrow: "Einwilligung",
  consentTitle: "Datenerhebung und Prüfung",
  privacyCopy:
    "Die eingereichten Informationen werden für die Bewertung des Affiliate-Netzwerks, interne Verarbeitung und Folgekommunikation im Zusammenhang mit dem Onboarding gesammelt und gespeichert.",
  reviewConsent:
    "Ich stimme zu, die bereitgestellten Informationen zur Prüfung und internen Verarbeitung einzureichen.",
  followUpConsent: "Ich möchte Folgekommunikation erhalten.",
  bkfcAppAccessInterest: "Ich bin an BKFC App-Zugang für mein Gym interessiert.",
  bkfcAppAccessInterestHelper:
    "Wenn Ihre Bewerbung genehmigt wird, wird BKFC separat mit Details zu verfügbaren App-Zugangsoptionen nachfassen.",
  submitting: "Wird gesendet...",
  submit: "Zur Prüfung einreichen",
  successMessage:
    "Bewerbung erfolgreich eingereicht. Ihre Materialien wurden zur Prüfung durch BKFC International Development erhalten. Bewerbungen werden in der Regel innerhalb von 5–10 Werktagen geprüft. Falls während der Bewertung zusätzliche Informationen benötigt werden, werden Sie über die angegebene E-Mail-Adresse kontaktiert.",
  fallbackError: "Die Bewerbung konnte nicht eingereicht werden.",
},

it: {
  gymName: "Nome della palestra",
  cityCountry: "Città / Paese",
  contactPerson: "Contatto principale / Proprietario",
  email: "Indirizzo email",
  phone: "Numero di telefono",
  websiteInstagram: "Sito web / Profilo social",
  websitePlaceholder: "https://example.com o @gymhandle",
  disciplinesOffered: "Discipline offerte",
  disciplinesPlaceholder:
    "Esempio: Boxe, Muay Thai, MMA, forza e condizionamento, corsi giovanili...",
  logoUpload: "Carica logo",
  gymPhotosUpload: "Carica foto della palestra",
  fighterListUpload: "Carica roster dei fighter",
  promoVideoLink: "Link video promozionale",
  promoVideoPlaceholder:
    "Link YouTube, Google Drive, Dropbox, WeTransfer o Instagram",
  consentEyebrow: "Consenso",
  consentTitle: "Raccolta e revisione dei dati",
  privacyCopy:
    "Le informazioni inviate saranno raccolte e conservate per la valutazione della rete affiliata, l’elaborazione interna e la comunicazione di follow-up relativa all’onboarding.",
  reviewConsent:
    "Accetto di inviare le informazioni fornite per revisione ed elaborazione interna.",
  followUpConsent: "Desidero ricevere comunicazioni di follow-up.",
  bkfcAppAccessInterest: "Sono interessato all’accesso alla BKFC App per la mia palestra.",
  bkfcAppAccessInterestHelper:
    "Se la tua candidatura viene approvata, BKFC ti contatterà separatamente con i dettagli sulle opzioni disponibili di accesso all’app.",
  submitting: "Invio in corso...",
  submit: "Invia per revisione",
  successMessage:
    "Candidatura inviata con successo. I tuoi materiali sono stati ricevuti per la revisione da parte di BKFC International Development. Le candidature vengono normalmente esaminate entro 5–10 giorni lavorativi. Se durante la valutazione saranno necessarie ulteriori informazioni, verrai contattato all’indirizzo email fornito.",
  fallbackError: "Impossibile inviare la candidatura.",
},

pl: {
  gymName: "Nazwa klubu",
  cityCountry: "Miasto / Kraj",
  contactPerson: "Główny kontakt / Właściciel",
  email: "Adres email",
  phone: "Numer telefonu",
  websiteInstagram: "Strona internetowa / Profil społecznościowy",
  websitePlaceholder: "https://example.com lub @gymhandle",
  disciplinesOffered: "Oferowane dyscypliny",
  disciplinesPlaceholder:
    "Przykład: Boks, Muay Thai, MMA, przygotowanie siłowe i motoryczne, zajęcia dla młodzieży...",
  logoUpload: "Prześlij logo",
  gymPhotosUpload: "Prześlij zdjęcia klubu",
  fighterListUpload: "Prześlij listę fighterów",
  promoVideoLink: "Link do filmu promocyjnego",
  promoVideoPlaceholder:
    "YouTube, Google Drive, Dropbox, WeTransfer lub link z Instagrama",
  consentEyebrow: "Zgoda",
  consentTitle: "Zbieranie i ocena danych",
  privacyCopy:
    "Przesłane informacje będą zbierane i przechowywane w celu oceny sieci afiliacyjnej, wewnętrznego przetwarzania oraz komunikacji związanej z onboardingiem.",
  reviewConsent:
    "Wyrażam zgodę na przesłanie podanych informacji do oceny i wewnętrznego przetwarzania.",
  followUpConsent: "Chcę otrzymywać dalszą komunikację.",
  bkfcAppAccessInterest: "Interesuje mnie dostęp do BKFC App dla mojego klubu.",
  bkfcAppAccessInterestHelper:
    "Jeśli Twoje zgłoszenie zostanie zatwierdzone, BKFC skontaktuje się osobno ze szczegółami dostępnych opcji dostępu do aplikacji.",
  submitting: "Wysyłanie...",
  submit: "Wyślij do oceny",
  successMessage:
    "Zgłoszenie zostało pomyślnie wysłane. Twoje materiały zostały odebrane do oceny przez BKFC International Development. Zgłoszenia są zazwyczaj analizowane w ciągu 5–10 dni roboczych. Jeśli podczas oceny będą potrzebne dodatkowe informacje, skontaktujemy się z Tobą pod podanym adresem email.",
  fallbackError: "Nie udało się wysłać zgłoszenia.",
},

};

export function RegistrationForm({ language }: RegistrationFormProps) {
  const t = formCopy[language] ?? formCopy.en;
  const tech = technicalCopy[language] ?? technicalCopy.en;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [formStartedAt, setFormStartedAt] = useState(() => String(Date.now()));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>(initialState);
  const resultRef = useRef<HTMLParagraphElement>(null);

  function validateClientFiles(form: HTMLFormElement) {
    const data = new FormData(form);
    const logo = data.get("logoUpload");
    const photos = data.getAll("gymPhotos").filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    const fighterList = data.get("fighterListUpload");
    const errors: Record<string, string> = {};
    if (logo instanceof File && logo.size > 5 * 1024 * 1024) errors.logoUpload = tech.fileError;
    if (photos.length > 6 || photos.some((file) => file.size > 8 * 1024 * 1024)) errors.gymPhotos = tech.fileError;
    if (fighterList instanceof File && fighterList.size > 10 * 1024 * 1024) errors.fighterListUpload = tech.fileError;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    if (isSubmitting) return;

    if (!form.reportValidity()) {
      return;
    }

    if (!validateClientFiles(form)) {
      setSubmissionState({ status: "error", message: tech.fileError });
      queueMicrotask(() => resultRef.current?.focus());
      return;
    }

    setIsSubmitting(true);
    setSubmissionState(initialState);
    setFieldErrors({});
    setUploadProgress(0);

    try {
      const formData = new FormData(form);
      formData.set("idempotencyKey", idempotencyKey);
      formData.set(FORM_STARTED_AT_FIELD, formStartedAt);
      const files = selectedUploadFiles(formData);
      const formPayload: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") formPayload[key] = value;
      }
      const { accessToken, anonKey } = await anonymousUploadAccess();
      const sessionResponse = await fetch("/api/affiliate-registration/upload-session", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          form: formPayload,
          files: files.map(({ field, file }) => ({ field, name: file.name, size: file.size, type: file.type })),
        }),
      });
      const sessionPayload = (await sessionResponse.json()) as UploadSessionPayload;
      if (!sessionResponse.ok || !sessionPayload.sessionId || !sessionPayload.storageEndpoint ||
        !sessionPayload.bucket || !sessionPayload.uploads) {
        const fileCodes = new Set(["FILE_TOO_LARGE", "UNSUPPORTED_FILE_TYPE", "INVALID_FILE_SIGNATURE", "TOO_MANY_FILES"]);
        const duplicateCodes = new Set(["DUPLICATE_SUBMISSION", "APPLICATION_ALREADY_RECEIVED"]);
        const message = fileCodes.has(sessionPayload.code || "")
          ? tech.fileError
          : duplicateCodes.has(sessionPayload.code || "")
            ? tech.duplicate
            : sessionPayload.code === "RATE_LIMITED" || sessionPayload.code === "BOT_DETECTED"
              ? tech.rateLimit
              : sessionPayload.code?.startsWith("INVALID_") || sessionPayload.code === "FIELD_TOO_LONG" || sessionPayload.code === "REQUIRED_FIELD_MISSING" || sessionPayload.code === "UNEXPECTED_FIELD" || sessionPayload.code === "VALIDATION_FAILED"
                ? tech.validationError
                : tech.genericError;
        if (sessionPayload.field) setFieldErrors({ [sessionPayload.field]: message });
        setSubmissionState({ status: "error", message });
        queueMicrotask(() => resultRef.current?.focus());
        return;
      }

      const totalBytes = files.reduce((sum, { file }) => sum + file.size, 0);
      let completedBytes = 0;
      for (let index = 0; index < files.length; index += 1) {
        const selected = files[index];
        const issued = sessionPayload.uploads[index];
        if (!issued || issued.field !== selected.field || issued.size !== selected.file.size) {
          throw new Error("upload_manifest_mismatch");
        }
        if (issued.uploaded) {
          completedBytes += selected.file.size;
          setUploadProgress(Math.min(99, Math.round((completedBytes / totalBytes) * 100)));
          continue;
        }
        await resumableUpload(
          sessionPayload.storageEndpoint,
          sessionPayload.bucket,
          accessToken,
          anonKey,
          issued,
          selected.file,
          (uploaded) => setUploadProgress(Math.min(99, Math.round(((completedBytes + uploaded) / totalBytes) * 100))),
        );
        completedBytes += selected.file.size;
      }
      setUploadProgress(100);

      const response = await fetch("/api/affiliate-registration/finalize", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sessionId: sessionPayload.sessionId }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        const fileCodes = new Set(["FILE_TOO_LARGE", "UNSUPPORTED_FILE_TYPE", "INVALID_FILE_SIGNATURE", "TOO_MANY_FILES"]);
        const message = fileCodes.has(payload.code || "")
          ? tech.fileError
          : payload.code?.startsWith("INVALID_") || payload.code === "VALIDATION_FAILED"
            ? tech.validationError
            : tech.genericError;
        if (payload.field) setFieldErrors({ [payload.field]: message });
        if (payload.field) {
          setIdempotencyKey(crypto.randomUUID());
          setFormStartedAt(String(Date.now()));
        }
        setSubmissionState({ status: "error", message });
        queueMicrotask(() => resultRef.current?.focus());
        return;
      }

      if (!payload.applicationReference) {
        throw new Error("invalid_success_response");
      }

      form.reset();
      setIdempotencyKey(crypto.randomUUID());
      setFormStartedAt(String(Date.now()));
      setSubmissionState({
        status: "success",
        message: `${tech.received} ${tech.reference}: ${payload.applicationReference}. ${tech.next}`
      });
      queueMicrotask(() => resultRef.current?.focus());
    } catch {
      setSubmissionState({
        status: "error",
        message: tech.genericError
      });
      queueMicrotask(() => resultRef.current?.focus());
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  }

  return (
    <form className="registration-form" onSubmit={handleSubmit} noValidate={false}>
      <div className="form-honeypot" aria-hidden="true">
        <input
          name={BOT_TRAP_FIELD}
          type="text"
          value=""
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
        />
      </div>
      <input name={FORM_STARTED_AT_FIELD} type="hidden" value={formStartedAt} readOnly />
      <div className="form-grid">
        <label className="field">
          <span>{t.gymName}<RequiredMark /></span>
          <input name="gymName" type="text" required maxLength={160} autoComplete="organization" />
        </label>

        <label className="field">
          <span>{t.cityCountry}<RequiredMark /></span>
          <input name="cityCountry" type="text" required maxLength={160} autoComplete="address-level2" />
        </label>

        <label className="field">
          <span>{t.contactPerson}<RequiredMark /></span>
          <input name="contactPerson" type="text" required maxLength={160} autoComplete="name" />
        </label>

        <label className="field">
          <span>{t.email}<RequiredMark /></span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
          {fieldErrors.email ? <small id="email-error" className="field-error">{fieldErrors.email}</small> : null}
        </label>

        <label className="field">
          <span>{t.phone}<RequiredMark /></span>
          <input name="phone" type="tel" required maxLength={40} autoComplete="tel" />
        </label>

        <label className="field">
          <span>{t.websiteInstagram}<RequiredMark /></span>
          <input
            name="websiteInstagram"
            type="text"
            required
            maxLength={500}
            autoComplete="url"
            aria-invalid={Boolean(fieldErrors.websiteInstagram)}
            aria-describedby={fieldErrors.websiteInstagram ? "website-error" : undefined}
            placeholder={t.websitePlaceholder}
          />
          {fieldErrors.websiteInstagram ? <small id="website-error" className="field-error">{fieldErrors.websiteInstagram}</small> : null}
        </label>

        <label className="field field-full">
          <span>{t.disciplinesOffered}<RequiredMark /></span>
          <textarea
            name="disciplinesOffered"
            rows={4}
            required
            maxLength={2000}
            placeholder={t.disciplinesPlaceholder}
          />
        </label>

        <label className="field">
          <span>{t.logoUpload}<RequiredMark /></span>
          <input
            name="logoUpload"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            required
            aria-invalid={Boolean(fieldErrors.logoUpload)}
            aria-describedby={fieldErrors.logoUpload ? "logo-help logo-error" : "logo-help"}
          />
          <small id="logo-help" className="field-helper">{tech.logoHelp}</small>
          {fieldErrors.logoUpload ? <small id="logo-error" className="field-error">{fieldErrors.logoUpload}</small> : null}
        </label>

        <label className="field">
          <span>{t.gymPhotosUpload}<RequiredMark /></span>
          <input
            name="gymPhotos"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            multiple
            required
            aria-invalid={Boolean(fieldErrors.gymPhotos)}
            aria-describedby={fieldErrors.gymPhotos ? "photos-help photos-error" : "photos-help"}
          />
          <small id="photos-help" className="field-helper">{tech.photosHelp}</small>
          {fieldErrors.gymPhotos ? <small id="photos-error" className="field-error">{fieldErrors.gymPhotos}</small> : null}
        </label>

        <label className="field">
          <span>{t.fighterListUpload}</span>
          <input
            name="fighterListUpload"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            aria-invalid={Boolean(fieldErrors.fighterListUpload)}
            aria-describedby={fieldErrors.fighterListUpload ? "fighter-help fighter-error" : "fighter-help"}
          />
          <small id="fighter-help" className="field-helper">{tech.fighterHelp}</small>
          {fieldErrors.fighterListUpload ? <small id="fighter-error" className="field-error">{fieldErrors.fighterListUpload}</small> : null}
        </label>

        <label className="field">
  <span>{t.promoVideoLink}</span>
  <input
    name="promoVideoLink"
    type="url"
    maxLength={1000}
    inputMode="url"
    aria-invalid={Boolean(fieldErrors.promoVideoLink)}
    aria-describedby={fieldErrors.promoVideoLink ? "promo-help promo-error" : "promo-help"}
    placeholder={t.promoVideoPlaceholder}
  />
  <small id="promo-help" className="field-helper">{tech.promoHelp}</small>
  {fieldErrors.promoVideoLink ? <small id="promo-error" className="field-error">{fieldErrors.promoVideoLink}</small> : null}
</label>
      </div>

      <section className="consent-panel" aria-labelledby="consent-heading">
        <div className="section-heading">
          <p className="eyebrow">{t.consentEyebrow}</p>
          <h3 id="consent-heading">{t.consentTitle}</h3>
        </div>
        <p className="privacy-copy">{t.privacyCopy}</p>

        <div className="optional-interest-block">
          <label className="checkbox-field">
            <input name="bkfcAppAccessInterest" type="checkbox" />
            <span>{t.bkfcAppAccessInterest}</span>
          </label>
          <p className="checkbox-helper">{t.bkfcAppAccessInterestHelper}</p>
        </div>

        <label className="checkbox-field">
          <input name="reviewConsent" type="checkbox" required />
          <span>{t.reviewConsent}<RequiredMark /></span>
        </label>

        <label className="checkbox-field">
          <input name="followUpConsent" type="checkbox" />
          <span>{t.followUpConsent}</span>
        </label>
      </section>

      <div className="submit-row">
        <button type="submit" className="submit-button" disabled={isSubmitting}>
          {isSubmitting ? `${t.submitting}${uploadProgress ? ` ${uploadProgress}%` : ""}` : t.submit}
        </button>
        {submissionState.status !== "idle" ? (
          <p
            ref={resultRef}
            tabIndex={-1}
            className={`submission-message ${submissionState.status}`}
            role="status"
            aria-live="polite"
          >
            {submissionState.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
