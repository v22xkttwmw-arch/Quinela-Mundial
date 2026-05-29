export const TEAM_FLAGS: Record<string, string> = {
  // Grupo A
  "Argentina": "ar", "México": "mx", "Polonia": "pl", "Arabia Saudita": "sa",
  // Grupo B
  "Brasil": "br", "Suiza": "ch", "Serbia": "rs", "Ghana": "gh",
  // Grupo C
  "Francia": "fr", "Marruecos": "ma", "Australia": "au", "Túnez": "tn",
  // Grupo D
  "España": "es", "Japón": "jp", "Alemania": "de", "Costa Rica": "cr",
  // Grupo E
  "Países Bajos": "nl", "EE.UU": "us", "Irán": "ir", "Senegal": "sn",
  // Grupo F
  "Portugal": "pt", "Uruguay": "uy", "Corea del Sur": "kr", "Ecuador": "ec",
  // Grupo G
  "Inglaterra": "gb-eng", "Colombia": "co", "Gales": "gb-wls", "Croacia": "hr",
  // Grupo H
  "Bélgica": "be", "Canadá": "ca", "Camerún": "cm", "Honduras": "hn",
  // Grupo I
  "Italia": "it", "Chile": "cl", "Nigeria": "ng", "Albania": "al",
  // Grupo J
  "Suecia": "se", "Turquía": "tr", "Venezuela": "ve", "Bolivia": "bo",
  // Grupo K
  "Dinamarca": "dk", "Argelia": "dz", "Jamaica": "jm", "Paraguay": "py",
  // Grupo L
  "Austria": "at", "Costa de Marfil": "ci", "Qatar": "qa", "Panamá": "pa",
};

export function flagUrl(team: string, width: 20 | 40 | 80 = 40): string {
  const code = TEAM_FLAGS[team];
  return code ? `https://flagcdn.com/w${width}/${code}.png` : "";
}
