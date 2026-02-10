const APP_NAME = 'Stats Lab';

function baseLayout(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden">
        <tr><td style="background-color:#4f46e5;padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600">${APP_NAME}</h1>
        </td></tr>
        <tr><td style="padding:32px">
          ${content}
        </td></tr>
        <tr><td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5">
            You received this email because of your notification preferences.
            You can update your email settings in the Settings page.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function chatMessageEmail({ senderName, roomName, messagePreview, appUrl }) {
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px">New message in ${roomName}</h2>
    <p style="margin:0 0 8px;color:#6b7280;font-size:14px"><strong>${senderName}</strong> sent a message:</p>
    <div style="margin:16px 0;padding:16px;background-color:#f9fafb;border-radius:6px;border-left:4px solid #4f46e5">
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.5">${messagePreview}</p>
    </div>
    <a href="${appUrl}/chat" style="display:inline-block;margin-top:16px;padding:10px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Open Chat</a>
  `);

  const text = `New message from ${senderName} in ${roomName}:\n\n"${messagePreview}"\n\nOpen chat: ${appUrl}/chat`;

  return { html, text, subject: `New message from ${senderName} in ${roomName}` };
}

function mentionEmail({ senderName, context, appUrl }) {
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px">${senderName} mentioned you</h2>
    <div style="margin:16px 0;padding:16px;background-color:#f9fafb;border-radius:6px;border-left:4px solid #4f46e5">
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.5">${context}</p>
    </div>
    <a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:10px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View in App</a>
  `);

  const text = `${senderName} mentioned you:\n\n"${context}"\n\nView in app: ${appUrl}`;

  return { html, text, subject: `${senderName} mentioned you` };
}

function applicationStatusEmail({ applicantName, status, appUrl }) {
  const statusLabel = status === 'accepted' ? 'accepted' : status === 'rejected' ? 'declined' : 'updated';
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px">Application ${statusLabel}</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5">
      Hi ${applicantName}, your application has been <strong>${statusLabel}</strong>.
    </p>
    <a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:10px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View Details</a>
  `);

  const text = `Hi ${applicantName}, your application has been ${statusLabel}.\n\nView details: ${appUrl}`;

  return { html, text, subject: `Your application has been ${statusLabel}` };
}

function systemNotificationEmail({ title, body, appUrl }) {
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px">${title}</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5">${body || ''}</p>
    <a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:10px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Open App</a>
  `);

  const text = `${title}\n\n${body || ''}\n\nOpen app: ${appUrl}`;

  return { html, text, subject: title };
}

module.exports = {
  chatMessageEmail,
  mentionEmail,
  applicationStatusEmail,
  systemNotificationEmail,
};
