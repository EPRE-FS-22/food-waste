import nodemailer from 'nodemailer';

const mailHostname = process.env.FOOD_WASTE_MAIL_HOSTNAME;
const mailPort = parseInt(process.env.FOOD_WASTE_MAIL_PORT ?? '') || 587;
const mailSecure =
  (!!process.env.FOOD_WASTE_MAIL_SECURE &&
    process.env.FOOD_WASTE_MAIL_SECURE.toLowerCase() !== 'false') ||
  false;
const mailUseTLS =
  (!!process.env.FOOD_WASTE_MAIL_USE_TLS &&
    process.env.FOOD_WASTE_MAIL_USE_TLS.toLowerCase() !== 'false') ||
  true;
const mailUsername = process.env.FOOD_WASTE_MAIL_USERNAME;
const mailPassword = process.env.FOOD_WASTE_MAIL_PASSWORD;
const mailAddress = process.env.FOOD_WASTE_MAIL_ADDRESS;

const mailTransporter =
  mailHostname && mailHostname && mailPassword && mailAddress
    ? nodemailer.createTransport({
        host: mailHostname,
        port: mailPort,
        secure: mailSecure,
        requireTLS: mailUseTLS,
        auth: {
          user: mailUsername,
          pass: mailPassword,
        },
        logger: true,
      })
    : null;

export const sendMail = async (
  to: string,
  subject: string,
  body: string,
  html?: string
) => {
  if (mailTransporter) {
    await mailTransporter.sendMail({
      from: '"Food Waste" <' + mailAddress + '>',
      to,
      subject,
      text: body,
      html,
    });
  } else {
    console.log(
      'Missing mail configuration, instead printing mail here for testing purposes'
    );
    console.log(
      'Mail would have been sent to ' +
        to +
        ': ' +
        subject +
        '; ' +
        body +
        ' | ' +
        html
    );
  }
};