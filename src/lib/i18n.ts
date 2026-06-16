/**
 * Default UI strings per language.
 *
 * Form field labels, buttons and a few system messages live here so a client
 * site doesn't have to redefine every string. content.json can override any of
 * these per section (see RsvpSection.labels / ContactSection.labels), but if it
 * doesn't, we fall back to the dictionary for the site's `language`.
 *
 * To add a new language: add a new key to `dictionaries` below and set
 * "language" in content.json. Set "direction" to "rtl" for right-to-left
 * languages (Hebrew, Arabic, …).
 */
import type { Language } from "./types";

export interface Dictionary {
  // RSVP form
  fullName: string;
  email: string;
  phone: string;
  attending: string;
  attendingYes: string;
  attendingNo: string;
  guests: string;
  guestNames: string;
  guestNamesHint: string;
  dietary: string;
  dietaryHint: string;
  message: string;
  rsvpSubmit: string;
  // Contact form
  contactName: string;
  contactEmail: string;
  contactMessage: string;
  contactSubmit: string;
  // System / shared
  required: string;
  sending: string;
  directions: string;
  // Thank-you page
  thankYouRsvpTitle: string;
  thankYouRsvpBody: string;
  thankYouContactTitle: string;
  thankYouContactBody: string;
  backHome: string;
}

const en: Dictionary = {
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  attending: "Will you be attending?",
  attendingYes: "Joyfully accepts",
  attendingNo: "Regretfully declines",
  guests: "Number of guests",
  guestNames: "Guest names",
  guestNamesHint: "Please list everyone in your party.",
  dietary: "Dietary restrictions / kashrut notes",
  dietaryHint: "Allergies, vegetarian, kosher requirements, etc.",
  message: "Message",
  rsvpSubmit: "Send RSVP",
  contactName: "Name",
  contactEmail: "Email",
  contactMessage: "Message",
  contactSubmit: "Send message",
  required: "required",
  sending: "Sending…",
  directions: "Get directions",
  thankYouRsvpTitle: "Thank you!",
  thankYouRsvpBody: "Your RSVP has been received. We can't wait to celebrate with you.",
  thankYouContactTitle: "Message sent",
  thankYouContactBody: "Thank you for reaching out — we'll get back to you soon.",
  backHome: "Back to the invitation",
};

const he: Dictionary = {
  fullName: "שם מלא",
  email: 'דוא"ל',
  phone: "טלפון",
  attending: "האם תגיעו?",
  attendingYes: "נשמח להגיע",
  attendingNo: "לצערנו לא נוכל להגיע",
  guests: "מספר אורחים",
  guestNames: "שמות האורחים",
  guestNamesHint: "נא לפרט את שמות כל המגיעים.",
  dietary: "הערות תזונה / כשרות",
  dietaryHint: "אלרגיות, צמחוני, דרישות כשרות וכו׳.",
  message: "ברכה / הודעה",
  rsvpSubmit: "אישור הגעה",
  contactName: "שם",
  contactEmail: 'דוא"ל',
  contactMessage: "הודעה",
  contactSubmit: "שליחת הודעה",
  required: "שדה חובה",
  sending: "שולח…",
  directions: "ניווט למקום",
  thankYouRsvpTitle: "תודה רבה!",
  thankYouRsvpBody: "אישור ההגעה התקבל. מחכים לחגוג אתכם!",
  thankYouContactTitle: "ההודעה נשלחה",
  thankYouContactBody: "תודה שפניתם אלינו — נחזור אליכם בהקדם.",
  backHome: "חזרה להזמנה",
};

const fr: Dictionary = {
  fullName: "Nom complet",
  email: "E-mail",
  phone: "Téléphone",
  attending: "Serez-vous présent ?",
  attendingYes: "Avec joie, je serai présent",
  attendingNo: "Je ne pourrai malheureusement pas venir",
  guests: "Nombre d'invités",
  guestNames: "Noms des invités",
  guestNamesHint: "Indiquez toutes les personnes de votre groupe.",
  dietary: "Restrictions alimentaires / cacherout",
  dietaryHint: "Allergies, végétarien, exigences cacher, etc.",
  message: "Message",
  rsvpSubmit: "Envoyer ma réponse",
  contactName: "Nom",
  contactEmail: "E-mail",
  contactMessage: "Message",
  contactSubmit: "Envoyer le message",
  required: "obligatoire",
  sending: "Envoi…",
  directions: "Itinéraire",
  thankYouRsvpTitle: "Merci !",
  thankYouRsvpBody: "Votre réponse a bien été reçue. Nous avons hâte de célébrer avec vous.",
  thankYouContactTitle: "Message envoyé",
  thankYouContactBody: "Merci de nous avoir écrit — nous vous répondrons bientôt.",
  backHome: "Retour à l'invitation",
};

const dictionaries: Record<Language, Dictionary> = { en, he, fr };

/** Get the base dictionary for a language (falls back to English). */
export function getDictionary(language: Language): Dictionary {
  return dictionaries[language] ?? en;
}

/**
 * Merge a language dictionary with optional per-site overrides. Only non-empty
 * override values win, so partial overrides (or undefined values) are fine.
 */
export function withOverrides(
  base: Dictionary,
  overrides?: Record<string, string | undefined>,
): Dictionary {
  if (!overrides) return base;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value != null && value !== "") cleaned[key] = value;
  }
  return { ...base, ...cleaned };
}
