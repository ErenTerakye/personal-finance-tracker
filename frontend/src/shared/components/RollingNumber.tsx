import { useState } from "react";

export function RollingNumber<T extends string | number>({
  value,
  previousValue = value,
  format,
  className = "",
}: {
  value: T;
  previousValue?: T;
  format: (value: T) => string;
  className?: string;
}) {
  const formatted = format(value);
  const previousFormatted = format(previousValue);
  const changed = previousFormatted !== formatted;
  const direction = Number(value) >= Number(previousValue) ? "up" : "down";
  const transitionKey = `${previousFormatted}\u0000${formatted}`;
  const [completedTransition, setCompletedTransition] = useState<string>();
  const animating = changed && completedTransition !== transitionKey;
  const slots = alignCharacters(
    animating ? previousFormatted : formatted,
    formatted,
  );

  return (
    <span
      className={`rolling-number ${animating ? `is-rolling-${direction}` : ""} ${className}`.trim()}
    >
      <span className="sr-only">{formatted}</span>
      <span
        aria-hidden="true"
        className="rolling-number-digits"
        key={animating ? transitionKey : formatted}
        onAnimationEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === "rolling-number-lifecycle"
          ) {
            setCompletedTransition(transitionKey);
          }
        }}
      >
        {slots.map(({ oldCharacter, character }, index) => {
          const exiting = !character;
          const rolls =
            animating &&
            isDigit(character) &&
            isDigit(oldCharacter) &&
            character !== oldCharacter;
          const slotState = !oldCharacter
            ? "is-entering"
            : !character
              ? "is-exiting"
              : "";
          const isSymbol = character !== "" && !isDigit(character);

          return (
            <span
              className={`rolling-number-slot ${slotState} ${isSymbol ? "is-symbol" : ""}`.trim()}
              key={index}
            >
              <span className="rolling-number-slot-content">
                {exiting ? (
                  <span
                    className="rolling-number-static"
                    data-character={oldCharacter}
                  />
                ) : rolls ? (
                  <span className="rolling-number-reel">
                    {direction === "up" ? (
                      <>
                        <span
                          className="rolling-number-previous"
                          data-character={oldCharacter}
                        />
                        <span
                          className="rolling-number-current"
                          data-character={character}
                        />
                      </>
                    ) : (
                      <>
                        <span
                          className="rolling-number-current"
                          data-character={character}
                        />
                        <span
                          className="rolling-number-previous"
                          data-character={oldCharacter}
                        />
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
            </span>
          );
        })}
      </span>
    </span>
  );
}

function isDigit(character: string) {
  return /\p{Number}/u.test(character);
}

function alignCharacters(previous: string, current: string) {
  const oldCharacters = Array.from(previous);
  const characters = Array.from(current);
  const distances = Array.from({ length: oldCharacters.length + 1 }, () =>
    Array<number>(characters.length + 1).fill(0),
  );

  for (let oldIndex = 0; oldIndex <= oldCharacters.length; oldIndex += 1) {
    distances[oldIndex][0] = oldIndex;
  }
  for (let index = 0; index <= characters.length; index += 1) {
    distances[0][index] = index;
  }

  for (let oldIndex = 1; oldIndex <= oldCharacters.length; oldIndex += 1) {
    for (let index = 1; index <= characters.length; index += 1) {
      distances[oldIndex][index] = Math.min(
        distances[oldIndex - 1][index] + 1,
        distances[oldIndex][index - 1] + 1,
        distances[oldIndex - 1][index - 1] +
          substitutionCost(oldCharacters[oldIndex - 1], characters[index - 1]),
      );
    }
  }

  const slots: { oldCharacter: string; character: string }[] = [];
  let oldIndex = oldCharacters.length;
  let index = characters.length;

  while (oldIndex > 0 || index > 0) {
    const isDiagonal =
      oldIndex > 0 &&
      index > 0 &&
      distances[oldIndex][index] ===
        distances[oldIndex - 1][index - 1] +
          substitutionCost(oldCharacters[oldIndex - 1], characters[index - 1]);

    if (isDiagonal) {
      slots.push({
        oldCharacter: oldCharacters[oldIndex - 1],
        character: characters[index - 1],
      });
      oldIndex -= 1;
      index -= 1;
    } else if (
      oldIndex > 0 &&
      distances[oldIndex][index] === distances[oldIndex - 1][index] + 1
    ) {
      slots.push({ oldCharacter: oldCharacters[oldIndex - 1], character: "" });
      oldIndex -= 1;
    } else {
      slots.push({ oldCharacter: "", character: characters[index - 1] });
      index -= 1;
    }
  }

  return slots.reverse();
}

function substitutionCost(previous: string, current: string) {
  if (previous === current) {
    return 0;
  }
  return isDigit(previous) && isDigit(current) ? 1 : 2;
}
