import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NewsRoom <noreply@m3media.com>',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html: wrapInTemplate(subject, html),
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error };
  }
}

function wrapInTemplate(title: string, content: string): string {
  const logoUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/newsroom-logo.png`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f0f3f8;font-family:'Source Sans 3',Georgia,serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="background:#ffffff;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center;border:1px solid #bcc9e1;border-bottom:4px solid #111c30;">
          ${logoUrl ? `
            <img src="${logoUrl}" alt="The NewsRoom"
                 style="height:36px;width:auto;display:inline-block;" />
          ` : `
            <h1 style="margin:0;color:#111c30;font-size:20px;font-weight:700;letter-spacing:0.5px;">
              <span style="color:#111c30;">The News</span><span style="color:#D42B2B;">Room</span>
            </h1>
          `}
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #bcc9e1;border-top:none;border-radius:0 0 8px 8px;">
          <h2 style="margin:0 0 20px;color:#111c30;font-size:18px;">${title}</h2>
          ${content}
        </div>
        <div style="padding:20px;text-align:center;">
          <p style="margin:0;color:#6580b0;font-size:12px;">
            The NewsRoom &bull; <a href="${process.env.NEXTAUTH_URL}" style="color:#D42B2B;">newsroom.m3media.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Specific email templates
export async function sendSubmissionConfirmation(
  writerEmail: string,
  writerName: string,
  headline: string,
  articleId: string
) {
  return sendEmail({
    to: writerEmail,
    subject: `Story Submitted: "${headline}"`,
    html: `
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        Hi ${writerName},
      </p>
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        Your story <strong>"${headline}"</strong> has been successfully submitted for review.
        Our editorial team will review it shortly.
      </p>
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        You can track the status of your story in the
        <a href="${process.env.NEXTAUTH_URL}/dashboard" style="color:#D42B2B;">newsroom dashboard</a>.
      </p>
      <div style="margin:24px 0;padding:16px;background:#fef2f2;border-left:4px solid #D42B2B;border-radius:0 4px 4px 0;">
        <p style="margin:0;color:#465f94;font-size:13px;">
          Article ID: ${articleId}
        </p>
      </div>
    `,
  });
}

export async function sendEditorNotification(
  editorEmails: string[],
  writerName: string,
  headline: string,
  articleId: string
) {
  return sendEmail({
    to: editorEmails,
    subject: `New Submission for Review: "${headline}"`,
    html: `
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        A new story has been submitted for your review:
      </p>
      <div style="margin:20px 0;padding:20px;background:#f0f3f8;border-radius:6px;border:1px solid #bcc9e1;">
        <h3 style="margin:0 0 8px;color:#111c30;font-size:16px;">${headline}</h3>
        <p style="margin:0;color:#6580b0;font-size:14px;">By ${writerName}</p>
      </div>
      <a href="${process.env.NEXTAUTH_URL}/editor/${articleId}" 
         style="display:inline-block;padding:12px 24px;background:#111c30;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
        Review Story →
      </a>
    `,
  });
}

export async function sendReviewDecision(
  writerEmail: string,
  writerName: string,
  headline: string,
  decision: 'approved' | 'revision_requested' | 'rejected',
  notes?: string
) {
  const decisionText = {
    approved: 'Your story has been approved! 🎉',
    revision_requested: 'Your story needs some revisions.',
    rejected: 'Your story was not approved at this time.',
  };

  const decisionColor = {
    approved: '#16a34a',
    revision_requested: '#D42B2B',
    rejected: '#dc2626',
  };

  return sendEmail({
    to: writerEmail,
    subject: `Review Decision: "${headline}"`,
    html: `
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        Hi ${writerName},
      </p>
      <div style="margin:20px 0;padding:16px;background:#f0f3f8;border-left:4px solid ${decisionColor[decision]};border-radius:0 4px 4px 0;">
        <p style="margin:0;color:#111c30;font-size:15px;font-weight:600;">
          ${decisionText[decision]}
        </p>
      </div>
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        Story: <strong>"${headline}"</strong>
      </p>
      ${notes ? `
        <div style="margin:20px 0;padding:16px;background:#f0f3f8;border-radius:6px;">
          <p style="margin:0 0 8px;color:#465f94;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Editor Notes</p>
          <p style="margin:0;color:#192842;font-size:14px;line-height:1.6;">${notes}</p>
        </div>
      ` : ''}
      <a href="${process.env.NEXTAUTH_URL}/dashboard" 
         style="display:inline-block;padding:12px 24px;background:#111c30;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
        View in Dashboard →
      </a>
    `,
  });
}
