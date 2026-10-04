import {
  marketingBroadcastEmail,
  passwordResetEmail,
  previewEmailTemplate,
  taskAssignedEmail,
} from '../src/mail/email-templates';

describe('branded email templates', () => {
  it('renders password reset with CTA and keeps the plain-text token URL', () => {
    const rendered = passwordResetEmail({
      name: 'Casey',
      resetUrl: 'http://localhost:5173/reset-password?token=abc123',
    });
    expect(rendered.subject).toMatch(/password/i);
    expect(rendered.text).toContain('token=abc123');
    expect(rendered.html).toContain('Reset password');
    expect(rendered.html).toContain('Serenity');
    expect(rendered.html).toContain('token=abc123');
    expect(rendered.html).toContain('Password reset');
  });

  it('renders task assignment details and workspace CTA', () => {
    const rendered = taskAssignedEmail({
      name: 'Blake',
      title: 'Defoliation pass',
      roomName: 'Flower B',
      siteName: 'Hill',
      dueOn: '2026-10-06',
      tasksUrl: 'http://localhost:5173/workspace',
    });
    expect(rendered.subject).toBe('Task assigned: Defoliation pass');
    expect(rendered.text).toContain('Flower B');
    expect(rendered.html).toContain('Open Tasks');
    expect(rendered.html).toContain('Task notification');
    expect(rendered.html).toContain('/workspace');
  });

  it('wraps marketing copy in the announcement shell and escapes HTML', () => {
    const rendered = marketingBroadcastEmail({
      subject: 'Lunch coverage',
      body: 'Bring <script>alert(1)</script> trays.',
      organizationName: 'Cedar Nights',
      recipientName: 'Avery',
    });
    expect(rendered.html).not.toContain('<script>alert(1)</script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('Announcement');
    expect(rendered.html).toContain('Cedar Nights');
    expect(rendered.text).toContain('Bring <script>alert(1)</script> trays.');
  });

  it('builds previews for each template kind', () => {
    for (const kind of ['password_reset', 'task_assigned', 'marketing'] as const) {
      const preview = previewEmailTemplate(kind, { subject: 'Preview subject', body: 'Preview body' });
      expect(preview.html.length).toBeGreaterThan(200);
      expect(preview.text.length).toBeGreaterThan(20);
    }
  });
});
