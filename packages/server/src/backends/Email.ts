import * as mailer from 'nodemailer';
import * as smtp from 'nodemailer-smtp-transport';

const transport = mailer.createTransport(smtp({
  host: process.env.CELLULOID_SMTP_HOST,
  port: parseInt(process.env.CELLULOID_SMTP_PORT),
  secure: process.env.CELLULOID_SMTP_TLS === 'true',
  auth: {
    user: process.env.CELLULOID_SMTP_USER,
    pass: process.env.CELLULOID_SMTP_PASSWORD
  }
}));

export function sendMail(
  to: string, subject: string, text: string, html: string) {
  const mailOptions = {
    from: 'Celluloid <no-reply@celluloid.camp>', to, subject, text, html
  };

  return new Promise((resolve, reject) => {
    transport.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(
          `Failed to send email to ${to} with body [${text}]`, error);
        reject(new Error('Email sending failed'));
      } else {
        console.log(
          `Email sent to ${to} with subject [${subject}]`, info.response);
        resolve();
      }
    });
  });
}