import { useState } from 'react';
import AgeRangeSlider from './AgeRangeSlider.jsx';

function slugifyLocation(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseLocationInput(raw) {
  const label = String(raw || '').trim();
  if (!label) return null;
  const parts = label.split(',').map((p) => p.trim()).filter(Boolean);
  const city = parts[0] || label;
  const region = parts[1] || '';
  return {
    id: slugifyLocation(`${city}-${region || 'br'}`),
    label: region ? `${city}, ${region}` : city,
    city,
    region: region || null,
    country: 'BR',
    metaId: null,
  };
}

export default function AudienceStep({
  state,
  fieldErrors = {},
  onChange,
  embedded = false,
}) {
  const { audience } = state;
  const [locationInput, setLocationInput] = useState('');

  function patch(partial) {
    onChange(partial);
  }

  function addLocation() {
    const loc = parseLocationInput(locationInput);
    if (!loc) return;
    if (audience.locations.some((item) => item.id === loc.id)) {
      setLocationInput('');
      return;
    }
    patch({ locations: [...audience.locations, loc] });
    setLocationInput('');
  }

  function removeLocation(id) {
    patch({
      locations: audience.locations.filter((item) => item.id !== id),
    });
  }

  return (
    <div className={`wizard-grid${embedded ? ' wizard-grid--tight' : ''}`}>
      {!embedded ? (
        <div>
          <h2 className="wizard-step-title">Quem você quer alcançar?</h2>
        </div>
      ) : (
        <div className="wizard-section-label">Quem você quer alcançar?</div>
      )}

      <div className={`field${fieldErrors.locations ? ' is-invalid' : ''}`}>
        <span className="field-label">
          Localização<span className="field-required">*</span>
        </span>
        <div className="wizard-location-add">
          <input
            className="input"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            placeholder="Cidade, estado ou região"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLocation();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={addLocation}>
            + Adicionar
          </button>
        </div>
        {fieldErrors.locations ? (
          <span className="field-error">{fieldErrors.locations}</span>
        ) : null}
        <div className="wizard-chips">
          {audience.locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className="wizard-chip"
              onClick={() => removeLocation(loc.id)}
            >
              {loc.label} ×
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">
          Faixa de idade<span className="field-required">*</span>
        </span>
        <AgeRangeSlider
          ageMin={audience.ageMin}
          ageMax={audience.ageMax}
          onChange={patch}
          errorMin={fieldErrors.ageMin}
          errorMax={fieldErrors.ageMax}
        />
      </div>

      <fieldset className="wizard-gender">
        <legend className="field-label">
          Gênero<span className="field-required">*</span>
        </legend>
        {[
          { value: 'all', label: 'Todos' },
          { value: 'male', label: 'Homens' },
          { value: 'female', label: 'Mulheres' },
        ].map((option) => (
          <label key={option.value} className="wizard-check">
            <input
              type="radio"
              name="gender"
              checked={audience.gender === option.value}
              onChange={() => patch({ gender: option.value })}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
