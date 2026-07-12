export function RollingNumber({
  value,
  previousValue = value,
  format,
  className = "",
}: {
  value: number;
  previousValue?: number;
  format: (value: number) => string;
  className?: string;
}) {
  const formatted = format(value);
  const previousFormatted = format(previousValue);
  const changed = previousFormatted !== formatted;
  const direction = value >= previousValue ? "up" : "down";
  const previousOffset = previousFormatted.length - formatted.length;

  return (
    <span
      className={`rolling-number ${changed ? `is-rolling-${direction}` : ""} ${className}`.trim()}
    >
      <span className="sr-only">{formatted}</span>
      <span aria-hidden="true" className="rolling-number-digits">
        {Array.from(formatted).map((character, index) => {
          const oldCharacter = previousFormatted[index + previousOffset] ?? "";
          const rolls =
            changed &&
            character !== oldCharacter &&
            isDigit(character) &&
            isDigit(oldCharacter);

          return (
            <span className="rolling-number-slot" key={`${index}-${character}`}>
              {rolls ? (
                <span className="rolling-number-reel">
                  {direction === "up" ? (
                    <>
                      <span data-character={oldCharacter} />
                      <span data-character={character} />
                    </>
                  ) : (
                    <>
                      <span data-character={character} />
                      <span data-character={oldCharacter} />
                    </>
                  )}
                </span>
              ) : (
                <span
                  className="rolling-number-static"
                  data-character={character}
                />
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}

function isDigit(value: string) {
  return value >= "0" && value <= "9";
}
