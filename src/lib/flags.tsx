type TeamWithFlagProps = {
  team: string;
  align?: "left" | "right";
  className?: string;
  flagClassName?: string;
};

const TEAM_TO_ISO: Record<string, string> = {
  "Algeriet": "dz",
  "Argentina": "ar",
  "Australien": "au",
  "Belgien": "be",
  "Bosnien och Hercegovina": "ba",
  "Brasilien": "br",
  "Colombia": "co",
  "Curaçao": "cw",
  "DR Kongo": "cd",
  "Ecuador": "ec",
  "Egypten": "eg",
  "Elfenbenskusten": "ci",
  "England": "gb",
  "Frankrike": "fr",
  "Ghana": "gh",
  "Haiti": "ht",
  "Iran": "ir",
  "Irak": "iq",
  "Japan": "jp",
  "Jordanien": "jo",
  "Kanada": "ca",
  "Kap Verde": "cv",
  "Kroatien": "hr",
  "Marocko": "ma",
  "Mexiko": "mx",
  "Nederländerna": "nl",
  "Norge": "no",
  "Nya Zeeland": "nz",
  "Panama": "pa",
  "Paraguay": "py",
  "Portugal": "pt",
  "Qatar": "qa",
  "Saudiarabien": "sa",
  "Schweiz": "ch",
  "Senegal": "sn",
  "Skottland": "gb",
  "Spanien": "es",
  "Sydafrika": "za",
  "Sydkorea": "kr",
  "Sverige": "se",
  "Tjeckien": "cz",
  "Tunisien": "tn",
  "Turkiet": "tr",
  "Tyskland": "de",
  "Uruguay": "uy",
  "USA": "us",
  "Uzbekistan": "uz",
  "Österrike": "at",
};

export function getFlagUrl(team: string) {
  const code = TEAM_TO_ISO[team];
  return code ? `https://flagcdn.com/w40/${code}.png` : null;
}

export function TeamWithFlag({
  team,
  align = "left",
  className = "",
  flagClassName = "h-4 w-6",
}: TeamWithFlagProps) {
  const flagUrl = getFlagUrl(team);
  const rightAligned = align === "right";

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${rightAligned ? "flex-row-reverse justify-end" : ""} ${className}`}>
      {flagUrl && (
        <img
          src={flagUrl}
          alt={`Flagga ${team}`}
          loading="lazy"
          className={`shrink-0 rounded-[2px] border border-border/60 object-cover ${flagClassName}`}
        />
      )}
      <span className="truncate">{team}</span>
    </span>
  );
}
