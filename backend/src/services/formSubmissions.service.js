import { formsService } from './forms.service.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { leadAnswerRepository } from '../repositories/leadAnswer.repository.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { LeadStatus, buildLeadOrigin, toPublicLead } from '../models/lead.model.js';
import { FormFieldType, toPublicLeadAnswer } from '../models/form.model.js';
import { emitLeadCreated } from '../events/lead.events.js';

function normalizeAnswerValue(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  return String(value).trim();
}

function validateAnswerAgainstField(field, rawValue) {
  const value = normalizeAnswerValue(rawValue);
  const empty =
    value == null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (Boolean(field.required) && empty) {
    throw new AppError(`Campo obrigatório: ${field.label}`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (empty) return null;

  let validation = field.validation;
  if (typeof validation === 'string') {
    try {
      validation = JSON.parse(validation);
    } catch {
      validation = null;
    }
  }

  const asString = Array.isArray(value) ? value.join(',') : String(value);

  if (validation?.minLength != null && asString.length < validation.minLength) {
    throw new AppError(
      `"${field.label}" deve ter no mínimo ${validation.minLength} caracteres`,
      { statusCode: 400, code: 'VALIDATION_ERROR' }
    );
  }
  if (validation?.maxLength != null && asString.length > validation.maxLength) {
    throw new AppError(
      `"${field.label}" deve ter no máximo ${validation.maxLength} caracteres`,
      { statusCode: 400, code: 'VALIDATION_ERROR' }
    );
  }
  if (validation?.regex) {
    try {
      const re = new RegExp(validation.regex);
      if (!re.test(asString)) {
        throw new AppError(`"${field.label}" inválido`, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }

  if (field.type === FormFieldType.EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString)) {
    throw new AppError(`Email inválido: ${field.label}`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return Array.isArray(value) ? JSON.stringify(value) : asString;
}

function extractContactFromAnswers(fields, answersByFieldId) {
  let name = null;
  let email = null;
  let phone = null;

  for (const field of fields) {
    const value = answersByFieldId.get(Number(field.id));
    if (value == null || value === '') continue;
    if (field.type === FormFieldType.EMAIL && !email) email = value;
    if (field.type === FormFieldType.PHONE && !phone) phone = value;
    if (
      !name &&
      field.type === FormFieldType.TEXT &&
      /nome/i.test(String(field.label || ''))
    ) {
      name = value;
    }
  }

  if (!name) {
    const firstText = fields.find((f) => f.type === FormFieldType.TEXT);
    if (firstText) {
      name = answersByFieldId.get(Number(firstText.id)) || null;
    }
  }

  return { name, email, phone };
}

export const formSubmissionsService = {
  async submit(formId, input) {
    const { companyId, form, rawFields } = await formsService.getActivePublic(
      formId
    );

    const fieldById = new Map(rawFields.map((f) => [Number(f.id), f]));
    const answersByFieldId = new Map();

    for (const answer of input.answers || []) {
      const fieldId = Number(answer.field_id);
      const field = fieldById.get(fieldId);
      if (!field) {
        throw new AppError(`Campo inválido: ${fieldId}`, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
      const normalized = validateAnswerAgainstField(field, answer.value);
      answersByFieldId.set(fieldId, normalized);
    }

    for (const field of rawFields) {
      if (!Boolean(field.required)) continue;
      if (!answersByFieldId.has(Number(field.id))) {
        throw new AppError(`Campo obrigatório: ${field.label}`, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const contact = extractContactFromAnswers(rawFields, answersByFieldId);

    const labeledAnswers = rawFields.map((field) => ({
      key: String(field.id),
      label: field.label,
      value: answersByFieldId.get(Number(field.id)) ?? '',
    }));

    const origin = buildLeadOrigin({
      source: 'FORM',
      formName: form.name,
    });

    const lead = await leadRepository.create({
      companyId,
      pageId: null,
      formId: String(form.id),
      companyFormId: form.id,
      metaLeadId: null,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      status: LeadStatus.NEW,
      source: 'FORM',
      origin,
      formName: form.name,
      rawData: {
        source: 'FORM',
        formId: form.id,
        formName: form.name,
        answers: labeledAnswers,
      },
    });

    const answerRows = [...answersByFieldId.entries()].map(
      ([formFieldId, value]) => ({
        formFieldId,
        value,
      })
    );

    await leadAnswerRepository.createMany(lead.id, answerRows);

    emitLeadCreated({ companyId, leadId: lead.id });

    logger.info('Formulário submetido', {
      companyId,
      formId: form.id,
      leadId: lead.id,
    });

    const savedAnswers = await leadAnswerRepository.findByLeadId(lead.id);

    return {
      lead: toPublicLead(lead),
      answers: savedAnswers.map((row) =>
        toPublicLeadAnswer(row, fieldById.get(Number(row.form_field_id)))
      ),
    };
  },
};
