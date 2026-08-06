import { companyService } from './company.service.js';
import { formRepository } from '../repositories/form.repository.js';
import { formFieldRepository } from '../repositories/formField.repository.js';
import { AppError } from '../utils/errors.js';
import {
  FormFieldType,
  FormStatus,
  toPublicForm,
} from '../models/form.model.js';

async function assertCompany(companyId) {
  const company = await companyService.getById(companyId);
  if (!company) {
    throw new AppError('Empresa não encontrada', {
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  }
  return company;
}

function validateFieldsInput(fields = []) {
  for (const field of fields) {
    const needsOptions =
      field.type === FormFieldType.SELECT ||
      field.type === FormFieldType.RADIO ||
      field.type === FormFieldType.CHECKBOX;

    if (needsOptions && (!Array.isArray(field.options) || field.options.length === 0)) {
      throw new AppError(
        `Campo "${field.label}" do tipo ${field.type} precisa de options`,
        { statusCode: 400, code: 'VALIDATION_ERROR' }
      );
    }
  }
}

async function getFormWithFields(companyId, formId) {
  const form = await formRepository.findById(companyId, formId);
  if (!form) {
    throw new AppError('Formulário não encontrado', {
      statusCode: 404,
      code: 'FORM_NOT_FOUND',
    });
  }
  const fields = await formFieldRepository.findByFormId(form.id);
  return toPublicForm(form, fields);
}

export const formsService = {
  async list(companyId) {
    await assertCompany(companyId);
    const forms = await formRepository.findByCompanyId(companyId);
    const result = [];
    for (const form of forms) {
      const fields = await formFieldRepository.findByFormId(form.id);
      result.push(toPublicForm(form, fields));
    }
    return result;
  },

  async getById(companyId, formId) {
    await assertCompany(companyId);
    return getFormWithFields(companyId, formId);
  },

  /** Público / submit: busca form ativo sem JWT */
  async getActivePublic(formId) {
    const form = await formRepository.findByIdAnyCompany(formId);
    if (!form || form.status !== FormStatus.ACTIVE) {
      throw new AppError('Formulário não encontrado ou inativo', {
        statusCode: 404,
        code: 'FORM_NOT_FOUND',
      });
    }
    const fields = await formFieldRepository.findByFormId(form.id);
    return {
      companyId: form.company_id,
      form: toPublicForm(form, fields),
      rawForm: form,
      rawFields: fields,
    };
  },

  async create(companyId, input) {
    await assertCompany(companyId);
    validateFieldsInput(input.fields || []);

    const form = await formRepository.create({
      companyId,
      name: input.name,
      description: input.description,
      status: input.status || FormStatus.ACTIVE,
    });

    const fields = await formFieldRepository.createMany(
      form.id,
      input.fields || []
    );

    return toPublicForm(form, fields);
  },

  async update(companyId, formId, input) {
    await assertCompany(companyId);
    const existing = await formRepository.findById(companyId, formId);
    if (!existing) {
      throw new AppError('Formulário não encontrado', {
        statusCode: 404,
        code: 'FORM_NOT_FOUND',
      });
    }

    if (input.fields) {
      validateFieldsInput(input.fields);
    }

    const form = await formRepository.update(companyId, formId, {
      name: input.name,
      description: input.description,
      status: input.status,
    });

    let fields;
    if (input.fields) {
      fields = await formFieldRepository.replaceForForm(formId, input.fields);
    } else {
      fields = await formFieldRepository.findByFormId(formId);
    }

    return toPublicForm(form, fields);
  },

  async remove(companyId, formId) {
    await assertCompany(companyId);
    const existing = await formRepository.findById(companyId, formId);
    if (!existing) {
      throw new AppError('Formulário não encontrado', {
        statusCode: 404,
        code: 'FORM_NOT_FOUND',
      });
    }
    await formFieldRepository.deleteByFormId(formId);
    await formRepository.delete(companyId, formId);
    return { deleted: true };
  },
};
