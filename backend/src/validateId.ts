export const validateId = async (idBase64: string) => {
  if (idBase64) {
    return true;
  }
  return false;
};
