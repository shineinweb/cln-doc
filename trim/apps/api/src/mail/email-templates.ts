/** Shared Serenity Universal branded email templates (table layout + inline CSS). */

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

export type EmailTemplateKind = 'password_reset' | 'task_assigned' | 'marketing';

const BRAND = {
  canvas: '#100E1C',
  paper: '#1C1733',
  mist: '#261F42',
  ink: '#F6F3FF',
  muted: '#C4B6E4',
  line: '#3C335C',
  blossom: '#FF4F8B',
  violet: '#7C5CFF',
  sky: '#3DDCFF',
  font: "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function webOrigin(): string {
  return (process.env.WEB_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '');
}

function logoUrl(): string {
  return `${webOrigin()}/brand/favicon-192.png`;
}

function ctaButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px">
      <tr>
        <td bgcolor="${BRAND.blossom}" style="border-radius:12px;">
          <a href="${escapeHtml(href)}"
             style="display:inline-block;padding:14px 22px;font-family:${BRAND.font};font-size:15px;font-weight:700;color:#FFF7FB;text-decoration:none;border-radius:12px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${BRAND.font};font-size:15px;line-height:1.55;color:${BRAND.ink};">${html}</p>`;
}

function mutedParagraph(html: string): string {
  return `<p style="margin:0 0 10px;font-family:${BRAND.font};font-size:13px;line-height:1.5;color:${BRAND.muted};">${html}</p>`;
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-family:${BRAND.font};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};width:34%;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-family:${BRAND.font};font-size:15px;color:${BRAND.ink};font-weight:600;">${escapeHtml(value)}</td>
    </tr>`;
}

function renderBrandedShell(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerHtml: string;
}): string {
  const preheader = escapeHtml(input.preheader);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:22px 28px 18px;background:linear-gradient(135deg, ${BRAND.mist} 0%, ${BRAND.paper} 70%);border-bottom:1px solid ${BRAND.line};">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${escapeHtml(logoUrl())}" width="40" height="40" alt="Serenity" style="display:block;border-radius:10px;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:${BRAND.font};font-size:18px;font-weight:800;color:${BRAND.ink};letter-spacing:-0.02em;line-height:1.1;">Serenity</div>
                    <div style="font-family:${BRAND.font};font-size:11px;font-weight:700;color:${BRAND.muted};letter-spacing:0.14em;text-transform:uppercase;margin-top:2px;">Universal</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <div style="font-family:${BRAND.font};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.blossom};margin-bottom:10px;">${escapeHtml(input.eyebrow)}</div>
              <h1 style="margin:0 0 18px;font-family:${BRAND.font};font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;color:${BRAND.ink};">${escapeHtml(input.title)}</h1>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;background:${BRAND.mist};border-top:1px solid ${BRAND.line};">
              ${input.footerHtml}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:${BRAND.font};font-size:11px;color:${BRAND.muted};">© Serenity Universal</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetEmail(input: { name: string; resetUrl: string }): RenderedEmail {
  const subject = 'Reset your Serenity password';
  const text = [
    `Hi ${input.name},`,
    '',
    'Use this link to choose a new Serenity password. It expires in one hour.',
    input.resetUrl,
    '',
    'If you did not ask for a reset, you can ignore this email.',
    '',
    '— Serenity Universal',
  ].join('\n');

  const bodyHtml = [
    paragraph(`Hi ${escapeHtml(input.name)},`),
    paragraph('Use the button below to choose a new Serenity password. This link expires in <strong style="color:#FFD166;">one hour</strong>.'),
    ctaButton('Reset password', input.resetUrl),
    mutedParagraph(`Or paste this link into your browser:<br/><a href="${escapeHtml(input.resetUrl)}" style="color:${BRAND.sky};word-break:break-all;">${escapeHtml(input.resetUrl)}</a>`),
    paragraph('If you did not ask for a reset, you can ignore this email.'),
  ].join('');

  const footerHtml = mutedParagraph('This is a transactional security email from Serenity Universal. It was sent because a password reset was requested for your account.');

  return {
    subject,
    text,
    html: renderBrandedShell({
      preheader: 'Reset your Serenity password — link expires in one hour.',
      eyebrow: 'Password reset',
      title: 'Choose a new password',
      bodyHtml,
      footerHtml,
    }),
  };
}

export function taskAssignedEmail(input: {
  name: string;
  title: string;
  roomName: string;
  siteName: string;
  dueOn: string | null;
  tasksUrl: string;
}): RenderedEmail {
  const dueText = input.dueOn ? ` Due ${input.dueOn}.` : '';
  const subject = `Task assigned: ${input.title}`;
  const text = [
    `Hi ${input.name},`,
    '',
    `You were assigned “${input.title}” in ${input.roomName} at ${input.siteName}.${dueText}`,
    '',
    'Open Serenity → Tasks to review it.',
    input.tasksUrl,
    '',
    '— Serenity Universal',
  ].join('\n');

  const bodyHtml = [
    paragraph(`Hi ${escapeHtml(input.name)},`),
    paragraph('You have a new task assignment in Serenity.'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:${BRAND.mist};border:1px solid ${BRAND.line};border-radius:14px;padding:4px 16px;">
      ${detailRow('Task', input.title)}
      ${detailRow('Room', input.roomName)}
      ${detailRow('Site', input.siteName)}
      ${input.dueOn ? detailRow('Due', input.dueOn) : ''}
    </table>`,
    ctaButton('Open Tasks', input.tasksUrl),
    mutedParagraph('Open Serenity → Tasks to review details, finish work, and keep your board current.'),
  ].join('');

  const footerHtml = mutedParagraph('You received this notification because task email alerts are enabled on your Serenity account.');

  return {
    subject,
    text,
    html: renderBrandedShell({
      preheader: `New task: ${input.title}`,
      eyebrow: 'Task notification',
      title: 'You were assigned a task',
      bodyHtml,
      footerHtml,
    }),
  };
}

export function marketingBroadcastEmail(input: {
  subject: string;
  body: string;
  organizationName: string;
  recipientName?: string;
}): RenderedEmail {
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : 'Hello,';
  const text = [
    greeting,
    '',
    input.body,
    '',
    `— ${input.organizationName} via Serenity Universal`,
    'You received this because you are on the organization roster. Contact your admin to stop marketing email.',
  ].join('\n');

  const bodyHtml = [
    paragraph(escapeHtml(greeting)),
    `<div style="margin:0 0 18px;padding:16px 18px;background:${BRAND.mist};border:1px solid ${BRAND.line};border-radius:14px;font-family:${BRAND.font};font-size:15px;line-height:1.6;color:${BRAND.ink};white-space:pre-wrap;">${escapeHtml(input.body)}</div>`,
    mutedParagraph(`Sent by <strong style="color:${BRAND.ink};">${escapeHtml(input.organizationName)}</strong> through Serenity Universal.`),
  ].join('');

  const footerHtml = mutedParagraph(
    'You received this marketing / announcement email because you are on the organization roster with email notifications enabled. Contact your admin to stop marketing email.',
  );

  return {
    subject: input.subject,
    text,
    html: renderBrandedShell({
      preheader: input.subject,
      eyebrow: 'Announcement',
      title: input.subject,
      bodyHtml,
      footerHtml,
    }),
  };
}

/** Sample/preview payloads for the Email settings UI and tests. */
export function previewEmailTemplate(
  kind: EmailTemplateKind,
  overrides?: { subject?: string; body?: string; recipientName?: string; organizationName?: string },
): RenderedEmail {
  const origin = webOrigin();
  if (kind === 'password_reset') {
    return passwordResetEmail({
      name: overrides?.recipientName?.trim() || 'Alex',
      resetUrl: `${origin}/reset-password?token=preview-token`,
    });
  }
  if (kind === 'task_assigned') {
    return taskAssignedEmail({
      name: overrides?.recipientName?.trim() || 'Alex',
      title: overrides?.subject?.trim() || 'Scout canopy for powdery mildew',
      roomName: 'Flower A',
      siteName: 'Harbor',
      dueOn: '2026-10-05',
      tasksUrl: `${origin}/workspace`,
    });
  }
  return marketingBroadcastEmail({
    subject: overrides?.subject?.trim() || 'Team announcement',
    body: overrides?.body?.trim() || 'Share your update here. This preview uses the same branded template as live sends.',
    organizationName: overrides?.organizationName?.trim() || 'Serenity Universal',
    recipientName: overrides?.recipientName?.trim() || 'Alex',
  });
}
