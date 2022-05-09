export const base64Decode = (text: string) => {
  return decodeURIComponent(
    escape(
      window.atob(text.replace(/_/g, '/').replace(/-/g, '+').replace(/~/g, '='))
    )
  );
};

export const getBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (reader.result && typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('File reader result was not a string.'));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
