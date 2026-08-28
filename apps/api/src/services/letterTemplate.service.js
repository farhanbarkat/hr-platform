import { LetterTemplate } from '../models/letterTemplate.model.js';
import { Company } from '../models/company.model.js';
import {
  TEMPLATE_TYPES,
  ALLOWED_PLACEHOLDERS,
  SYSTEM_DEFAULT_TEMPLATES,
} from '../constants/letterTemplate.constants.js';
import { ApiError } from '../utils/ApiError.js';
import fs from 'fs';
import path from 'path';

export class LetterTemplateService {
  /**
   * Validate HTML content against allowed placeholder tags for given template type
   */
  static validatePlaceholders(templateType, bodyContent) {
    if (!TEMPLATE_TYPES.includes(templateType)) {
      throw new ApiError(400, `Invalid template type: ${templateType}`);
    }

    const allowed = ALLOWED_PLACEHOLDERS[templateType] || [];
    const placeholderRegex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const foundTags = new Set();
    let match;

    while ((match = placeholderRegex.exec(bodyContent)) !== null) {
      foundTags.add(match[1]);
    }

    const invalidTags = Array.from(foundTags).filter((tag) => !allowed.includes(tag));

    if (invalidTags.length > 0) {
      throw new ApiError(
        400,
        `Invalid placeholder tag(s) detected: ${invalidTags.map((t) => `{{${t}}}`).join(', ')}. Allowed tags for ${templateType}: ${allowed.map((t) => `{{${t}}}`).join(', ')}`
      );
    }

    return { isValid: true, tags: Array.from(foundTags) };
  }

  /**
   * Fetch company template or fall back to system default
   */
  static async getEffectiveTemplate(companyId, templateType) {
    if (!TEMPLATE_TYPES.includes(templateType)) {
      throw new ApiError(400, `Unsupported template type: ${templateType}`);
    }

    const customTemplate = await LetterTemplate.findOne({ companyId, templateType });

    if (customTemplate) {
      return {
        isCustomized: true,
        template: customTemplate,
        allowedPlaceholders: ALLOWED_PLACEHOLDERS[templateType],
      };
    }

    const defaultTmpl = SYSTEM_DEFAULT_TEMPLATES[templateType];
    return {
      isCustomized: false,
      template: {
        companyId,
        templateType,
        title: defaultTmpl.title,
        bodyContent: defaultTmpl.bodyContent,
        isDefault: true,
      },
      allowedPlaceholders: ALLOWED_PLACEHOLDERS[templateType],
    };
  }

  /**
   * Replace placeholders in template with actual dataContext
   */
  static compileTemplate(bodyContent, dataContext) {
    return bodyContent.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
      return dataContext[key] !== undefined && dataContext[key] !== null
        ? String(dataContext[key])
        : '';
    });
  }

  /**
   * Single shared entry point: Generate Letter HTML and store artifact
   */
  static async generateLetterPdf({
    templateType,
    companyId,
    dataContext = {},
    employeeId = null,
    generatedBy = null,
  }) {
    const { template } = await this.getEffectiveTemplate(companyId, templateType);
    const company = await Company.findById(companyId);

    // Context enrichments
    const enrichedContext = {
      companyName: company?.name || 'Company Name',
      companyAddress: company?.address || '',
      currentDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      ...dataContext,
    };

    const compiledHtml = this.compileTemplate(template.bodyContent, enrichedContext);

    const fullHtmlDocument = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${template.title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #2d3748; line-height: 1.6; }
          h2 { color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 24px; }
          p { margin: 12px 0; }
          strong { color: #1a202c; }
          .footer { margin-top: 40px; font-size: 12px; color: #718096; }
        </style>
      </head>
      <body>
        ${compiledHtml}
      </body>
      </html>
    `;

    // Local artifact directory setup
    let fileUrl = '';
    try {
      const lettersDir = path.join(process.cwd(), 'public', 'letters', String(companyId));
      if (!fs.existsSync(lettersDir)) {
        fs.mkdirSync(lettersDir, { recursive: true });
      }
      const fileName = `${templateType}_${employeeId || 'doc'}_${Date.now()}.html`;
      const localFilePath = path.join(lettersDir, fileName);
      fs.writeFileSync(localFilePath, fullHtmlDocument, 'utf-8');
      fileUrl = `/letters/${companyId}/${fileName}`;
    } catch (err) {
      fileUrl = `data:text/html;charset=utf-8,${encodeURIComponent(fullHtmlDocument)}`;
    }

    return {
      success: true,
      templateType,
      title: template.title,
      html: fullHtmlDocument,
      fileUrl,
      generatedAt: new Date(),
    };
  }
}