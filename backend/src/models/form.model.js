export const FormStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
});

export const FormFieldType = Object.freeze({
  TEXT: 'TEXT',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
  SELECT: 'SELECT',
  RADIO: 'RADIO',
  CHECKBOX: 'CHECKBOX',
  TEXTAREA: 'TEXTAREA',
});

export function toPublicForm(row, fields = []) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    fields: fields.map(toPublicFormField),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicFormField(row) {
  if (!row) return null;

  let options = row.options;
  let validation = row.validation;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch {
      options = null;
    }
  }
  if (typeof validation === 'string') {
    try {
      validation = JSON.parse(validation);
    } catch {
      validation = null;
    }
  }

  return {
    id: row.id,
    type: row.type,
    label: row.label,
    placeholder: row.placeholder,
    required: Boolean(row.required),
    position: row.position,
    options: options || null,
    validation: validation || null,
  };
}

export function toPublicLeadAnswer(row, field = null) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    fieldId: row.form_field_id,
    value: row.value,
    field: field ? toPublicFormField(field) : undefined,
    createdAt: row.created_at,
  };
}
