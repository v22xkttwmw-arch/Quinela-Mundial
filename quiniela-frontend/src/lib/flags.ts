export const TEAM_FLAGS: Record<string, string> = {
  // Americas
  "Argentina": "ar", "México": "mx", "Brasil": "br", "Uruguay": "uy",
  "Colombia": "co", "Ecuador": "ec", "Chile": "cl", "Paraguay": "py",
  "Perú": "pe", "Bolivia": "bo", "Venezuela": "ve", "Panamá": "pa",
  "Costa Rica": "cr", "Honduras": "hn", "Canadá": "ca", "Jamaica": "jm",
  "Estados Unidos": "us", "EE.UU": "us",

  // Europe
  "España": "es", "Francia": "fr", "Alemania": "de", "Inglaterra": "gb-eng",
  "Portugal": "pt", "Países Bajos": "nl", "Bélgica": "be", "Italia": "it",
  "Croacia": "hr", "Polonia": "pl", "Suiza": "ch", "Dinamarca": "dk",
  "Suecia": "se", "Noruega": "no", "Austria": "at", "Serbia": "rs",
  "Turquía": "tr", "Ucrania": "ua", "Albania": "al", "Gales": "gb-wls",
  "Escocia": "gb-sct",

  // Africa
  "Marruecos": "ma", "Senegal": "sn", "Ghana": "gh", "Nigeria": "ng",
  "Camerún": "cm", "Túnez": "tn", "Argelia": "dz", "Egipto": "eg",
  "Costa de Marfil": "ci", "RD Congo": "cd",

  // Asia / Middle East
  "Japón": "jp", "Corea del Sur": "kr", "Irán": "ir", "Arabia Saudita": "sa",
  "Australia": "au", "Uzbekistán": "uz", "Jordania": "jo",
  "Emiratos Árabes Unidos": "ae", "Qatar": "qa",
};

export function flagUrl(team: string, width: 20 | 40 | 80 = 40): string {
  const code = TEAM_FLAGS[team];
  return code ? `https://flagcdn.com/w${width}/${code}.png` : "";
}
