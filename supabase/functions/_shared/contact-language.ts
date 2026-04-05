export type SupportedContactLanguage = "es" | "en" | "fr" | "de";

export function normalizeContactLanguage(value?: string | null): SupportedContactLanguage | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  if (["es", "es-es", "spanish", "espanol", "español", "castellano"].includes(raw)) return "es";
  if (["en", "en-gb", "en-us", "english", "ingles", "inglés"].includes(raw)) return "en";
  if (["fr", "fr-fr", "french", "francais", "français"].includes(raw)) return "fr";
  if (["de", "de-de", "german", "deutsch", "aleman", "alemán"].includes(raw)) return "de";

  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("de")) return "de";

  return null;
}

export function detectContactLanguage(...samples: Array<string | null | undefined>): SupportedContactLanguage {
  const text = samples
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();

  if (!text.trim()) return "es";

  const score = {
    es: 0,
    en: 0,
    fr: 0,
    de: 0,
  };

  const buckets: Record<SupportedContactLanguage, string[]> = {
    es: [" hola ", " piso ", " vivienda ", " interes", " interesa ", " gracias ", " informacion ", " precio ", " fotos ", " por favor ", " quisiera ", " habitacion "],
    en: [" hello ", " property ", " house ", " apartment ", " interested ", " details ", " link ", " thanks ", " please ", " price ", " photos "],
    fr: [" bonjour ", " maison ", " appartement ", " interesse ", " intéress", " merci ", " prix ", " lien ", " informations ", " s il vous plait ", " voudrais "],
    de: [" hallo ", " wohnung ", " haus ", " interessiert ", " preis ", " link ", " bitte ", " danke ", " informationen "],
  };

  for (const [lang, words] of Object.entries(buckets) as [SupportedContactLanguage, string[]][]) {
    for (const word of words) {
      if (text.includes(word.trim())) {
        score[lang] += 1;
      }
    }
  }

  if (/[¿¡ñ]/.test(text)) score.es += 1;
  if (/[ç]/.test(text)) score.fr += 1;
  if (/[äöüß]/.test(text)) score.de += 2;

  const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [bestLang, bestScore] = sorted[0] as [SupportedContactLanguage, number];
  return bestScore > 0 ? bestLang : "en";
}

export function resolveContactLanguage(preferredLanguage?: string | null, ...samples: Array<string | null | undefined>): SupportedContactLanguage {
  return normalizeContactLanguage(preferredLanguage) || detectContactLanguage(...samples) || "en";
}

export function languageName(language?: string | null): string {
  switch (normalizeContactLanguage(language) || "en") {
    case "es":
      return "español";
    case "fr":
      return "francés";
    case "de":
      return "alemán";
    default:
      return "inglés";
  }
}

export function buildDemandFollowUpMessage(contactName: string | null | undefined, channel: "whatsapp" | "email", language: SupportedContactLanguage) {
  const firstName = contactName?.split(" ")[0] || "";

  if (language === "en") {
    if (channel === "email") {
      return {
        text: `Perfect ${firstName || "there"}, to help you properly, I just need a bit more detail:\n\n- Are you looking to buy or rent?\n- Which area are you interested in?\n- How many bedrooms do you need?\n- Do you have an approximate budget?\n\nTell me whatever you already know and I'll take it from there.`,
        subject: `${firstName || "Hi"}, tell me what you're looking for`,
      };
    }
    return {
      text: `Perfect${firstName ? `, ${firstName}` : ""}. To help you properly, tell me a bit about what you're looking for:\n\n- Buy or rent?\n- Which area?\n- How many bedrooms?\n- Approximate budget?\n\nTell me what you can and I'll help from there.`,
      subject: undefined,
    };
  }

  if (language === "fr") {
    if (channel === "email") {
      return {
        text: `Parfait ${firstName || ""}. Pour bien vous aider, j'ai juste besoin de quelques détails:\n\n- Vous cherchez à acheter ou à louer ?\n- Quelle zone vous intéresse ?\n- De combien de chambres avez-vous besoin ?\n- Avez-vous un budget approximatif ?\n\nDites-moi ce que vous savez déjà et je m'occupe du reste.`,
        subject: `${firstName || "Bonjour"}, dites-moi ce que vous cherchez`,
      };
    }
    return {
      text: `Parfait${firstName ? ` ${firstName}` : ""}. Pour bien vous aider, dites-moi un peu ce que vous cherchez:\n\n- Achat ou location ?\n- Quelle zone ?\n- Combien de chambres ?\n- Budget approximatif ?\n\nDites-moi ce que vous pouvez et je m'occupe du reste.`,
      subject: undefined,
    };
  }

  if (language === "de") {
    if (channel === "email") {
      return {
        text: `Perfekt ${firstName || ""}. Damit ich dir richtig helfen kann, brauche ich nur ein paar Details:\n\n- Möchtest du kaufen oder mieten?\n- Welche Gegend interessiert dich?\n- Wie viele Schlafzimmer brauchst du?\n- Hast du ein ungefähres Budget?\n\nSag mir einfach, was du schon weißt, und ich kümmere mich um den Rest.`,
        subject: `${firstName || "Hallo"}, sag mir kurz, was du suchst`,
      };
    }
    return {
      text: `Perfekt${firstName ? `, ${firstName}` : ""}. Damit ich dir richtig helfen kann, erzähl mir kurz, was du suchst:\n\n- Kaufen oder mieten?\n- Welche Gegend?\n- Wie viele Schlafzimmer?\n- Ungefähres Budget?\n\nSag mir einfach, was du schon weißt, und ich helfe dir weiter.`,
      subject: undefined,
    };
  }

  if (channel === "email") {
    return {
      text: `¡Genial, ${firstName || "encantado"}! Para ayudarte mejor, me vendría genial saber un poco más:\n\n- ¿Buscas comprar o alquilar?\n- ¿Qué zona te interesa?\n- ¿Cuántas habitaciones necesitas?\n- ¿Tienes un presupuesto orientativo?\n\nCuéntame lo que puedas y me encargo del resto.`,
      subject: `${firstName || "Hola"}, cuéntame qué buscas`,
    };
  }

  return {
    text: `¡Genial${firstName ? `, ${firstName}` : ""}! Para ayudarte mejor, cuéntame un poco qué buscas:\n\n- ¿Comprar o alquilar?\n- ¿Qué zona te interesa?\n- ¿Cuántas habitaciones necesitas?\n- ¿Tienes un presupuesto orientativo?\n\nCuéntame lo que puedas y te ayudo a encontrar algo que encaje.`,
    subject: undefined,
  };
}

export function buildDemandConfirmationMessage(
  contactName: string | null | undefined,
  detailStr: string,
  channel: "whatsapp" | "email",
  language: SupportedContactLanguage,
) {
  const firstName = contactName?.split(" ")[0] || "";

  if (language === "en") {
    if (channel === "email") {
      return {
        text: `Perfect ${firstName || ""}. I've already saved what you're looking for${detailStr}.\n\nAs soon as I have something that fits, I'll send it over.`,
        subject: `${firstName || "Hi"}, your search is now saved`,
      };
    }
    return {
      text: `Perfect${firstName ? `, ${firstName}` : ""}. I've already noted down what you're looking for${detailStr}.\n\nAs soon as I have something that fits, I'll send it to you here.`,
      subject: undefined,
    };
  }

  if (language === "fr") {
    if (channel === "email") {
      return {
        text: `Parfait ${firstName || ""}. J'ai bien enregistré votre recherche${detailStr}.\n\nDès que j'ai quelque chose qui correspond, je vous l'envoie.`,
        subject: `${firstName || "Bonjour"}, votre recherche est enregistrée`,
      };
    }
    return {
      text: `Parfait${firstName ? ` ${firstName}` : ""}. J'ai bien noté ce que vous cherchez${detailStr}.\n\nDès que j'ai quelque chose qui correspond, je vous écris ici.`,
      subject: undefined,
    };
  }

  if (language === "de") {
    if (channel === "email") {
      return {
        text: `Perfekt ${firstName || ""}. Ich habe deine Suche${detailStr} schon erfasst.\n\nSobald ich etwas Passendes habe, schicke ich es dir direkt rüber.`,
        subject: `${firstName || "Hallo"}, deine Suche ist gespeichert`,
      };
    }
    return {
      text: `Perfekt${firstName ? `, ${firstName}` : ""}. Ich habe schon notiert, was du suchst${detailStr}.\n\nSobald ich etwas Passendes habe, schreibe ich dir hier.`,
      subject: undefined,
    };
  }

  if (channel === "email") {
    return {
      text: `¡Perfecto, ${firstName || "encantado"}! He registrado tu búsqueda${detailStr}.\n\nEn cuanto tengamos algo que encaje con lo que necesitas, te lo haré llegar.`,
      subject: `${firstName || "Hola"}, tu búsqueda está registrada`,
    };
  }

  return {
    text: `¡Perfecto${firstName ? `, ${firstName}` : ""}! Ya tengo apuntado lo que buscas${detailStr}.\n\nEn cuanto tenga algo que encaje te aviso por aquí.`,
    subject: undefined,
  };
}
