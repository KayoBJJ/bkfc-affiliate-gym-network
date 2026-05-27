"use client";

import { FormEvent, useState } from "react";
import type { LanguageCode } from "@/lib/i18n/translations"

type SubmissionState =
  | {
      status: "idle";
      message: "";
    }
  | {
      status: "success" | "error";
      message: string;
    };

const initialState: SubmissionState = {
  status: "idle",
  message: ""
};

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
  submitting: "Wysyłanie...",
  submit: "Wyślij do oceny",
  successMessage:
    "Zgłoszenie zostało pomyślnie wysłane. Twoje materiały zostały odebrane do oceny przez BKFC International Development. Zgłoszenia są zazwyczaj analizowane w ciągu 5–10 dni roboczych. Jeśli podczas oceny będą potrzebne dodatkowe informacje, skontaktujemy się z Tobą pod podanym adresem email.",
  fallbackError: "Nie udało się wysłać zgłoszenia.",
},

};

export function RegistrationForm({ language }: RegistrationFormProps) {
  const t = formCopy[language] ?? formCopy.en;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>(initialState);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity()) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionState(initialState);

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/affiliate-registration", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || t.fallbackError);
      }

      form.reset();
      setSubmissionState({
        status: "success",
        message:
          payload.message || t.successMessage
      });
    } catch (error) {
      setSubmissionState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : t.fallbackError
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="registration-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>{t.gymName}</span>
          <input name="gymName" type="text" required />
        </label>

        <label className="field">
          <span>{t.cityCountry}</span>
          <input name="cityCountry" type="text" required />
        </label>

        <label className="field">
          <span>{t.contactPerson}</span>
          <input name="contactPerson" type="text" required />
        </label>

        <label className="field">
          <span>{t.email}</span>
          <input name="email" type="email" required />
        </label>

        <label className="field">
          <span>{t.phone}</span>
          <input name="phone" type="tel" required />
        </label>

        <label className="field">
          <span>{t.websiteInstagram}</span>
          <input
            name="websiteInstagram"
            type="text"
            required
            placeholder={t.websitePlaceholder}
          />
        </label>

        <label className="field field-full">
          <span>{t.disciplinesOffered}</span>
          <textarea
            name="disciplinesOffered"
            rows={4}
            required
            placeholder={t.disciplinesPlaceholder}
          />
        </label>

        <label className="field">
          <span>{t.logoUpload}</span>
          <input
            name="logoUpload"
            type="file"
            accept="image/*,.pdf,.svg"
            required
          />
        </label>

        <label className="field">
          <span>{t.gymPhotosUpload}</span>
          <input
            name="gymPhotos"
            type="file"
            accept="image/*"
            multiple
            required
          />
        </label>

        <label className="field">
          <span>{t.fighterListUpload}</span>
          <input
            name="fighterListUpload"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          />
        </label>

        <label className="field">
  <span>{t.promoVideoLink}</span>
  <input
    name="promoVideoLink"
    type="url"
    placeholder={t.promoVideoPlaceholder}
  />
</label>
      </div>

      <section className="consent-panel" aria-labelledby="consent-heading">
        <div className="section-heading">
          <p className="eyebrow">{t.consentEyebrow}</p>
          <h3 id="consent-heading">{t.consentTitle}</h3>
        </div>
        <p className="privacy-copy">{t.privacyCopy}</p>

        <label className="checkbox-field">
          <input name="reviewConsent" type="checkbox" required />
          <span>{t.reviewConsent}</span>
        </label>

        <label className="checkbox-field">
          <input name="followUpConsent" type="checkbox" />
          <span>{t.followUpConsent}</span>
        </label>
      </section>

      <div className="submit-row">
        <button type="submit" className="submit-button" disabled={isSubmitting}>
          {isSubmitting ? t.submitting : t.submit}
        </button>
        {submissionState.status !== "idle" ? (
          <p
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
