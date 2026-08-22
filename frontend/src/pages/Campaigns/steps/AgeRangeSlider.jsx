const AGE_MIN = 13;
const AGE_MAX = 65;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value) {
  return ((value - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;
}

/**
 * Compact dual-handle age range. Writes the same ageMin/ageMax numbers used by state.
 */
export default function AgeRangeSlider({
  ageMin,
  ageMax,
  onChange,
  errorMin,
  errorMax,
}) {
  const minValue = clamp(Number(ageMin) || AGE_MIN, AGE_MIN, AGE_MAX);
  const maxValue = clamp(Number(ageMax) || AGE_MAX, AGE_MIN, AGE_MAX);
  const low = Math.min(minValue, maxValue);
  const high = Math.max(minValue, maxValue);

  function setMin(next) {
    const value = clamp(Number(next), AGE_MIN, high);
    onChange({ ageMin: value, ageMax: high });
  }

  function setMax(next) {
    const value = clamp(Number(next), low, AGE_MAX);
    onChange({ ageMin: low, ageMax: value });
  }

  const left = toPercent(low);
  const right = toPercent(high);

  return (
    <div
      className={`wizard-age-range${
        errorMin || errorMax ? ' is-invalid' : ''
      }`}
    >
      <div className="wizard-age-range__values" aria-hidden="true">
        <span>{low} anos</span>
        <span>{high} anos</span>
      </div>

      <div className="wizard-age-range__track-wrap">
        <div className="wizard-age-range__rail" aria-hidden="true">
          <div
            className="wizard-age-range__fill"
            style={{ left: `${left}%`, width: `${right - left}%` }}
          />
        </div>

        <input
          className="wizard-age-range__input wizard-age-range__input--min"
          type="range"
          min={AGE_MIN}
          max={AGE_MAX}
          step={1}
          value={low}
          style={{ zIndex: low > high - 2 ? 5 : 3 }}
          aria-label="Idade mínima"
          aria-valuemin={AGE_MIN}
          aria-valuemax={high}
          aria-valuenow={low}
          aria-valuetext={`${low} anos`}
          onChange={(e) => setMin(e.target.value)}
        />
        <input
          className="wizard-age-range__input wizard-age-range__input--max"
          type="range"
          min={AGE_MIN}
          max={AGE_MAX}
          step={1}
          value={high}
          style={{ zIndex: 4 }}
          aria-label="Idade máxima"
          aria-valuemin={low}
          aria-valuemax={AGE_MAX}
          aria-valuenow={high}
          aria-valuetext={`${high} anos`}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>

      <div className="wizard-age-range__bounds" aria-hidden="true">
        <span>{AGE_MIN}</span>
        <span>{AGE_MAX}</span>
      </div>

      <p className="wizard-age-range__summary">
        De {low} até {high} anos
      </p>

      {errorMin ? <span className="field-error">{errorMin}</span> : null}
      {errorMax ? <span className="field-error">{errorMax}</span> : null}
    </div>
  );
}
