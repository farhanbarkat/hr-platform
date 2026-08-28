import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { LetterTemplate } from '../models/letterTemplate.model.js';
import { LetterTemplateService } from '../services/letterTemplate.service.js';
import {
  TEMPLATE_TYPES,
  ALLOWED_PLACEHOLDERS,
  SYSTEM_DEFAULT_TEMPLATES,
} from '../constants/letterTemplate.constants.js';

export const getLetterTemplates = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const customTemplates = await LetterTemplate.find({ companyId });
  const customMap = new Map(customTemplates.map((t) => [t.templateType, t]));

  const result = TEMPLATE_TYPES.map((type) => {
    const custom = customMap.get(type);
    if (custom) {
      return {
        templateType: type,
        title: custom.title,
        bodyContent: custom.bodyContent,
        isCustomized: true,
        updatedAt: custom.updatedAt,
        allowedPlaceholders: ALLOWED_PLACEHOLDERS[type],
      };
    }
    const def = SYSTEM_DEFAULT_TEMPLATES[type];
    return {
      templateType: type,
      title: def.title,
      bodyContent: def.bodyContent,
      isCustomized: false,
      updatedAt: null,
      allowedPlaceholders: ALLOWED_PLACEHOLDERS[type],
    };
  });

  return res.status(200).json(
    new ApiResponse(200, { templates: result }, 'Letter templates retrieved successfully.')
  );
});

export const getLetterTemplateByType = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { templateType } = req.params;

  const data = await LetterTemplateService.getEffectiveTemplate(companyId, templateType);

  return res.status(200).json(
    new ApiResponse(200, data, `Template details for ${templateType} retrieved.`)
  );
});

export const upsertLetterTemplate = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { templateType } = req.params;
  const { title, bodyContent } = req.body;

  if (!title || !bodyContent) {
    throw new ApiError(400, 'Title and bodyContent are required.');
  }

  // Pre-save validation: Reject unknown placeholder tags
  LetterTemplateService.validatePlaceholders(templateType, bodyContent);

  const updated = await LetterTemplate.findOneAndUpdate(
    { companyId, templateType },
    {
      companyId,
      templateType,
      title: title.trim(),
      bodyContent,
      isDefault: false,
      updatedBy: req.user._id,
    },
    { new: true, upsert: true, runValidators: true }
  );

  return res.status(200).json(
    new ApiResponse(200, updated, `Template for ${templateType} saved successfully.`)
  );
});

export const resetLetterTemplateToDefault = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { templateType } = req.params;

  await LetterTemplate.findOneAndDelete({ companyId, templateType });

  const defaultData = await LetterTemplateService.getEffectiveTemplate(companyId, templateType);

  return res.status(200).json(
    new ApiResponse(200, defaultData, `Template ${templateType} reset to system default.`)
  );
});

export const previewLetter = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { templateType } = req.params;
  const { sampleData } = req.body;

  const preview = await LetterTemplateService.generateLetterPdf({
    templateType,
    companyId,
    dataContext: sampleData || {},
    employeeId: 'PREVIEW_EMP',
    generatedBy: req.user._id,
  });

  return res.status(200).json(
    new ApiResponse(200, preview, 'Letter preview generated successfully.')
  );
});