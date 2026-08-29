import mongoose, { Schema } from 'mongoose';

const teamDiscussionSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: [
      {
        url: String,
        fileType: String,
        name: String,
      },
    ],
  },
  { timestamps: true }
);

teamDiscussionSchema.index({ teamId: 1, createdAt: -1 });

export const TeamDiscussion = mongoose.model('TeamDiscussion', teamDiscussionSchema);