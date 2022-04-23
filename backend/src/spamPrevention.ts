import hCaptcha from 'hcaptcha';

const captchaSecret = process.env.FOOD_WASTE_CAPTCHA_SECRET ?? '';

console.log('starting');

if (!captchaSecret) {
  console.log('Captcha not configured, allowing requests without captcha.');
}

const passwordTries: Record<string, number> = {};
const passwordPreviousTimeOuts: Record<string, Date[]> = {};
const passwordTimeOuts: Record<string, Date> = {};
const passwordFailedCaptcha: Record<string, number> = {};

export const timeOutCaptchaAndResponse = async (
  ip: string,
  captchaToken?: string,
  action?: () => Promise<{ success: boolean; admin?: boolean }>,
  response?: boolean
): Promise<{
  success: boolean;
  showCaptcha: boolean;
  nextTry: Date;
  admin?: boolean;
}> => {
  const timeOut = passwordTimeOuts[ip];
  let needsCaptcha = false;
  let previous = passwordPreviousTimeOuts[ip];
  let previousCount = 0;
  if (previous) {
    if (previous.length) {
      passwordPreviousTimeOuts[ip] = previous.filter(
        (item) => item > new Date(Date.now() - 1000 * 60 * 60 * 24)
      );
      if (!passwordPreviousTimeOuts[ip].length) {
        delete passwordPreviousTimeOuts[ip];
      }
      previous = passwordPreviousTimeOuts[ip];
      previousCount = previous?.length ?? 0;
    }
  }
  if (timeOut) {
    if (timeOut > new Date()) {
      return {
        success: false,
        showCaptcha: previousCount > 3,
        nextTry: timeOut,
      };
    } else {
      delete passwordTimeOuts[ip];
      if (previousCount > 2) {
        needsCaptcha = true;
      }
    }
  }
  if (!passwordTries[ip]) {
    passwordTries[ip] = 0;
  }
  passwordTries[ip]++;
  if (passwordTries[ip] > 10) {
    if (!previous) {
      passwordPreviousTimeOuts[ip] = [];
      previous = passwordPreviousTimeOuts[ip];
    }
    let lengthInMin = 0;
    switch (previousCount) {
      case 0:
        lengthInMin = 1;
        break;
      case 1:
        lengthInMin = 5;
        break;
      case 2:
        lengthInMin = 20;
        break;
      case 3:
        lengthInMin = 60;
        break;
      case 4:
        lengthInMin = 180;
        break;
      case 5:
        lengthInMin = 540;
        break;
      default:
        lengthInMin = 1440;
        break;
    }
    const nextTry = new Date(new Date().getTime() + lengthInMin * 60 * 1000);
    passwordTimeOuts[ip] = nextTry;
    delete passwordTries[ip];
    previous.push(new Date());
    return {
      success: false,
      showCaptcha: previousCount > 2,
      nextTry,
    };
  } else if (
    passwordTries[ip] === 4 ||
    passwordTries[ip] === 7 ||
    passwordTries[ip] === 9
  ) {
    needsCaptcha = true;
  }
  if (passwordFailedCaptcha[ip]) {
    needsCaptcha = true;
  }
  if (needsCaptcha && captchaSecret) {
    const captcha =
      captchaToken && (await hCaptcha.verify(captchaSecret, captchaToken));
    if (!captcha) {
      if (passwordFailedCaptcha[ip]) {
        passwordFailedCaptcha[ip]++;
      } else {
        passwordFailedCaptcha[ip] = 1;
      }
      return {
        success: false,
        showCaptcha: true,
        nextTry: new Date(),
      };
    } else {
      delete passwordFailedCaptcha[ip];
    }
  }

  const result = action ? await action() : { success: !!response };
  if (result.success) {
    delete passwordTries[ip];
    delete passwordFailedCaptcha[ip];
    if (result.admin) {
      return {
        success: true,
        showCaptcha:
          passwordTries[ip] === 3 ||
          passwordTries[ip] === 6 ||
          passwordTries[ip] === 8,
        nextTry: new Date(),
        admin: true,
      };
    }
    return {
      success: true,
      showCaptcha:
        passwordTries[ip] === 3 ||
        passwordTries[ip] === 6 ||
        passwordTries[ip] === 8,
      nextTry: new Date(),
    };
  }
  return {
    success: false,
    showCaptcha:
      passwordTries[ip] === 3 ||
      passwordTries[ip] === 6 ||
      passwordTries[ip] === 8,
    nextTry: new Date(),
  };
};
