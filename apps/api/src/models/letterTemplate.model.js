import mongoose, { Schema } from 'mongoose';
import { TEMPLATE_TYPES } from '../constants/letterTemplate.constants.js';

const letterTemplateSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required for custom templates.'],
      index: true,
    },
    templateType: {
      type: String,
      enum: {
        values: TEMPLATE_TYPES,
        message: 'Invalid template type. Allowed: ' + TEMPLATE_TYPES.join(', '),
      },
      required: [true, 'Template type is required.'],
    },
    title: {
      type: String,
      required: [true, 'Template title is required.'],
      trim: true,
    },
    bodyContent: {
      type: String,
      required: [true, 'Template body content is required.'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One custom template per templateType per company
letterTemplateSchema.index({ companyId: 1, templateType: 1 }, { unique: true });

export const LetterTemplate = mongoose.model('LetterTemplate', letterTemplateSchema);